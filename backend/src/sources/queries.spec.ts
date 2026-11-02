import * as q from './queries';

const d = new Date('2026-11-02T00:00:00Z');

describe('query builders', () => {
  it('keeps search text in parameters', () => {
    const r = q.peopleList('cargo', { q: `x'; DROP TABLE customers; --` }, 50);
    expect(r.sql).not.toContain('DROP TABLE');
    expect(r.params).toContain(`%x'; DROP TABLE customers; --%`);
  });
  it('treats % and _ in a search as literal', () => expect(q.peopleWhere({ q: '50%_x' }, 1).params[0]).toBe('%50\\%\\_x%'));
  it('searches phones by digits in any format', () => {
    const r = q.peopleWhere({ q: '0754 123' }, 1);
    expect(r.where).toContain('regexp_replace');
    expect(r.params).toContain('%754123%');
  });
  it('does not treat a shop name as a phone', () => expect(q.peopleWhere({ q: 'Duka 123' }, 1).where).not.toContain('regexp_replace'));
  it('numbers parameters after the fixed ones', () => {
    const r = q.peopleList('soko', { type: 'buyer', joinedFrom: d }, 50);
    expect(r.sql).toContain('t.joined >= $2');
    expect(r.sql).toContain('t.type = $3');
    expect(r.sql).toContain('LIMIT $4');
    expect(r.params).toHaveLength(4);
  });
  it('knows which system has which type', () => {
    expect(q.systemHasType('soko', 'buyer')).toBe(true);
    expect(q.systemHasType('soko', 'worker')).toBe(false);
    expect(q.systemHasType('cargo')).toBe(true);
  });
  it('only ever builds SELECTs', () => {
    const all = [q.mauzoStats(d), q.sokoStats(d), q.globalStats(d), q.wafanyakaziStats('2026-11-02'), q.cargoStats(), q.trialsEnding(d), q.unreviewedReports(), q.shopsActive(d), q.sokoOrdersBetween(d, d, d, d), q.peopleList('mauzo', {}, 1), q.peopleCounts('cargo', [[d, d]]), q.phoneOf('wafanyakazi', 1)];
    for (const x of all) {
      expect(x.sql.trim()).toMatch(/^SELECT/);
      expect(x.sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT)\b/);
    }
  });
  it('filters soft-deleted Mauzo users and uses real column names', () => {
    const r = q.peopleList('mauzo', {}, 1).sql;
    expect(r).toContain('NOT u.deleted AND u.deleted_at IS NULL');
    expect(r).toContain('mobile_number');
    expect(q.mauzoStats(d).sql).not.toContain('registeredAt');
  });
  it('refuses a bad time zone rather than building SQL from it', () => {
    process.env.INVENTORY_DB_TIMEZONE = `UTC'; DROP`;
    expect(() => q.mauzoStats(d)).toThrow();
    delete process.env.INVENTORY_DB_TIMEZONE;
  });
});
