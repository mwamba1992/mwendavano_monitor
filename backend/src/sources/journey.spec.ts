import * as j from './journey';
import { ago, funnelRows, mauzoPath, sokoPath } from '../journey/journey.service';

const d = new Date('2026-11-02T00:00:00Z');

describe('journey query builders', () => {
  const all = [j.funnel('soko', d), j.funnel('mauzo', null), j.sokoVisitors(d, 50), j.sokoProducts(null, 15), j.installsBySource('soko', d), j.installsBySource('mauzo', null), j.mauzoShops(d, 100), j.journeyReady()];

  it('only ever builds SELECTs (WITH ... SELECT)', () => {
    for (const x of all) {
      expect(x.sql.trim()).toMatch(/^(SELECT|WITH)\b/);
      expect(x.sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT)\b/);
    }
  });

  it('uses every parameter it passes, and no more (Postgres refuses unused ones)', () => {
    for (const x of all) {
      const used = new Set([...x.sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])));
      expect([...used].sort((a, b) => a - b)).toEqual(x.params.map((_, i) => i + 1));
    }
  });

  it('keeps the period and limit in parameters', () => {
    const r = j.sokoVisitors(d, 50);
    expect(r.params).toEqual([d, expect.any(String), 50]);
    expect(j.mauzoShops(null, 100).params).toEqual([null, 100]);
  });

  it('chains each funnel step on the one before', () => {
    const r = j.funnel('soko', d).sql;
    expect(r).toContain('FROM s0 p JOIN e ON e.device_id = p.device_id AND e.t >= p.t');
    expect(r).toContain(`s${j.SOKO_FUNNEL.length - 1} AS`);
    expect(r).toContain('e.buyer_id IS NOT NULL'); // already signed in counts as signing in
  });

  it('leaves App Review out of Soko and our own and the test shop out of Mauzo', () => {
    expect(j.funnel('soko', d).sql).toContain('core.buyer');
    expect(j.funnel('mauzo', d).sql).toMatch(/business_id = 1 OR x.business_id IN \(SELECT id FROM core.business WHERE name ILIKE 'Duka la Majaribio'\)/);
  });

  it('counts only new shops in the Mauzo sign-up funnel, then activity over 7 days', () => {
    const r = j.funnel('mauzo', d).sql;
    expect(r).toContain('registered_at');
    expect(r).toContain('active_3');
    expect(r).toContain("interval '7 days'");
  });

  it('knows its apps', () => {
    expect(j.isJourneyApp('soko')).toBe(true);
    expect(j.isJourneyApp('cargo')).toBe(false);
  });
});

describe('journey summaries', () => {
  it('shows drop between steps', () => {
    const rows = funnelRows([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }, { key: 'c', label: 'C' }], [200, 50, 0]);
    expect(rows.map((r) => [r.ofPrevious, r.ofFirst])).toEqual([[null, 100], [25, 25], [0, 0]]);
    expect(funnelRows([{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }], [0, 0])[1].ofPrevious).toBe(0);
  });

  it('writes a Soko path in plain words', () => {
    const base = { opens: 5, products: 12, adds: 1, last_added_name: 'Mibro A3', checkouts: 0, orders: 0, code_failed: 0, messages: 0 };
    expect(sokoPath(base)).toBe('opened 5×, viewed 12 products, added Mibro A3, no checkout');
    expect(sokoPath({ ...base, adds: 3, checkouts: 1, code_failed: 2 })).toBe('opened 5×, viewed 12 products, added Mibro A3 (+2 more), sign-in code failed 2×, started checkout, no order');
    expect(sokoPath({ ...base, orders: 1, checkouts: 1 })).toBe('opened 5×, viewed 12 products, added Mibro A3, ordered');
    expect(sokoPath({ ...base, opens: 0, products: 0, adds: 0 })).toBe('viewed no product');
  });

  it('writes a Mauzo path in plain words', () => {
    const now = new Date('2026-11-20T09:00:00Z');
    const path = mauzoPath({ signed_up: new Date('2026-11-14T08:00:00Z'), products: 3, sales: 2, last_active: new Date('2026-11-14T09:00:00Z'), in_soko: false }, now);
    expect(path).toBe('signed up 14 Nov, 3 products, 2 sales, last active 6 days ago, never opened Sokoni');
    expect(mauzoPath({ signed_up: null, products: 1, sales: 0, last_active: null, in_soko: true }, now)).toBe('signed up (date unknown), 1 product, no sale yet, last active never, in Sokoni');
    expect(ago(new Date('2026-11-19T08:00:00Z'), now)).toBe('yesterday');
  });
});
