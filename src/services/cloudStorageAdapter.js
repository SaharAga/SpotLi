import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { deliveryService } from './deliveryService';
import { parsePackage, parsePackageList, pickCloudWritableFields } from '../schemas/packageSchema';
import { STORAGE_KEYS } from '../constants/storageKeys';

export const MAX_TOMBSTONES = 200;

/**
 * Validates a package list through the single repairing schema entry point.
 * (The old try-Zod-then-fall-back-to-the-hand-rolled-validator bridge is gone.)
 *
 * @param {unknown} packages
 * @returns {Array<object>}
 */
function validateList(packages) {
  return parsePackageList(packages).packages;
}

function packageTime(pkg) {
  const time = Date.parse(pkg?.updatedAt || '');
  return Number.isFinite(time) ? time : 0;
}

function pendingMutations(userId) {
  try {
    if (typeof localStorage === 'undefined') return new Map();
    const raw = localStorage.getItem(STORAGE_KEYS.OFFLINE_SYNC_QUEUE);
    const queue = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(queue)) return new Map();
    return new Map(queue
      .filter((mutation) => mutation?.userId === userId)
      .map((mutation) => [
        mutation.type === 'STATUS_CHANGE' ? mutation.payload?.packageId : mutation.payload?.id,
        mutation
      ])
      .filter(([id]) => Boolean(id)));
  } catch (err) {
    console.warn('[CloudStorageAdapter] Failed to read sync queue:', err);
    return new Map();
  }
}

/**
 * Full snapshots are authoritative except for mutations still waiting in the
 * durable offline queue. For non-pending conflicts, the newer updatedAt wins.
 */
function reconcileRemoteSnapshot(remotePackages, localPackages, userId) {
  const pending = pendingMutations(userId);
  const localById = new Map(localPackages.map((pkg) => [pkg.id, pkg]));
  const remoteIds = new Set(remotePackages.map((pkg) => pkg.id));
  const merged = [];

  for (const remote of remotePackages) {
    const local = localById.get(remote.id);
    const mutation = pending.get(remote.id);
    if (mutation?.type === 'DELETE') continue;
    if (local && (mutation || packageTime(local) > packageTime(remote))) merged.push(local);
    else merged.push(remote);
  }
  for (const local of localPackages) {
    if (remoteIds.has(local.id)) continue;
    const mutation = pending.get(local.id);
    if (mutation && mutation.type !== 'DELETE') merged.push(local);
  }
  return validateList(merged).sort((a, b) => packageTime(b) - packageTime(a));
}

/**
 * Reconcile a remote snapshot against local, and NEVER shrink what is on disk.
 *
 * A remote snapshot can be empty or partial for reasons that have nothing to do
 * with deletion: a first sync, a permissions error, a still-warming cache, or a
 * document the query did not match (Firestore omits documents that lack the
 * field an `orderBy` names). Deletions travel through tombstones, applied by the
 * caller. Anything else that "disappears" from a snapshot is a read artefact,
 * and persisting it is what destroyed users' packages.
 *
 * Returns the merged list plus the packages the raw reconcile would have
 * dropped, so callers can log the near-miss.
 */
export function reconcileSnapshotPreservingLocal(remotePackages, localPackages, userId) {
  const validated = reconcileRemoteSnapshot(remotePackages, localPackages, userId);
  const dropped = localPackages.filter((pkg) => !validated.some((v) => v.id === pkg.id));

  if (dropped.length === 0) return { packages: validated, dropped };

  const kept = validateList([...validated, ...dropped]).sort(
    (a, b) => packageTime(b) - packageTime(a)
  );
  return { packages: kept, dropped };
}

function getTombstonesStorageKey(userId) {
  if (userId) {
    return `${STORAGE_KEYS.TOMBSTONES_PREFIX}${userId}`;
  }
  return STORAGE_KEYS.TOMBSTONES_GUEST;
}

/**
 * Unified Cloud Storage Adapter
 * Provides real-time synchronization with Cloud Firestore under `users/{uid}/packages`
 * with automatic fallback to LocalStorage for offline and demo mode.
 */
export class CloudStorageAdapter {
  constructor(options = {}) {
    this.mode = options.mode || (isFirebaseConfigured ? "firestore" : "local");
    this.userId = options.userId || null;
    this.listeners = new Set();
    this.firestoreUnsubscribe = null;
    this.tombstones = new Set(this.loadTombstones(this.userId));
  }

  loadTombstones(userId) {
    try {
      if (typeof localStorage === "undefined") return [];
      const raw = localStorage.getItem(getTombstonesStorageKey(userId));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.slice(-MAX_TOMBSTONES);
      }
    } catch (e) {
      console.warn("[CloudStorageAdapter] Failed to load tombstones:", e);
    }
    return [];
  }

  saveTombstones(userId) {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(
        getTombstonesStorageKey(userId),
        JSON.stringify(Array.from(this.tombstones))
      );
    } catch (e) {
      console.warn("[CloudStorageAdapter] Failed to save tombstones:", e);
    }
  }

  recordTombstone(packageId, userId = this.userId) {
    if (!packageId) return;
    if (this.tombstones.has(packageId)) {
      this.tombstones.delete(packageId);
    }
    this.tombstones.add(packageId);
    while (this.tombstones.size > MAX_TOMBSTONES) {
      const oldest = this.tombstones.values().next().value;
      this.tombstones.delete(oldest);
    }
    this.saveTombstones(userId);
  }

  removeTombstone(packageId, userId = this.userId) {
    if (!packageId) return;
    if (this.tombstones.has(packageId)) {
      this.tombstones.delete(packageId);
      this.saveTombstones(userId);
    }
  }

  isDeleted(packageId) {
    return this.tombstones.has(packageId);
  }

  clearTombstones(userId = this.userId) {
    this.tombstones.clear();
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(getTombstonesStorageKey(userId));
      }
    } catch (e) {
      console.warn("[CloudStorageAdapter] Failed to clear tombstones:", e);
    }
  }

  setUserId(userId) {
    if (this.userId === userId) return;
    this.userId = userId;
    this.tombstones = new Set(this.loadTombstones(userId));
    
    // Clean up existing listener if user changes
    if (this.firestoreUnsubscribe) {
      this.firestoreUnsubscribe();
      this.firestoreUnsubscribe = null;
    }

    if (this.isFirestoreActive()) {
      this.initFirestoreListener();
    }
  }

  setMode(mode) {
    this.mode = mode;
  }

  isFirestoreActive() {
    return isFirebaseConfigured && this.mode === "firestore" && Boolean(this.userId) && Boolean(db);
  }

  initFirestoreListener() {
    if (!this.isFirestoreActive()) return;

    // Teardown any existing listener before attaching a new one
    if (this.firestoreUnsubscribe) {
      this.firestoreUnsubscribe();
      this.firestoreUnsubscribe = null;
    }

    try {
      const packagesRef = collection(db, "users", this.userId, "packages");
      // No orderBy. Firestore silently OMITS documents that lack the ordering
      // field, so `orderBy("updatedAt")` returned a partial snapshot for any
      // package written without one — and the reconcile below then deleted the
      // local copy of every package that "wasn't there". Ordering is presentation
      // and is done client-side; it must never decide which records exist.
      const q = query(packagesRef);

      this.firestoreUnsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const remotePackages = [];
          snapshot.forEach((docSnap) => {
            const pkgId = docSnap.id;
            // Ignore any package marked as deleted / tombstoned
            if (!this.tombstones.has(pkgId)) {
              remotePackages.push({ ...docSnap.data(), id: pkgId });
            }
          });

          const localPackages = deliveryService.getPackages(this.userId).filter(
            (p) => !this.tombstones.has(p.id)
          );

          const { packages: nextPackages, dropped } = reconcileSnapshotPreservingLocal(
            validateList(remotePackages),
            localPackages,
            this.userId
          );

          if (dropped.length > 0) {
            console.warn(
              `[CloudStorageAdapter] Snapshot omitted ${dropped.length} local package(s); keeping them rather than deleting.`
            );
          }

          deliveryService.savePackages(nextPackages, this.userId);
          this.notifyListeners(nextPackages);
        },
        (error) => {
          console.warn("[CloudStorageAdapter] Firestore onSnapshot warning:", error.message);
        }
      );
    } catch (err) {
      console.warn("[CloudStorageAdapter] Failed to initialize Firestore listener:", err);
    }
  }

  /**
   * Fetches packages with fallback to local cache
   */
  async getPackages() {
    if (!this.isFirestoreActive()) {
      return deliveryService.getPackages(this.userId).filter(p => !this.tombstones.has(p.id));
    }

    try {
      const packagesRef = collection(db, "users", this.userId, "packages");
      const snapshot = await getDocs(packagesRef);
      if (snapshot.empty) {
        const local = deliveryService.getPackages(this.userId).filter(p => !this.tombstones.has(p.id));
        if (local.length > 0) {
          this.savePackages(local);
          return local;
        }
        return [];
      }

      const remotePackages = [];
      snapshot.forEach((docSnap) => {
        if (!this.tombstones.has(docSnap.id)) {
          remotePackages.push({ ...docSnap.data(), id: docSnap.id });
        }
      });

      const validated = reconcileRemoteSnapshot(
        validateList(remotePackages),
        deliveryService.getPackages(this.userId).filter((p) => !this.tombstones.has(p.id)),
        this.userId
      );
      deliveryService.savePackages(validated, this.userId);
      return validated;
    } catch (err) {
      console.warn("[CloudStorageAdapter] Firestore getPackages error, falling back to local:", err);
      return deliveryService.getPackages(this.userId).filter(p => !this.tombstones.has(p.id));
    }
  }

  /**
   * Saves/Syncs full package list
   */
  async savePackages(packages) {
    const filtered = (packages || []).filter(p => !this.tombstones.has(p?.id));
    const validated = validateList(filtered);
    deliveryService.savePackages(validated, this.userId);
    this.notifyListeners(validated);

    if (this.isFirestoreActive()) {
      try {
        // This method is intentionally upsert-only. A full collection
        // read/replace races concurrent clients and turns an offline import
        // into accidental remote deletion. Callers that replace a local list
        // enqueue explicit per-record deletes through the durable sync queue.
        const BATCH_LIMIT = 500;
        for (let i = 0; i < validated.length; i += BATCH_LIMIT) {
          const chunk = validated.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(db);
          for (const pkg of chunk) {
            const docRef = doc(db, "users", this.userId, "packages", pkg.id);
            batch.set(docRef, { ...pkg, userId: this.userId }, { merge: true });
          }
          await batch.commit();
        }
      } catch (err) {
        console.warn("[CloudStorageAdapter] Firestore savePackages sync error:", err);
      }
    }

    return validated;
  }

  /**
   * Adds or updates a single package
   */
  async upsertPackage(pkg) {
    const validatedPkg = parsePackage(pkg);
    if (!validatedPkg) return deliveryService.getPackages(this.userId);

    // If previously deleted, un-tombstone since user is re-adding / updating
    this.removeTombstone(validatedPkg.id);

    const existing = deliveryService.getPackages(this.userId).filter(p => !this.tombstones.has(p.id));
    const index = existing.findIndex((p) => p.id === validatedPkg.id);

    let updated;
    if (index >= 0) {
      updated = [...existing];
      updated[index] = validatedPkg;
    } else {
      updated = [validatedPkg, ...existing];
    }

    deliveryService.savePackages(updated, this.userId);
    this.notifyListeners(updated);

    if (this.isFirestoreActive()) {
      try {
        const docRef = doc(db, "users", this.userId, "packages", validatedPkg.id);
        await setDoc(docRef, { ...validatedPkg, userId: this.userId }, { merge: true });
      } catch (err) {
        console.warn("[CloudStorageAdapter] Firestore upsert error:", err);
      }
    }

    return updated;
  }

  /**
   * Deletes a package by ID and records a tombstone
   */
  async deletePackage(packageId) {
    this.recordTombstone(packageId);

    const existing = deliveryService.getPackages(this.userId);
    const updated = existing.filter((p) => p.id !== packageId);

    deliveryService.savePackages(updated, this.userId);
    this.notifyListeners(updated);

    if (this.isFirestoreActive()) {
      try {
        const docRef = doc(db, "users", this.userId, "packages", packageId);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn("[CloudStorageAdapter] Firestore delete error:", err);
      }
    }

    return updated;
  }

  /**
   * Writes a single package to Firestore only, with no local write and no internal
   * error swallowing — errors propagate to the caller. Used by the offline sync queue's
   * replay path, where local persistence has already happened separately and the queue
   * needs to know whether the remote write actually succeeded so it can retry.
   *
   * Takes `userId` explicitly rather than relying on `this.userId` — the replay path may
   * run for a different user than whichever one this singleton's live listener is currently
   * attached to, and this method must not touch that listener state (setUserId() has side
   * effects — tearing down and re-establishing a real Firestore subscription — that have no
   * place in a queue replay loop).
   */
  async upsertPackageRemote(pkg, userId) {
    if (!userId) throw new Error('upsertPackageRemote requires a userId');
    if (!isFirebaseConfigured || !db) throw new Error('Firestore is not configured');
    const validatedPkg = parsePackage(pkg);
    if (!validatedPkg) throw new Error('Invalid package payload');
    this.removeTombstone(validatedPkg.id, userId);
    const docRef = doc(db, 'users', userId, 'packages', validatedPkg.id);
    // Narrowed, not trusted: the repairing schema preserves unknown fields on
    // purpose, and firestore.rules refuses the entire write if it sees one.
    await setDoc(docRef, { ...pickCloudWritableFields(validatedPkg), userId }, { merge: true });
  }

  /**
   * Deletes a single package from Firestore only. See upsertPackageRemote for rationale
   * on the explicit `userId` parameter.
   */
  async deletePackageRemote(packageId, userId) {
    if (!userId) throw new Error("deletePackageRemote requires a userId");
    if (!isFirebaseConfigured || !db) throw new Error("Firestore is not configured");
    this.recordTombstone(packageId, userId);
    const docRef = doc(db, "users", userId, "packages", packageId);
    await deleteDoc(docRef);
  }

  /**
   * Subscribes to real-time updates
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners(data) {
    this.listeners.forEach((cb) => {
      try {
        cb(data);
      } catch (e) {
        console.error("[CloudStorageAdapter] Listener callback error:", e);
      }
    });
  }

  teardown() {
    if (this.firestoreUnsubscribe) {
      this.firestoreUnsubscribe();
      this.firestoreUnsubscribe = null;
    }
    this.listeners.clear();
  }
}

export const cloudAdapter = new CloudStorageAdapter();
