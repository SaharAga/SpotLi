import React, { useMemo } from 'react';
import { Package, MapPin, Clock, Inbox } from 'lucide-react';
import { Modal } from './Modal';
import { useLanguage } from '../context/LanguageContext';
import { getCarrier } from '../types/carriers';
import { buildActivityFeed, groupActivityByDay, dayLabel } from '../utils/activityFeed';
import { Title, Button } from './ui/Primitives';

/**
 * Activity — what moved since you last looked.
 *
 * Status answers "what do I have", Insights answers "how am I doing", and
 * neither answers the question people actually open a tracking app for
 * between checks. This is one chronological feed of every checkpoint across
 * every live package.
 *
 * Replaced Pickup Points in the tab bar: that screen was backed by four
 * hardcoded locations, which is a poor use of one of four tab slots. It is
 * still reachable from Account and from any package that has a pickup point,
 * which is the only context it is useful in anyway.
 */
export function ActivityModal({ isOpen, onClose, packages = [], onOpenPackage }) {
  const { language, isRTL } = useLanguage();
  const he = language === 'he';

  const days = useMemo(
    () => groupActivityByDay(buildActivityFeed(packages)),
    [packages]
  );

  const total = useMemo(
    () => days.reduce((sum, day) => sum + day.items.length, 0),
    [days]
  );

  const timeOf = (event) =>
    new Date(event.time).toLocaleTimeString(he ? 'he-IL' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      componentName="ActivityModal"
      overlayClassName="p-3 sm:p-4"
      ariaLabel={he ? 'פעילות' : 'Activity'}
      className="relative w-full max-w-lg bg-slate-950 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col"
    >
      <div className="flex items-start justify-between gap-3 p-4 sm:p-6 border-b border-slate-800 shrink-0">
        <div className="min-w-0 flex flex-col gap-1">
          <Title>{he ? 'פעילות' : 'Activity'}</Title>
          <p className="text-sm text-slate-400">
            {total > 0
              ? (he ? `${total} עדכונים אחרונים` : `${total} recent updates`)
              : (he ? 'מה שהשתנה במשלוחים שלך' : 'What moved on your packages')}
          </p>
        </div>
        <div className="hidden lg:block shrink-0">
          <Button onClick={onClose} >
          {he ? 'סגור' : 'Close'}
        </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
        {days.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center gap-3 py-16">
            <span className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <Inbox className="w-6 h-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-bold text-slate-200">
              {he ? 'אין עדיין עדכונים' : 'No updates yet'}
            </p>
            <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
              {he
                ? 'ברגע שחברות השילוח יעדכנו על המשלוחים שלך, כל מה שזז יופיע כאן.'
                : 'As carriers report on your packages, everything that moves shows up here.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {days.map((day) => (
              <section key={day.date} className="flex flex-col gap-2.5">
                <h3 className="text-xs font-bold uppercase tracking-[0.06em] text-slate-500">
                  {dayLabel(day.date, language)}
                </h3>

                <div className="flex flex-col gap-2">
                  {day.items.map((event) => {
                    const carrier = getCarrier(event.carrier);
                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => onOpenPackage && onOpenPackage(event.packageId)}
                        className="w-full flex items-start gap-3 p-4 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 hover:border-slate-700 transition-colors cursor-pointer text-start min-h-[48px] focus-visible:ring-2 focus-visible:ring-blue-500 focus:outline-none"
                      >
                        <span className="w-9 h-9 shrink-0 rounded-xl bg-blue-500/12 text-blue-400 flex items-center justify-center">
                          <Package className="w-4 h-4" aria-hidden="true" />
                        </span>

                        <span className="min-w-0 flex-1 flex flex-col gap-1">
                          <span className="text-sm font-bold text-slate-100 leading-snug">
                            {he ? event.titleHe : event.title}
                          </span>
                          <span className="text-xs text-slate-400 truncate">
                            {he ? event.packageTitleHe : event.packageTitle}
                            {carrier && (
                              <> · {he ? carrier.hebrewName : carrier.name}</>
                            )}
                          </span>
                          {event.location && (
                            <span className="text-xs text-slate-500 flex items-center gap-1.5 truncate">
                              <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                              {event.location}
                            </span>
                          )}
                        </span>

                        <span className="shrink-0 text-xs text-slate-500 flex items-center gap-1 [font-variant-numeric:tabular-nums]" dir={isRTL ? 'rtl' : 'ltr'}>
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          <bdi dir="ltr">{timeOf(event)}</bdi>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
