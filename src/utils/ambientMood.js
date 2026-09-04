/**
 * Ambient mood — the one aggregate value that tints the app chrome.
 *
 * The idea (borrowed from tide/weather apps that colour the whole surface by
 * the thing they report): the shipment list already knows whether your day is
 * calm, time-pressured, or blocked. That fact reaches four surfaces — the
 * header wash, the header hairline, the app mark, and the bottom nav hairline
 * — and nothing else. If a fifth thing ever needs it, it has stopped being
 * ambient and become another thing shouting for attention.
 *
 * Deliberately NOT derived from STAGES: STAGES omits `exception` and
 * `archived` (see AGENTS.md §9), so anything built from it silently drops the
 * packages that matter most here. The rules below name statuses directly, the
 * same way TAB_PREDICATES does.
 */

import { getPickupCountdown } from './deadlineUtils';

/** Ordered by precedence — the first matching mood wins. */
export const MOODS = ['stuck', 'today', 'calm'];

/**
 * `warning` (<= 48h) is deliberately excluded: a deadline two days out is not
 * a today problem, and letting it tint the app would leave the chrome amber
 * most of the time, which is the failure mode that makes ambient colour
 * meaningless.
 */
const TODAY_URGENCIES = new Set(['critical', 'expired']);

/**
 * Derives the ambient mood for a package list.
 *
 * @param {Array<object>} packages Full list; archived entries are ignored.
 * @param {Date} [now] Injectable clock, for tests.
 * @returns {'calm' | 'today' | 'stuck'}
 */
export function deriveMood(packages, now = new Date()) {
  if (!Array.isArray(packages)) return 'calm';

  let sawToday = false;

  for (const pkg of packages) {
    if (!pkg || pkg.isArchived) continue;

    // Blocked beats time-pressured: a held package needs a decision, and a
    // decision outranks an errand.
    if (pkg.status === 'customs' || pkg.status === 'exception') return 'stuck';

    if (sawToday) continue;

    if (pkg.status === 'out_for_delivery') {
      sawToday = true;
      continue;
    }

    const pickup = getPickupCountdown(pkg.pickupDeadline, now);
    if (pickup.hasDeadline && TODAY_URGENCIES.has(pickup.urgency)) {
      sawToday = true;
    }
  }

  return sawToday ? 'today' : 'calm';
}
