import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
  orderBy
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { deliveryService } from './deliveryService';
import { parsePackage, parsePackageList } from '../schemas/packageSchema';

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

/**
 * Unified Cloud Storage Adapter
 * Provides real-time synchronization with Cloud Firestore under `users/{uid}/packages`
 * with automatic fallback to LocalStorage for offline and demo mode.
 */
export class CloudStorageAdapter {
  constructor(options = {}) {
    this.mode = options.mode || (isFirebaseConfigured ? 'firestore' : 'local');
    this.userId = options.userId || null;
    this.listeners = new Set();
    this.firestoreUnsubscribe = null;
  }

  setUserId(userId) {
    if (this.userId === userId) return;
    this.userId = userId;
    
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
    return isFirebaseConfigured && this.mode === 'firestore' && Boolean(this.userId) && Boolean(db);
  }

  initFirestoreListener() {
    if (!this.isFirestoreActive()) return;

    // Teardown any existing listener before attaching a new one
    if (this.firestoreUnsubscribe) {
      this.firestoreUnsubscribe();
      this.firestoreUnsubscribe = null;
    }

    try {
      const packagesRef = collection(db, 'users', this.userId, 'packages');
      const q = query(packagesRef, orderBy('updatedAt', 'desc'));

      this.firestoreUnsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const remotePackages = [];
          snapshot.forEach((docSnap) => {
            remotePackages.push({ ...docSnap.data(), id: docSnap.id });
          });

          const localPackages = deliveryService.getPackages(this.userId);

          // If remote is empty but local has packages, sync local up to cloud
          if (remotePackages.length === 0 && localPackages.length > 0) {
            this.savePackages(localPackages);
            return;
          }

          // Merge remote with local unsynced packages to prevent data loss
          const remoteIds = new Set(remotePackages.map(p => p.id || p.trackingNumber));
          const unsyncedLocal = localPackages.filter(p => !remoteIds.has(p.id || p.trackingNumber));
          const merged = [...remotePackages, ...unsyncedLocal];

          const validated = validateList(merged);
          deliveryService.savePackages(validated, this.userId);
          this.notifyListeners(validated);

          // Upload any unsynced local packages to Firestore so they persist in the cloud
          if (unsyncedLocal.length > 0 && db && this.userId) {
            for (const pkg of unsyncedLocal) {
              if (pkg && pkg.id) {
                const docRef = doc(db, 'users', this.userId, 'packages', pkg.id);
                setDoc(docRef, { ...pkg, userId: this.userId }, { merge: true }).catch((err) => {
                  console.warn('[CloudStorageAdapter] Firestore background sync error for local package:', err);
                });
              }
            }
          }
        },
        (error) => {
          console.warn('[CloudStorageAdapter] Firestore onSnapshot warning:', error.message);
        }
      );
    } catch (err) {
      console.warn('[CloudStorageAdapter] Failed to initialize Firestore listener:', err);
    }
  }

  /**
   * Fetches packages with fallback to local cache
   */
  async getPackages() {
    if (!this.isFirestoreActive()) {
      return deliveryService.getPackages(this.userId);
    }

    try {
      const packagesRef = collection(db, 'users', this.userId, 'packages');
      const snapshot = await getDocs(packagesRef);
      if (snapshot.empty) {
        const local = deliveryService.getPackages(this.userId);
        if (local.length > 0) {
          this.savePackages(local);
          return local;
        }
        return [];
      }

      const remotePackages = [];
      snapshot.forEach((docSnap) => {
        remotePackages.push({ ...docSnap.data(), id: docSnap.id });
      });

      const validated = validateList(remotePackages);
      deliveryService.savePackages(validated, this.userId);
      return validated;
    } catch (err) {
      console.warn('[CloudStorageAdapter] Firestore getPackages error, falling back to local:', err);
      return deliveryService.getPackages(this.userId);
    }
  }

  /**
   * Saves/Syncs full package list
   */
  async savePackages(packages) {
    const validated = validateList(packages);
    deliveryService.savePackages(validated, this.userId);
    this.notifyListeners(validated);

    if (this.isFirestoreActive()) {
      try {
        // Batch sync up to 500 packages per batch atomically into subcollection
        const BATCH_LIMIT = 500;
        for (let i = 0; i < validated.length; i += BATCH_LIMIT) {
          const chunk = validated.slice(i, i + BATCH_LIMIT);
          const batch = writeBatch(db);
          for (const pkg of chunk) {
            const docRef = doc(db, 'users', this.userId, 'packages', pkg.id);
            batch.set(docRef, { ...pkg, userId: this.userId }, { merge: true });
          }
          await batch.commit();
        }
      } catch (err) {
        console.warn('[CloudStorageAdapter] Firestore savePackages sync error:', err);
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

    const existing = deliveryService.getPackages(this.userId);
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
        const docRef = doc(db, 'users', this.userId, 'packages', validatedPkg.id);
        await setDoc(docRef, { ...validatedPkg, userId: this.userId }, { merge: true });
      } catch (err) {
        console.warn('[CloudStorageAdapter] Firestore upsert error:', err);
      }
    }

    return updated;
  }

  /**
   * Deletes a package by ID
   */
  async deletePackage(packageId) {
    const existing = deliveryService.getPackages(this.userId);
    const updated = existing.filter((p) => p.id !== packageId);

    deliveryService.savePackages(updated, this.userId);
    this.notifyListeners(updated);

    if (this.isFirestoreActive()) {
      try {
        const docRef = doc(db, 'users', this.userId, 'packages', packageId);
        await deleteDoc(docRef);
      } catch (err) {
        console.warn('[CloudStorageAdapter] Firestore delete error:', err);
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
    const docRef = doc(db, 'users', userId, 'packages', validatedPkg.id);
    await setDoc(docRef, { ...validatedPkg, userId }, { merge: true });
  }

  /**
   * Deletes a single package from Firestore only. See upsertPackageRemote for rationale
   * on the explicit `userId` parameter.
   */
  async deletePackageRemote(packageId, userId) {
    if (!userId) throw new Error('deletePackageRemote requires a userId');
    if (!isFirebaseConfigured || !db) throw new Error('Firestore is not configured');
    const docRef = doc(db, 'users', userId, 'packages', packageId);
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
        console.error('[CloudStorageAdapter] Listener callback error:', e);
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
