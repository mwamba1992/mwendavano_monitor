import { canManageStaff, canRevealPhone, canSeeNumbers, canSeePeople, fullAccess, levelOf, noAccess, parseAccess, staffEditProblem } from '../../access/access';
import { cardStatus } from '../../health/targets';
import { dayWindows, eatDate, eatDayStart, periodRange } from './time';
import { productionConfigProblems } from '../security';
import { absChange, pctChange, ptsChange, TtlCache } from '../../overview/overview.service';
import { csvCell, joinedFrom, maskPhone } from '../../users/users.service';

const actor = (over: object) => ({ isOwner: false, access: { ...noAccess(), ...over } });

describe('role checks', () => {
  it('reads each level', () => {
    const a = actor({ mauzo: 'admin', soko: 'support', wafanyakazi: 'view' });
    expect([canRevealPhone(a, 'mauzo'), canRevealPhone(a, 'soko')]).toEqual([true, false]);
    expect([canSeePeople(a, 'soko'), canSeePeople(a, 'wafanyakazi')]).toEqual([true, false]);
    expect([canSeeNumbers(a, 'wafanyakazi'), canSeeNumbers(a, 'cargo')]).toEqual([true, false]);
  });
  it('treats a corrupt value as none', () => expect(levelOf({ isOwner: false, access: { mauzo: 'root' } as any }, 'mauzo')).toBe('none'));
  it('the owner is Admin everywhere', () => expect(levelOf({ isOwner: true, access: noAccess() }, 'cargo')).toBe('admin'));
  it('one system Admin cannot manage staff', () => {
    expect(canManageStaff(actor({ cargo: 'admin' }))).toBe(false);
    expect(canManageStaff(actor({ server: 'admin' }))).toBe(true);
  });
  it('protects the owner and yourself', () => {
    const a = { id: 2, ...actor({ server: 'admin' }) };
    expect(staffEditProblem(a, { id: 1, isOwner: true })).toMatch(/owner/);
    expect(staffEditProblem(a, { id: 2, isOwner: false })).toMatch(/own access/);
    expect(staffEditProblem(a, { id: 3, isOwner: false })).toBeNull();
  });
  it('rejects unknown access', () => {
    expect(parseAccess({ mauzo: 'owner' })).toBeNull();
    expect(parseAccess({ payroll: 'view' })).toBeNull();
    expect(parseAccess({ mauzo: 'view' })).toEqual({ ...noAccess(), mauzo: 'view' });
    expect(fullAccess().server).toBe('admin');
  });
});

describe('status', () => {
  const card = { http: ['site', 'api'], services: ['cargo-api' as const] };
  const m = (o: Record<string, boolean[]>) => new Map(Object.entries(o));
  it('is Online when everything answers', () => expect(cardStatus(card, m({ site: [true], api: [true], 'service:cargo-api': [true] }))).toBe('Online'));
  it('a stopped service is Down on the first check', () => expect(cardStatus(card, m({ site: [true], api: [true], 'service:cargo-api': [false] }))).toBe('Down'));
  it('one failed web check is only Degraded', () => expect(cardStatus(card, m({ site: [false, true], api: [false, true], 'service:cargo-api': [true] }))).toBe('Degraded'));
  it('two failures on every web target is Down', () => expect(cardStatus(card, m({ site: [false, false], api: [false, false], 'service:cargo-api': [true] }))).toBe('Down'));
  it('no checks is No data, never Online', () => expect(cardStatus(card, m({}))).toBe('No data'));
});

describe('Dar es Salaam time', () => {
  it('starts the day at 21:00 UTC', () => {
    expect(eatDayStart(new Date('2026-11-02T22:00:00Z')).toISOString()).toBe('2026-11-02T21:00:00.000Z');
    expect(eatDate(new Date('2026-11-02T22:00:00Z'))).toBe('2026-11-03');
  });
  it('compares today with yesterday up to the same time', () => {
    const r = periodRange('today', new Date('2026-11-02T05:00:00Z'));
    expect(r.prevStart.toISOString()).toBe('2026-10-31T21:00:00.000Z');
    expect(r.prevEnd.toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });
  it('gives previous periods the same length', () => {
    const r = periodRange('7d', new Date('2026-11-02T05:00:00Z'));
    expect(r.end.getTime() - r.start.getTime()).toBe(r.prevEnd.getTime() - r.prevStart.getTime());
    expect(r.days).toHaveLength(7);
    expect(r.days[6]).toBe('2026-11-02');
    expect(r.prevDays[6]).toBe('2026-10-26');
  });
  it('splits days on the Dar es Salaam boundary, oldest first', () => {
    const w = dayWindows(2, new Date('2026-11-02T05:00:00Z'));
    expect(w[1][0].toISOString()).toBe('2026-11-01T21:00:00.000Z');
    expect(w[0][1]).toEqual(w[1][0]);
  });
  it('builds the joined filter', () => expect(joinedFrom('all')).toBeNull());
});

describe('display rules', () => {
  it('masks phones in every stored format', () => {
    for (const p of ['0754123210', '+255754123210', '255754123210']) expect(maskPhone(p)).toBe('0754 ••• 210');
    expect(maskPhone(null)).toBe('•••');
    expect(maskPhone('8613800138000')).toBe('8613 ••• 000');
  });
  it('neutralises spreadsheet formulas and quotes CSV', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('Kariakoo, Dar')).toBe('"Kariakoo, Dar"');
    expect(csvCell('+255')).toBe(`'+255`);
  });
  it('words changes', () => {
    expect(pctChange(112, 100)).toEqual({ delta: '+12%', down: false });
    expect(pctChange(90, 100)).toEqual({ delta: '-10%', down: true });
    expect(pctChange(5, 0).delta).toBe('New');
    expect(absChange(3).delta).toBe('+3');
    expect(ptsChange(89, 90)).toEqual({ delta: '-1 pt', down: true });
  });
  it('caches and shares a load', async () => {
    const c = new TtlCache(1000);
    let n = 0;
    const load = async () => ++n;
    await Promise.all([c.get('k', load), c.get('k', load)]);
    expect(n).toBe(1);
  });
});

describe('production config', () => {
  const good = { NODE_ENV: 'production', JWT_SECRET: 'a'.repeat(32), RO_DB_USERNAME: 'monitor_ro' };
  it('accepts a safe setup', () => expect(productionConfigProblems(good)).toEqual([]));
  it('refuses a system DB user', () => expect(productionConfigProblems({ ...good, RO_DB_USERNAME: 'cargo' }).join()).toMatch(/monitor_ro/));
  it('refuses placeholder secrets', () => expect(productionConfigProblems({ ...good, JWT_SECRET: 'change-me'.padEnd(40, 'x') }).length).toBe(1));
});
