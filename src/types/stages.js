// Shipment lifecycle stages, order, icons, and status badges

export const STAGES = [
  {
    id: 'ordered',
    key: 'ordered',
    order: 1,
    label: 'Order Placed',
    hebrewLabel: 'הזמנה בוצעה',
    desc: 'Merchant received order and is preparing the package',
    hebrewDesc: 'ההזמנה התקבלה על ידי המוכר ונארזת למשלוח',
    color: 'slate',
    badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30'
  },
  {
    id: 'shipped',
    key: 'shipped',
    order: 2,
    label: 'Shipped',
    hebrewLabel: 'נשלח מהמוכר',
    desc: 'Package handed over to carrier at origin sorting center',
    hebrewDesc: 'החבילה נמסרה לחברת השילוח במרכז המיון במדינת המוצא',
    color: 'blue',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
  },
  {
    id: 'in_transit',
    key: 'in_transit',
    order: 3,
    label: 'In Transit',
    hebrewLabel: 'בדרך / בטיסה',
    desc: 'Package is travelling internationally or moving between distribution hubs',
    hebrewDesc: 'החבילה בטיסה בינלאומית או במעבר בין מרכזי הפצה',
    color: 'cyan',
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
  },
  {
    id: 'customs',
    key: 'customs',
    order: 4,
    label: 'Customs Clearance',
    hebrewLabel: 'בדיקת מכס',
    desc: 'Arrived in destination country and undergoing import inspection',
    hebrewDesc: 'החבילה נחתה בישראל ונמצאת בבדיקת מכס / שחרור מהיר',
    color: 'purple',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30'
  },
  {
    id: 'out_for_delivery',
    key: 'out_for_delivery',
    order: 5,
    label: 'Out for Delivery / Pickup',
    hebrewLabel: 'נמסר לחלוקה / איסוף',
    desc: 'With local courier or awaiting pickup at local branch/locker',
    hebrewDesc: 'נמסר לשליח או ממתין לאיסוף בנקודת מסירה / לוקר / סניף דואר',
    color: 'amber',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  },
  {
    id: 'delivered',
    key: 'delivered',
    order: 6,
    label: 'Delivered',
    hebrewLabel: 'נמסר ליעד',
    desc: 'Package successfully delivered or collected',
    hebrewDesc: 'החבילה נמסרה בהצלחה לידי הלקוח',
    color: 'emerald',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
  }
];

export const CATEGORIES = [
  { id: 'electronics', label: 'Electronics', hebrewLabel: 'אלקטרוניקה וגאדגטים', icon: 'Cpu', color: '#3b82f6' },
  { id: 'clothing', label: 'Fashion & Apparel', hebrewLabel: 'ביגוד ואופנה', icon: 'Shirt', color: '#ec4899' },
  { id: 'home', label: 'Home & Kitchen', hebrewLabel: 'בית ומטבח', icon: 'Home', color: '#10b981' },
  { id: 'health', label: 'Health & Beauty', hebrewLabel: 'בריאות וטיפוח', icon: 'Sparkles', color: '#8b5cf6' },
  { id: 'work', label: 'Work & Office', hebrewLabel: 'עבודה ומשרד', icon: 'Briefcase', color: '#f59e0b' },
  { id: 'gifts', label: 'Gifts & Toys', hebrewLabel: 'מתנות וצעצועים', icon: 'Gift', color: '#06b6d4' },
  { id: 'other', label: 'Other', hebrewLabel: 'כללי / אחר', icon: 'Package', color: '#64748b' }
];

// ---------------------------------------------------------------------------
// All status definitions & metadata
//
// Covers both the linear pipeline (STAGES) and non-linear or terminal statuses
// (exception, returned_to_sender, archived). Ensures UI badges and status
// selectors never silently fall back to STAGES[0] ('ordered').
export const STATUS_DEFINITIONS = Object.freeze({
  ordered: {
    id: 'ordered',
    key: 'ordered',
    label: 'Order Placed',
    hebrewLabel: 'הזמנה בוצעה',
    desc: 'Merchant received order and is preparing the package',
    hebrewDesc: 'ההזמנה התקבלה על ידי המוכר ונארזת למשלוח',
    color: 'slate',
    badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/30'
  },
  shipped: {
    id: 'shipped',
    key: 'shipped',
    label: 'Shipped',
    hebrewLabel: 'נשלח מהמוכר',
    desc: 'Package handed over to carrier at origin sorting center',
    hebrewDesc: 'החבילה נמסרה לחברת השילוח במרכז המיון במדינת המוצא',
    color: 'blue',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30'
  },
  in_transit: {
    id: 'in_transit',
    key: 'in_transit',
    label: 'In Transit',
    hebrewLabel: 'בדרך / בטיסה',
    desc: 'Package is travelling internationally or moving between distribution hubs',
    hebrewDesc: 'החבילה בטיסה בינלאומית או במעבר בין מרכזי הפצה',
    color: 'cyan',
    badgeClass: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
  },
  customs: {
    id: 'customs',
    key: 'customs',
    label: 'Customs Clearance',
    hebrewLabel: 'בדיקת מכס',
    desc: 'Arrived in destination country and undergoing import inspection',
    hebrewDesc: 'החבילה נחתה בישראל ונמצאת בבדיקת מכס / שחרור מהיר',
    color: 'purple',
    badgeClass: 'bg-purple-500/10 text-purple-400 border-purple-500/30'
  },
  out_for_delivery: {
    id: 'out_for_delivery',
    key: 'out_for_delivery',
    label: 'Out for Delivery / Pickup',
    hebrewLabel: 'נמסר לחלוקה / איסוף',
    desc: 'With local courier or awaiting pickup at local branch/locker',
    hebrewDesc: 'נמסר לשליח או ממתין לאיסוף בנקודת מסירה / לוקר / סניף דואר',
    color: 'amber',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30'
  },
  /*
   * Not a member of STAGES. STAGES is the linear stepper every package walks,
   * and only some deliveries are ever collected from a locker or branch — so
   * this sits alongside `exception` and `returned_to_sender` as a real status
   * that is not a pipeline step, which `isLinearStage` in PackageDetailModal
   * already handles.
   *
   * It existed everywhere except here: smartParser returns it for a Hebrew
   * "ממתינה לאיסוף" SMS, PackageCard, PackageDetailModal, FullScreenLockerModal
   * and locationBundling all branch on it, and about twenty tests assert it —
   * but it was absent from VALID_STATUSES and from firestore.rules, so it
   * could never be saved and a pasted pickup notice landed on "Order Placed".
   */
  ready_for_pickup: {
    id: 'ready_for_pickup',
    key: 'ready_for_pickup',
    label: 'Ready for Pickup',
    hebrewLabel: 'ממתין לאיסוף',
    desc: 'Waiting at a locker, branch or pickup point to be collected',
    hebrewDesc: 'ממתין לאיסוף בלוקר, בנקודת חלוקה או בסניף',
    color: 'teal',
    badgeClass: 'bg-teal-500/10 text-teal-400 border-teal-500/30'
  },
  delivered: {
    id: 'delivered',
    key: 'delivered',
    label: 'Delivered',
    hebrewLabel: 'נמסר ליעד',
    desc: 'Package successfully delivered or collected',
    hebrewDesc: 'החבילה נמסרה בהצלחה לידי הלקוח',
    color: 'emerald',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
  },
  exception: {
    id: 'exception',
    key: 'exception',
    label: 'Delivery Exception',
    hebrewLabel: 'חריגה / עיכוב',
    desc: 'Delivery issue, address problem, or delivery exception reported',
    hebrewDesc: 'בעיה או עיכוב במסירת המשלוח על ידי חברת השילוח',
    color: 'rose',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
  },
  returned_to_sender: {
    id: 'returned_to_sender',
    key: 'returned_to_sender',
    label: 'Returned to Sender',
    hebrewLabel: 'הוחזר לשולח',
    desc: 'Package was returned or is being returned to the sender',
    hebrewDesc: 'החבילה הוחזרה לשולח או שלא נאספה בזמן מהנקודה',
    color: 'orange',
    badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30'
  },
  archived: {
    id: 'archived',
    key: 'archived',
    label: 'Archived',
    hebrewLabel: 'בארכיון',
    desc: 'Package has been archived',
    hebrewDesc: 'החבילה הועברה לארכיון',
    color: 'slate',
    badgeClass: 'bg-slate-800/40 text-slate-400 border-slate-700/40'
  }
});

/**
 * Maps a status onto the linear pipeline step that represents it.
 *
 * `ready_for_pickup` is a real status but not a member of STAGES, so a plain
 * `STAGES.findIndex` misses it and callers fall back to index 0 — the stepper
 * pointed at "Order Placed" for a parcel the header already described as
 * waiting at a locker. It belongs on the `out_for_delivery` step, which is
 * labelled "Out for Delivery / Pickup" precisely because it covers both.
 *
 * @param {string|null|undefined} statusId
 * @returns {string|null|undefined} A STAGES id, or the input when it has no
 *   pipeline step (`exception`, `returned_to_sender`, `archived`).
 */
export function getPipelineStageId(statusId) {
  return statusId === 'ready_for_pickup' ? 'out_for_delivery' : statusId;
}

/**
 * Returns metadata for any valid status. Falls back to ordered.
 * Safe against Object.prototype properties.
 *
 * @param {string|null|undefined} statusId
 * @returns {typeof STATUS_DEFINITIONS[keyof typeof STATUS_DEFINITIONS]}
 */
export function getStatusMeta(statusId) {
  if (statusId && Object.prototype.hasOwnProperty.call(STATUS_DEFINITIONS, statusId)) {
    return STATUS_DEFINITIONS[statusId];
  }
  return STATUS_DEFINITIONS.ordered;
}

/**
 * Statuses available for user selection in add/edit flows.
 */
export const SELECTABLE_STATUSES = [
  ...STAGES,
  STATUS_DEFINITIONS.ready_for_pickup,
  STATUS_DEFINITIONS.returned_to_sender,
  STATUS_DEFINITIONS.exception
];

// ---------------------------------------------------------------------------
// Tab / bucket predicates
//
// The same "which bucket does this status belong to" rules used to be written
// out three times — an if-chain in App.jsx, a nested counter in FilterBar.jsx
// and a reduce in StatsCards.jsx — and they had drifted apart. This table is
// the single definition: App filters with it, both counters map over it.
//
// These predicates deliberately do NOT derive from STAGES. STAGES omits both
// `exception` and `archived` (see AGENTS.md §9), so anything built from it
// silently loses those packages.
//
// `archived` is not in this table on purpose: it is a boolean flag on the
// package (`isArchived`), not a status. Every predicate below describes a
// *non-archived* package; callers exclude archived rows before applying them.
export const TAB_PREDICATES = {
  all: () => true,
  active: (pkg) => pkg.status !== 'delivered',
  transit: (pkg) =>
    pkg.status !== 'delivered' &&
    pkg.status !== 'customs' &&
    pkg.status !== 'exception' &&
    pkg.status !== 'returned_to_sender',
  in_transit: (pkg) =>
    pkg.status === 'in_transit' || pkg.status === 'shipped' || pkg.status === 'ordered',
  out_for_delivery: (pkg) =>
    pkg.status === 'out_for_delivery' || pkg.status === 'ready_for_pickup',
  delivered: (pkg) => pkg.status === 'delivered',
  customs: (pkg) =>
    pkg.status === 'customs' ||
    pkg.status === 'exception' ||
    pkg.status === 'returned_to_sender'
};

export const TAB_IDS = Object.keys(TAB_PREDICATES);

// The archived bucket, keyed off the flag rather than the status.
export const ARCHIVED_TAB = 'archived';

// Safe lookup — `TAB_PREDICATES[tab]` with an untrusted tab id (they arrive
// from the `?tab=` shortcut param) would happily return `Object.prototype`
// members such as `constructor`, which are truthy and callable.
export function getTabPredicate(tabId) {
  return Object.prototype.hasOwnProperty.call(TAB_PREDICATES, tabId)
    ? TAB_PREDICATES[tabId]
    : null;
}
