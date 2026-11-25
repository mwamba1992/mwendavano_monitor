import { ForbiddenException, Injectable } from '@nestjs/common';
import { Actor, canSeeNumbers, canSeePeople } from '../access/access';
import { TtlCache, CACHE_MS } from '../overview/overview.service';
import * as j from '../sources/journey';
import { SourcesService } from '../sources/sources.service';
import { joinedFrom } from '../users/users.service';

export type JourneyPeriod = '7d' | '30d' | 'all';
export const isJourneyPeriod = (v: unknown): v is JourneyPeriod => v === '7d' || v === '30d' || v === 'all';

const LIST_LIMIT = 50;
const SHOP_LIMIT = 100;
const PRODUCT_LIMIT = 15;
const DAY_MS = 86400_000;
const TZ = 'Africa/Dar_es_Salaam';

export interface FunnelRow {
  key: string;
  label: string;
  devices: number;
  /** Share of the step before that reached this one, 0–100; null for the first step. */
  ofPrevious: number | null;
  /** Share of the first step, 0–100. */
  ofFirst: number;
}

/** Counts in step order, each with the share kept from the step before. */
export function funnelRows(steps: { key: string; label: string }[], counts: number[]): FunnelRow[] {
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);
  return steps.map((s, i) => ({
    key: s.key,
    label: s.label,
    devices: counts[i] ?? 0,
    ofPrevious: i === 0 ? null : pct(counts[i] ?? 0, counts[i - 1] ?? 0),
    ofFirst: pct(counts[i] ?? 0, counts[0] ?? 0),
  }));
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "opened 5×, viewed 12 products, added Mibro A3, no checkout". */
export function sokoPath(r: { opens: number; products: number; adds: number; last_added_name: string | null; checkouts: number; orders: number; code_failed: number; messages: number }): string {
  const parts: string[] = [];
  if (r.opens) parts.push(`opened ${r.opens}×`);
  parts.push(r.products ? `viewed ${plural(r.products, 'product')}` : 'viewed no product');
  if (r.adds) parts.push(`added ${r.last_added_name ?? 'a product'}${r.adds > 1 ? ` (+${r.adds - 1} more)` : ''}`);
  if (r.messages) parts.push('messaged a shop');
  if (r.code_failed) parts.push(`sign-in code failed${r.code_failed > 1 ? ` ${r.code_failed}×` : ''}`);
  if (r.orders) parts.push(`ordered${r.orders > 1 ? ` ${r.orders}×` : ''}`);
  else if (r.checkouts) parts.push('started checkout, no order');
  else if (r.adds) parts.push('no checkout');
  return parts.join(', ');
}

const dayMonth = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });

export function ago(d: Date | null, now: Date): string {
  if (!d) return 'never';
  const days = Math.floor((now.getTime() - d.getTime()) / DAY_MS);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
}

/** "signed up 14 Nov, 3 products, 2 sales, last active 6 days ago, never opened Sokoni". */
export function mauzoPath(r: { signed_up: Date | null; products: number; sales: number; last_active: Date | null; in_soko: boolean }, now: Date): string {
  return [
    r.signed_up ? `signed up ${dayMonth(r.signed_up)}` : 'signed up (date unknown)',
    plural(r.products, 'product'),
    r.sales ? plural(r.sales, 'sale') : 'no sale yet',
    `last active ${ago(r.last_active, now)}`,
    r.in_soko ? 'in Sokoni' : 'never opened Sokoni',
  ].join(', ');
}

const shortDevice = (id: string) => String(id).slice(0, 8);
const maxDate = (...d: (Date | null | undefined)[]) => d.reduce<Date | null>((m, x) => (x && (!m || x > m) ? x : m), null);

/**
 * The read-only Customer journey page: one app (Soko or Mauzo) at a time.
 * Numbers need View on that system; names of buyers and shops need Support or Admin.
 */
@Injectable()
export class JourneyService {
  private readonly cache = new TtlCache(CACHE_MS);

  constructor(private readonly sources: SourcesService) {}

  async report(a: Actor, app: j.JourneyApp, period: JourneyPeriod, now = new Date()) {
    if (!canSeeNumbers(a, app)) throw new ForbiddenException('You do not have access to this system');
    const people = canSeePeople(a, app);
    return this.cache.get(`${app}|${period}|${people}`, () => this.load(app, period, people, now));
  }

  private async load(app: j.JourneyApp, period: JourneyPeriod, people: boolean, now: Date) {
    const from = period === 'all' ? null : joinedFrom(period, now);
    const ready = (await this.sources.tryQuery<{ ready: boolean }>('inventory', j.journeyReady()))?.[0]?.ready ?? false;
    const base = { app, period, from, ready, peopleHidden: !people };
    if (!ready) return { ...base, funnel: [], sources: [], visitors: [], products: [], shops: [], failed: false };

    const [funnel, sources, list, products] = await Promise.all([
      this.sources.tryQuery('inventory', j.funnel(app, from)),
      this.sources.tryQuery<{ source: string; devices: number }>('inventory', j.installsBySource(app, from)),
      app === 'soko' ? this.sources.tryQuery('inventory', j.sokoVisitors(from, LIST_LIMIT)) : this.sources.tryQuery('inventory', j.mauzoShops(from, SHOP_LIMIT)),
      app === 'soko' ? this.sources.tryQuery('inventory', j.sokoProducts(from, PRODUCT_LIMIT)) : Promise.resolve([]),
    ]);
    const f = funnel?.[0] ?? {};
    const chain = app === 'soko' ? j.SOKO_FUNNEL : j.MAUZO_FUNNEL;
    const extra = app === 'mauzo' ? j.MAUZO_ACTIVE : [];
    const steps = [...chain, ...extra];
    const counts = [...chain.map((_, i) => Number(f[`s${i}`] ?? 0)), ...extra.map((x) => Number(f[x.key] ?? 0))];

    return {
      ...base,
      failed: !funnel || !sources || !list || !products,
      funnel: funnelRows(steps, counts),
      sources: sources ?? [],
      visitors: app === 'soko' ? (list ?? []).map((r: any) => this.visitor(r, people)) : [],
      shops: app === 'mauzo' ? (list ?? []).map((r: any) => this.shop(r, people, now)) : [],
      products: (products ?? []).map((r: any) => ({ id: r.id, name: r.name ?? `Product #${r.id}`, shop: r.shop ?? '', views: r.views, viewers: r.viewers, adds: r.adds, orders: r.orders })),
    };
  }

  private visitor(r: any, people: boolean) {
    const signedIn = r.buyer_id != null;
    return {
      device: shortDevice(r.device_id),
      who: signedIn ? (people ? r.buyer_name || `Buyer #${r.buyer_id}` : 'Signed-in buyer') : 'Guest',
      signedIn,
      platform: r.platform ?? null,
      source: r.source ?? null,
      firstAt: r.first_at,
      lastAt: r.last_at,
      path: sokoPath(r),
      ordered: r.orders > 0,
    };
  }

  private shop(r: any, people: boolean, now: Date) {
    const lastActive = maxDate(r.last_app, r.last_sale);
    const inSoko = !!r.market_listed || !!r.soko_opened;
    const name = people ? r.name : `Shop #${r.id}`;
    return {
      id: r.id,
      name,
      signedUp: r.signed_up,
      products: r.products,
      sales: r.sales ?? 0,
      lastActive,
      daysActive7: r.days7 ?? 0,
      platform: r.platform ?? null,
      inSoko,
      usesApp: r.last_app != null,
      /** Signed up but never recorded a sale: worth a call. */
      call: !(r.sales > 0),
      path: `${name}: ${mauzoPath({ signed_up: r.signed_up, products: r.products, sales: r.sales ?? 0, last_active: lastActive, in_soko: inSoko }, now)}`,
    };
  }
}
