import { describe, it, expect } from 'vitest';
import {
  TAB_PREDICATES,
  TAB_IDS,
  ARCHIVED_TAB,
  getTabPredicate,
  STAGES,
  STATUS_DEFINITIONS,
  getStatusMeta,
  SELECTABLE_STATUSES
} from './stages';

// The bucketing rules used to be written out three times — an if-chain in
// App.jsx, a nested counter in FilterBar.jsx and a reduce in StatsCards.jsx —
// and they had already drifted. These tests pin the single table, including
// the buckets no FilterBar option currently produces (`active`, `in_transit`,
// `out_for_delivery`), which are still reachable through the `?tab=` app
// shortcut. Deleting them is a behaviour change, not a cleanup.

const pkg = (status, extra = {}) => ({ id: status, status, ...extra });

// Deliberately written out, NOT derived from STAGES: STAGES omits `exception`
// (AGENTS.md §9), so deriving it here would stop testing the very status that
// caused the drift.
const ALL_STATUSES = [
  'ordered',
  'shipped',
  'in_transit',
  'customs',
  'out_for_delivery',
  'delivered',
  'exception',
  'returned_to_sender'
];

describe('TAB_PREDICATES', () => {
  it('covers every tab the UI can select, and only those', () => {
    expect(TAB_IDS).toEqual([
      'all',
      'active',
      'transit',
      'in_transit',
      'out_for_delivery',
      'delivered',
      'customs'
    ]);
  });

  it('does not contain the archived bucket — it is a flag, not a status', () => {
    expect(TAB_IDS).not.toContain(ARCHIVED_TAB);
    expect(ARCHIVED_TAB).toBe('archived');
    expect(TAB_PREDICATES.archived).toBeUndefined();
  });

  it('does not narrow to the statuses STAGES happens to list', () => {
    // exception is a real status with no stage entry; the table must still
    // bucket it.
    expect(STAGES.some((s) => s.id === 'exception')).toBe(false);
    expect(TAB_PREDICATES.customs(pkg('exception'))).toBe(true);
    expect(TAB_PREDICATES.active(pkg('exception'))).toBe(true);
    expect(TAB_PREDICATES.customs(pkg('returned_to_sender'))).toBe(true);
    expect(TAB_PREDICATES.active(pkg('returned_to_sender'))).toBe(true);
  });

  it.each(ALL_STATUSES)('puts %s in the all bucket', (status) => {
    expect(TAB_PREDICATES.all(pkg(status))).toBe(true);
  });

  it('active is everything that is not delivered', () => {
    for (const status of ALL_STATUSES) {
      expect(TAB_PREDICATES.active(pkg(status))).toBe(status !== 'delivered');
    }
  });

  it('transit excludes delivered, customs, exception and returned_to_sender', () => {
    const expected = {
      ordered: true,
      shipped: true,
      in_transit: true,
      customs: false,
      out_for_delivery: true,
      delivered: false,
      exception: false,
      returned_to_sender: false
    };
    for (const status of ALL_STATUSES) {
      expect(TAB_PREDICATES.transit(pkg(status))).toBe(expected[status]);
    }
  });

  it('in_transit covers the pre-local-courier statuses', () => {
    const expected = {
      ordered: true,
      shipped: true,
      in_transit: true,
      customs: false,
      out_for_delivery: false,
      delivered: false,
      exception: false,
      returned_to_sender: false
    };
    for (const status of ALL_STATUSES) {
      expect(TAB_PREDICATES.in_transit(pkg(status))).toBe(expected[status]);
    }
  });

  it('out_for_delivery, delivered and customs match their statuses', () => {
    for (const status of ALL_STATUSES) {
      expect(TAB_PREDICATES.out_for_delivery(pkg(status))).toBe(status === 'out_for_delivery');
      expect(TAB_PREDICATES.delivered(pkg(status))).toBe(status === 'delivered');
      expect(TAB_PREDICATES.customs(pkg(status))).toBe(
        status === 'customs' || status === 'exception' || status === 'returned_to_sender'
      );
    }
  });

  it('in_transit and out_for_delivery together partition transit', () => {
    for (const status of ALL_STATUSES) {
      const p = pkg(status);
      const split = TAB_PREDICATES.in_transit(p) || TAB_PREDICATES.out_for_delivery(p);
      expect(split).toBe(TAB_PREDICATES.transit(p));
    }
  });

  it('every non-delivered status lands in exactly one of transit/customs', () => {
    for (const status of ALL_STATUSES) {
      if (status === 'delivered') continue;
      const p = pkg(status);
      expect(Number(TAB_PREDICATES.transit(p)) + Number(TAB_PREDICATES.customs(p))).toBe(1);
    }
  });

  it('handles a package with no status at all without throwing', () => {
    const p = { id: 'x' };
    expect(TAB_PREDICATES.all(p)).toBe(true);
    expect(TAB_PREDICATES.active(p)).toBe(true);
    expect(TAB_PREDICATES.delivered(p)).toBe(false);
  });
});

describe('getTabPredicate', () => {
  it('returns the predicate for a known tab', () => {
    expect(getTabPredicate('delivered')).toBe(TAB_PREDICATES.delivered);
  });

  it('returns null for an unknown tab', () => {
    expect(getTabPredicate('nope')).toBeNull();
    expect(getTabPredicate(undefined)).toBeNull();
  });

  it('returns null for inherited Object members, not a truthy function', () => {
    // `?tab=constructor` would otherwise hand the caller
    // Object.prototype.constructor, which is truthy and callable.
    expect(getTabPredicate('constructor')).toBeNull();
    expect(getTabPredicate('toString')).toBeNull();
    expect(getTabPredicate('__proto__')).toBeNull();
  });

  it('returns null for the archived flag bucket', () => {
    expect(getTabPredicate(ARCHIVED_TAB)).toBeNull();
  });
});

describe('getStatusMeta', () => {
  it('returns exact metadata for returned_to_sender', () => {
    const meta = getStatusMeta('returned_to_sender');
    expect(meta.id).toBe('returned_to_sender');
    expect(meta.label).toBe('Returned to Sender');
    expect(meta.hebrewLabel).toBe('הוחזר לשולח');
    expect(meta.color).toBe('orange');
    expect(meta.badgeClass).toContain('text-orange-400');
  });

  it('returns exact metadata for exception', () => {
    const meta = getStatusMeta('exception');
    expect(meta.id).toBe('exception');
    expect(meta.label).toBe('Delivery Exception');
    expect(meta.hebrewLabel).toBe('חריגה / עיכוב');
    expect(meta.color).toBe('rose');
  });

  it('returns linear stage metadata correctly', () => {
    for (const stage of STAGES) {
      const meta = getStatusMeta(stage.id);
      expect(meta.id).toBe(stage.id);
      expect(meta.label).toBe(stage.label);
    }
  });

  it('safely falls back to ordered for unknown or prototype keys', () => {
    expect(getStatusMeta('unknown_xyz').id).toBe('ordered');
    expect(getStatusMeta('constructor').id).toBe('ordered');
    expect(getStatusMeta(null).id).toBe('ordered');
    expect(getStatusMeta(undefined).id).toBe('ordered');
  });
});

describe('SELECTABLE_STATUSES', () => {
  it('contains linear stages plus returned_to_sender and exception', () => {
    const ids = SELECTABLE_STATUSES.map((s) => s.id);
    expect(ids).toContain('returned_to_sender');
    expect(ids).toContain('exception');
    expect(ids).toContain('ordered');
    expect(ids).toContain('delivered');
  });
});

describe('STATUS_DEFINITIONS', () => {
  it('defines all valid statuses with non-empty label, hebrewLabel and color', () => {
    for (const status of ALL_STATUSES) {
      const def = STATUS_DEFINITIONS[status];
      expect(def).toBeDefined();
      expect(def.id).toBe(status);
      expect(typeof def.label).toBe('string');
      expect(typeof def.hebrewLabel).toBe('string');
      expect(typeof def.color).toBe('string');
    }
  });
});

