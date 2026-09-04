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
    pkg.status !== 'delivered' && pkg.status !== 'customs' && pkg.status !== 'exception',
  in_transit: (pkg) =>
    pkg.status === 'in_transit' || pkg.status === 'shipped' || pkg.status === 'ordered',
  out_for_delivery: (pkg) => pkg.status === 'out_for_delivery',
  delivered: (pkg) => pkg.status === 'delivered',
  customs: (pkg) => pkg.status === 'customs' || pkg.status === 'exception'
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
