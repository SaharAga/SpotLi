import React from 'react';
import { List, BarChart3, Plus, MapPin, User } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

/**
 * Mobile bottom tab bar.
 *
 * Replaces the top-left hamburger as the primary way to reach things on a
 * phone: the top edge is the worst place on the screen for a thumb, and every
 * destination used to live behind it. Desktop keeps the drawer trigger in the
 * Navbar (this bar is `lg:hidden`), so nothing is lost on a wide screen.
 *
 * Four destinations, not thirteen. The bar carries only the places you return
 * to; the rest of the old drawer — export, import, ingestion guide, admin,
 * reset, about — stays in the drawer, now opened from Account. Search stays
 * inline in FilterBar: it filters one list rather than being somewhere to go.
 *
 * The bar is a flex row, so RTL mirrors for free — no direction-specific
 * classes anywhere in here.
 */
function BottomNavImpl({
  activeTab = 'status',
  onOpenStatus,
  onOpenInsights,
  onOpenAdd,
  onOpenLockers,
  onOpenAccount
}) {
  const { language } = useLanguage();
  const isHe = language === 'he';

  const tabs = [
    { id: 'status', icon: List, label: isHe ? 'מצב' : 'Status', onClick: onOpenStatus },
    { id: 'insights', icon: BarChart3, label: isHe ? 'תובנות' : 'Insights', onClick: onOpenInsights },
    { id: 'lockers', icon: MapPin, label: isHe ? 'לוקרים' : 'Lockers', onClick: onOpenLockers },
    { id: 'account', icon: User, label: isHe ? 'חשבון' : 'Account', onClick: onOpenAccount }
  ];

  // The FAB splits the row down the middle: two tabs, the button, two tabs.
  const leading = tabs.slice(0, 2);
  const trailing = tabs.slice(2);

  const renderTab = ({ id, icon: Icon, label, onClick }) => {
    const isActive = activeTab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={onClick}
        aria-current={isActive ? 'page' : undefined}
        className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 min-h-[48px] px-1 py-1 rounded-xl cursor-pointer transition-colors ${
          isActive ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'
        } focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none`}
      >
        <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-blue-400' : ''}`} aria-hidden="true" />
        <span className="text-[11px] font-semibold truncate max-w-full">{label}</span>
      </button>
    );
  };

  return (
    <nav
      aria-label={isHe ? 'ניווט ראשי' : 'Primary navigation'}
      /* The hairline picks up the ambient mood tint (see index.css
         [data-mood]) — down here it reads faster than the header does,
         because a thumb-driven eye is already at the bottom of the screen. */
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-start gap-1 px-2 pt-2 border-t border-[color:var(--chrome-line)] bg-slate-950/95 backdrop-blur-2xl transition-colors duration-500 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
    >
      {leading.map(renderTab)}

      <button
        type="button"
        onClick={onOpenAdd}
        aria-label={isHe ? 'הוסף חבילה' : 'Add package'}
        className="shrink-0 -mt-5 mx-1 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-600/40 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus:outline-none"
      >
        <Plus className="w-6 h-6" aria-hidden="true" />
      </button>

      {trailing.map(renderTab)}
    </nav>
  );
}

export const BottomNav = React.memo(BottomNavImpl);
