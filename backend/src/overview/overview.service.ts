import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Actor, canSeeNumbers, canSeePeople, PEOPLE_SYSTEMS, PeopleSystem } from '../access/access';
import { eatDate, eatDayStart, Period, periodRange, PeriodRange } from '../common/logic/time';
import { SystemNote } from '../entities';
import { ChecksService } from '../health/checks.service';
import { CARDS } from '../health/targets';
import * as q from '../sources/queries';
import { SourcesService } from '../sources/sources.service';
import { TYPE_LABEL } from '../users/users.service';
import { VisitorsService } from '../visitors/visitors.service';

export const CACHE_MS = 60_000;
const nf = (n: number) => n.toLocaleString('en-US');

export interface Change {
  delta: string;
  down: boolean;
}

export function pctChange(cur: number, prev: number): Change {
  if (prev === 0) return { delta: cur > 0 ? 'New' : '0%', down: false };
  const p = Math.round(((cur - prev) / prev) * 100);
  return { delta: `${p > 0 ? '+' : ''}${p}%`, down: p < 0 };
}

export const absChange = (n: number): Change => ({ delta: `${n > 0 ? '+' : ''}${n}`, down: n < 0 });

export function ptsChange(cur: number, prev: number): Change {
  const p = cur - prev;
  return { delta: `${p > 0 ? '+' : ''}${p} ${Math.abs(p) === 1 ? 'pt' : 'pts'}`, down: p < 0 };
}

export interface Kpi extends Partial<Change> {
  key: string;
  label: string;
  value: string;
  note: string;
}

/** A small TTL cache that also shares one in-flight load between concurrent callers. */
export class TtlCache {
  private readonly m = new Map<string, { at: number; v: Promise<unknown> }>();
  constructor(private readonly ms: number) {}
  get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.m.get(key);
    if (hit && Date.now() - hit.at < this.ms) return hit.v as Promise<T>;
    const v = load();
    this.m.set(key, { at: Date.now(), v });
    v.catch(() => this.m.delete(key));
    return v;
  }
  clear() {
    this.m.clear();
  }
}

const COMPARE: Record<Period, string> = { today: 'vs yesterday', '7d': 'vs last week', '30d': 'vs last month' };
const ADDED: Record<Period, string> = { today: 'new today', '7d': 'this week', '30d': 'this month' };

interface Facts {
  people: Record<PeopleSystem, { cur: number; prev: number } | null>;
  shops: { total: number; added: number } | null;
  orders: { cur: number; prev: number } | null;
  attendance: { cur: number; prev: number; cur_in: number; cur_roster: number; prev_in: number; prev_roster: number } | null;
}

@Injectable()
export class OverviewService {
  private readonly cache = new TtlCache(CACHE_MS);

  constructor(
    private readonly ds: DataSource,
    private readonly sources: SourcesService,
    private readonly checks: ChecksService,
    private readonly visitors: VisitorsService,
  ) {}

  private loadFacts(period: Period): Promise<Facts> {
    return this.cache.get(`facts:${period}`, async () => {
      const r: PeriodRange = periodRange(period);
      const people = await Promise.all(
        PEOPLE_SYSTEMS.map(async (s) => {
          const [row] = (await this.sources.tryQuery<{ w0: number; w1: number }>(q.dbOf(s), q.peopleCounts(s, [[r.start, r.end], [r.prevStart, r.prevEnd]]))) ?? [];
          return [s, row ? { cur: row.w0, prev: row.w1 } : null] as const;
        }),
      );
      const [shops] = (await this.sources.tryQuery('inventory', q.shopsActive(r.start))) ?? [];
      const [orders] = (await this.sources.tryQuery('inventory', q.sokoOrdersBetween(r.start, r.end, r.prevStart, r.prevEnd))) ?? [];
      const [att] = (await this.sources.tryQuery('wafanyakazi', q.attendanceBetween(r.start, r.end, r.prevStart, r.prevEnd, r.days[0], r.days[r.days.length - 1], r.prevDays[0], r.prevDays[r.prevDays.length - 1]))) ?? [];
      return { people: Object.fromEntries(people) as Facts['people'], shops: shops ?? null, orders: orders ?? null, attendance: att ?? null };
    });
  }

  async kpis(a: Actor, period: Period): Promise<Kpi[]> {
    const f = await this.loadFacts(period);
    const r = periodRange(period);
    const compare = COMPARE[period];
    const out: Kpi[] = [];

    const allowed = PEOPLE_SYSTEMS.filter((s) => canSeeNumbers(a, s));
    if (allowed.length) {
      const known = allowed.map((s) => f.people[s]).filter((x): x is { cur: number; prev: number } => !!x);
      const cur = known.reduce((n, x) => n + x.cur, 0);
      const prev = known.reduce((n, x) => n + x.prev, 0);
      out.push(known.length ? { key: 'users', label: 'New users, all systems', value: nf(cur), ...pctChange(cur, prev), note: compare } : { key: 'users', label: 'New users, all systems', value: '—', note: 'Could not read' });
    }

    const [cur, prev] = await Promise.all([this.visitors.totals(a, r.days), this.visitors.totals(a, r.prevDays)]);
    if (cur !== null) out.push({ key: 'visitors', label: 'Website visitors', value: nf(cur), ...pctChange(cur, prev ?? 0), note: compare });

    if (canSeeNumbers(a, 'mauzo')) out.push(f.shops ? { key: 'shops', label: 'Active shops', value: nf(f.shops.total), ...absChange(f.shops.added), note: ADDED[period] } : { key: 'shops', label: 'Active shops', value: '—', note: 'Could not read' });
    if (canSeeNumbers(a, 'soko')) out.push(f.orders ? { key: 'orders', label: 'Soko orders', value: nf(f.orders.cur), ...pctChange(f.orders.cur, f.orders.prev), note: compare } : { key: 'orders', label: 'Soko orders', value: '—', note: 'Could not read' });

    if (canSeeNumbers(a, 'wafanyakazi')) {
      const t = f.attendance;
      const share = (i: number, n: number) => (n ? Math.round((i / n) * 100) : 0);
      if (!t) out.push({ key: 'staff', label: 'Staff checked in', value: '—', note: 'Could not read' });
      else if (period === 'today') out.push({ key: 'staff', label: 'Staff checked in', value: nf(t.cur), ...pctChange(t.cur, t.prev), note: `${compare} · ${share(t.cur_in, t.cur_roster)}% of rostered` });
      else out.push({ key: 'staff', label: 'Staff checked in', value: `${share(t.cur_in, t.cur_roster)}%`, ...ptsChange(share(t.cur_in, t.cur_roster), share(t.prev_in, t.prev_roster)), note: 'attendance' });
    }
    return out;
  }

  private cardNumbers() {
    return this.cache.get('cards', async () => {
      const now = new Date();
      const day = eatDayStart(now);
      const [m, s, g, w, c] = await Promise.all([
        this.sources.tryQuery('inventory', q.mauzoStats(day)),
        this.sources.tryQuery('inventory', q.sokoStats(day)),
        this.sources.tryQuery('inventory', q.globalStats(day)),
        this.sources.tryQuery('wafanyakazi', q.wafanyakaziStats(eatDate(now))),
        this.sources.tryQuery('cargo', q.cargoStats()),
      ]);
      const v = (rows: any[] | null, col: string) => (rows?.[0] ? nf(rows[0][col]) : '—');
      return {
        mauzo: [{ v: v(m, 'shops'), l: 'Shops' }, { v: v(m, 'sales_today'), l: 'Sales today' }, { v: v(m, 'trials'), l: 'Trials' }],
        soko: [{ v: v(s, 'buyers'), l: 'Buyers' }, { v: v(s, 'orders_today'), l: 'Orders today' }, { v: v(s, 'messages_today'), l: 'Messages' }],
        wafanyakazi: [{ v: v(w, 'workplaces'), l: 'Workplaces' }, { v: v(w, 'checked_in'), l: 'Checked in' }, { v: v(w, 'late'), l: 'Late' }],
        cargo: [{ v: v(c, 'in_transit'), l: 'In transit' }, { v: v(c, 'arrived'), l: 'Arrived' }, { v: v(c, 'customers'), l: 'Customers' }],
        global: [{ v: v(g, 'products'), l: 'Products' }, { v: v(g, 'sales_today'), l: 'Sales today' }, { v: v(g, 'whatsapp_today'), l: 'WhatsApp orders' }],
      } as Record<string, { v: string; l: string }[]>;
    });
  }

  async systems(a: Actor) {
    const [numbers, { recent, lastCheckAt }, uptime, deploys, notes] = await Promise.all([this.cardNumbers(), this.checks.recent(), this.checks.uptime(), this.checks.deployDates(), this.ds.getRepository(SystemNote).find()]);
    const status = this.checks.statuses(recent);
    const cards = CARDS.filter((c) => canSeeNumbers(a, c.system)).map((c) => ({
      id: c.id,
      name: c.name,
      domain: c.domain,
      initials: c.initials,
      status: status.get(c.id),
      note: notes.find((n) => n.card === c.id)?.note ?? null,
      uptime: this.checks.cardUptime(c, uptime),
      lastDeploy: deploys.get(c.id) ?? null,
      stats: numbers[c.id],
    }));
    const server = canSeeNumbers(a, 'server') ? (await this.checks.server()).tiles : null;
    return { cards, server, lastCheckAt };
  }

  /** Latest six across every system this person may see people in. View level gets none. */
  async signups(a: Actor) {
    const lists = await Promise.all(
      PEOPLE_SYSTEMS.filter((s) => canSeePeople(a, s)).map(async (s) => {
        const rows = await this.cache.get(`signups:${s}`, async () => (await this.sources.tryQuery(q.dbOf(s), q.peopleList(s, {}, 6))) ?? []);
        return rows.map((r) => ({ name: r.name, system: s, type: `${TYPE_LABEL[r.type] ?? r.type}${r.status === 'Trial' ? ' · trial' : ''}`, location: r.location ?? '', joined: r.joined as Date | null }));
      }),
    );
    return lists
      .flat()
      .sort((x, y) => (y.joined?.getTime() ?? 0) - (x.joined?.getTime() ?? 0))
      .slice(0, 6);
  }
}
