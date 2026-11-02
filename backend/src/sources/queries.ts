import { PeopleSystem } from '../access/access';
import { SourceDb } from './sources.service';

/**
 * Every SELECT against the monitored databases, as pure builders so they can be tested without a
 * database. Names were checked against the real schemas, not the entity property names:
 * core is snake_case except a few camelCase columns (`orderSource`, sale `createdAt`);
 * wafanyakazi and cargo are camelCase throughout.
 */
export interface Q {
  sql: string;
  params: unknown[];
}

/** core.* timestamps have no zone and the server writes UTC (INVENTORY_DB_TIMEZONE overrides). */
function invZone(): string {
  const tz = process.env.INVENTORY_DB_TIMEZONE || 'UTC';
  if (!/^[A-Za-z_]+(\/[A-Za-z_]+)?$/.test(tz)) throw new Error('INVENTORY_DB_TIMEZONE is not a time zone name');
  return tz;
}
export const invTs = (col: string) => `(${col} AT TIME ZONE '${invZone()}')`;

export const GLOBAL_AUTHENTICS_ID = 1;
export const TEST_SHOP_NAME = 'Duka la Majaribio';
export const WALK_IN_NAME = 'WALK IN KARIAKOO';
export const REVIEW_PHONES_WAFANYAKAZI = ['700000000', '700000001', '700000002', '700000003'];

/** Last nine digits: the one form every phone format in every system shares. */
export const phoneKey = (col: string) => `right(regexp_replace(coalesce(${col},''), '\\D', '', 'g'), 9)`;
export const reviewPhoneSoko = () => (process.env.REVIEW_PHONE ?? '').replace(/\D/g, '').slice(-9);

const testShopIds = `(SELECT id FROM core.business WHERE name ILIKE '${TEST_SHOP_NAME}')`;
/** Workplaces App Review signs in to, with everyone in them. */
const reviewWorkplaces = `(SELECT DISTINCT "businessId" FROM employees WHERE ${phoneKey('phone')} IN (${REVIEW_PHONES_WAFANYAKAZI.map((p) => `'${p}'`).join(',')}))`;
const realShops = `status = 'active' AND id NOT IN ${testShopIds} AND id <> ${GLOBAL_AUTHENTICS_ID}`;

export const mauzoStats = (dayStart: Date): Q => ({
  sql: `SELECT
    (SELECT count(*) FROM core.business WHERE ${realShops})::int AS shops,
    (SELECT count(*) FROM core.sale_receipt WHERE ${invTs('created_at')} >= $1 AND business_id NOT IN ${testShopIds} AND business_id <> ${GLOBAL_AUTHENTICS_ID})::int AS sales_today,
    (SELECT count(*) FROM core.subscription s JOIN core.business b ON b.id = s.business_id WHERE s.status = 'trial' AND b.status = 'active' AND b.id NOT IN ${testShopIds})::int AS trials`,
  params: [dayStart],
});

export const sokoStats = (dayStart: Date): Q => ({
  sql: `SELECT
    (SELECT count(*) FROM core.buyer WHERE ${phoneKey('phone')} <> $2)::int AS buyers,
    (SELECT count(*) FROM core.whatsapp_orders WHERE "orderSource" = 'ecommerce' AND ${invTs('created_at')} >= $1 AND business_id NOT IN ${testShopIds})::int AS orders_today,
    (SELECT count(*) FROM core.chat_message WHERE created_at >= $1)::int AS messages_today`,
  params: [dayStart, reviewPhoneSoko()],
});

export const globalStats = (dayStart: Date): Q => ({
  sql: `SELECT
    (SELECT count(*) FROM core.item WHERE business_id = ${GLOBAL_AUTHENTICS_ID} AND active AND NOT deleted AND deleted_at IS NULL)::int AS products,
    (SELECT count(*) FROM core.sale_receipt WHERE business_id = ${GLOBAL_AUTHENTICS_ID} AND ${invTs('created_at')} >= $1)::int AS sales_today,
    (SELECT count(*) FROM core.whatsapp_orders WHERE business_id = ${GLOBAL_AUTHENTICS_ID} AND "orderSource" = 'whatsapp' AND ${invTs('created_at')} >= $1)::int AS whatsapp_today`,
  params: [dayStart],
});

/** day = the Dar es Salaam calendar date as YYYY-MM-DD. */
export const wafanyakaziStats = (day: string): Q => ({
  sql: `SELECT
    (SELECT count(*) FROM businesses WHERE id NOT IN ${reviewWorkplaces})::int AS workplaces,
    (SELECT count(DISTINCT "employeeId") FROM attendance WHERE date = $1::date AND "clockInAt" IS NOT NULL AND "businessId" NOT IN ${reviewWorkplaces})::int AS checked_in,
    (SELECT count(*) FROM attendance WHERE date = $1::date AND "lateMinutes" > 0 AND "businessId" NOT IN ${reviewWorkplaces})::int AS late`,
  params: [day],
});

export const cargoStats = (): Q => ({
  sql: `SELECT
    (SELECT count(*) FROM shipments s JOIN tenants t ON t.id = s."tenantId" WHERE NOT t."isDemo" AND s.status = 'in_transit')::int AS in_transit,
    (SELECT count(*) FROM shipments s JOIN tenants t ON t.id = s."tenantId" WHERE NOT t."isDemo" AND s.status IN ('arrived', 'ready'))::int AS arrived,
    (SELECT count(*) FROM customers c JOIN tenants t ON t.id = c."tenantId" WHERE NOT t."isDemo" AND c.name <> '${WALK_IN_NAME}')::int AS customers`,
  params: [],
});

export const sokoOrdersBetween = (a: Date, b: Date, c: Date, d: Date): Q => ({
  sql: `SELECT
    count(*) FILTER (WHERE t >= $1 AND t < $2)::int AS cur,
    count(*) FILTER (WHERE t >= $3 AND t < $4)::int AS prev
    FROM (SELECT ${invTs('created_at')} AS t FROM core.whatsapp_orders WHERE "orderSource" = 'ecommerce' AND business_id NOT IN ${testShopIds}) x`,
  params: [a, b, c, d],
});

export const shopsActive = (start: Date): Q => ({
  sql: `SELECT count(*)::int AS total, count(*) FILTER (WHERE ${invTs('registered_at')} >= $1)::int AS added FROM core.business WHERE ${realShops}`,
  params: [start],
});

/** Check-ins between two moments, and attendance as a share of rostered days between two dates. */
export const attendanceBetween = (a: Date, b: Date, c: Date, d: Date, fromDay: string, toDay: string, prevFromDay: string, prevToDay: string): Q => {
  const roster = (from: string, to: string) => `(SELECT count(*) FROM generate_series(${from}::date, ${to}::date, '1 day') day
      JOIN employees e ON e.active AND e."joinedAt" <= day::date AND EXTRACT(ISODOW FROM day)::int = ANY(e."workDays")
      WHERE e."businessId" NOT IN ${reviewWorkplaces})`;
  return {
    sql: `SELECT
      (SELECT count(DISTINCT "employeeId") FROM attendance WHERE "clockInAt" >= $1 AND "clockInAt" < $2 AND "businessId" NOT IN ${reviewWorkplaces})::int AS cur,
      (SELECT count(DISTINCT "employeeId") FROM attendance WHERE "clockInAt" >= $3 AND "clockInAt" < $4 AND "businessId" NOT IN ${reviewWorkplaces})::int AS prev,
      (SELECT count(*) FROM attendance WHERE date >= $5::date AND date <= $6::date AND "clockInAt" IS NOT NULL AND "businessId" NOT IN ${reviewWorkplaces})::int AS cur_in,
      ${roster('$5', '$6')}::int AS cur_roster,
      (SELECT count(*) FROM attendance WHERE date >= $7::date AND date <= $8::date AND "clockInAt" IS NOT NULL AND "businessId" NOT IN ${reviewWorkplaces})::int AS prev_in,
      ${roster('$7', '$8')}::int AS prev_roster`,
    params: [a, b, c, d, fromDay, toDay, prevFromDay, prevToDay],
  };
};

/** How many events fell in each window, for the trend lines. */
export function eventCounts(kind: 'orders' | 'shops' | 'checkins', windows: [Date, Date][]): Q {
  const source = {
    orders: `SELECT ${invTs('created_at')} AS t FROM core.whatsapp_orders WHERE "orderSource" = 'ecommerce' AND business_id NOT IN ${testShopIds}`,
    shops: `SELECT ${invTs('registered_at')} AS t FROM core.business WHERE ${realShops}`,
    checkins: `SELECT "clockInAt" AS t FROM attendance WHERE "businessId" NOT IN ${reviewWorkplaces}`,
  }[kind];
  const params: unknown[] = [];
  const cols = windows.map(([a, b], i) => {
    params.push(a, b);
    return `count(*) FILTER (WHERE t >= $${params.length - 1} AND t < $${params.length})::int AS w${i}`;
  });
  return { sql: `SELECT ${cols.join(', ')} FROM (${source}) x`, params };
}

export const trialsEnding = (now: Date): Q => ({
  sql: `SELECT count(*)::int AS n FROM core.subscription s JOIN core.business b ON b.id = s.business_id
        WHERE s.status = 'trial' AND s.paid_until IS NULL AND b.status = 'active' AND b.id NOT IN ${testShopIds}
          AND ${invTs('s.trial_ends_at')} > $1 AND ${invTs('s.trial_ends_at')} <= $1::timestamptz + interval '24 hours'`,
  params: [now],
});

export const unreviewedReports = (): Q => ({ sql: `SELECT count(*)::int AS n FROM core.chat_report WHERE reviewed_at IS NULL`, params: [] });

/**
 * One SELECT per system, all with the same columns:
 * id, name, phone, type, plan, location, joined, last_active, status.
 * status is Trial/Active/Inactive/Blocked. "Inactive" also means nothing in the last 30 days.
 * Soko has no platform-wide block, so a buyer is never Blocked.
 */
const QUIET = `interval '30 days'`;
const people: Record<PeopleSystem, { db: SourceDb; base: () => string; params: () => unknown[]; types: string[] }> = {
  mauzo: {
    db: 'inventory',
    types: ['owner', 'staff'],
    params: () => [],
    base: () => `SELECT u.id, u.name, u.mobile_number AS phone,
        CASE WHEN EXISTS (SELECT 1 FROM core.shop_membership m WHERE m.user_id = u.id AND m.role = 'owner')
               OR NOT EXISTS (SELECT 1 FROM core."user" o WHERE o.business_id = u.business_id AND o.id < u.id) THEN 'owner' ELSE 'staff' END AS type,
        concat_ws(' · ', b.name, CASE s.status WHEN 'trial' THEN 'Trial' WHEN 'free' THEN 'Bure' ELSE initcap(s.plan) END) AS plan,
        b.address AS location,
        ${invTs('u.created_at')} AS joined,
        ${invTs('a.last_sale')} AS last_active,
        CASE WHEN b.status IN ('suspended', 'rejected', 'closed') OR NOT u.account_non_locked THEN 'Blocked'
             WHEN NOT u.active OR NOT u.enabled THEN 'Inactive'
             WHEN s.status = 'trial' THEN 'Trial'
             WHEN a.last_sale IS NULL OR ${invTs('a.last_sale')} < now() - ${QUIET} THEN 'Inactive'
             ELSE 'Active' END AS status
      FROM core."user" u
      LEFT JOIN core.business b ON b.id = u.business_id
      LEFT JOIN core.subscription s ON s.business_id = b.id
      LEFT JOIN LATERAL (SELECT max(r.created_at) AS last_sale FROM core.sale_receipt r WHERE r.created_by_user_id = u.id) a ON true
      WHERE NOT u.deleted AND u.deleted_at IS NULL AND (u.business_id IS NULL OR u.business_id NOT IN ${testShopIds})`,
  },
  soko: {
    db: 'inventory',
    types: ['buyer'],
    params: () => [reviewPhoneSoko()],
    base: () => `SELECT b.id, b.name, b.phone, 'buyer' AS type,
        CASE WHEN o.n = 0 THEN 'No orders yet' WHEN o.n = 1 THEN '1 order' ELSE o.n || ' orders' END AS plan,
        concat_ws(', ', b.city, b.region) AS location,
        ${invTs('b.created_at')} AS joined,
        GREATEST(o.last_at, c.last_at) AS last_active,
        CASE WHEN GREATEST(o.last_at, c.last_at) >= now() - ${QUIET} OR ${invTs('b.created_at')} >= now() - ${QUIET} THEN 'Active' ELSE 'Inactive' END AS status
      FROM core.buyer b
      LEFT JOIN LATERAL (SELECT count(*) AS n, max(${invTs('w.created_at')}) AS last_at FROM core.whatsapp_orders w WHERE w.buyer_id = b.id) o ON true
      LEFT JOIN LATERAL (SELECT max(v.last_message_at) AS last_at FROM core.chat_conversation v WHERE v.buyer_id = b.id) c ON true
      WHERE ${phoneKey('b.phone')} <> $1`,
  },
  wafanyakazi: {
    db: 'wafanyakazi',
    types: ['worker', 'manager'],
    params: () => [],
    base: () => `SELECT e.id, e.name, e.phone,
        CASE WHEN e.role = 'WORKER' THEN 'worker' ELSE 'manager' END AS type,
        w.name AS plan, br.name AS location, e."createdAt" AS joined, a.last_at AS last_active,
        CASE WHEN NOT e.active THEN 'Inactive' ELSE 'Active' END AS status
      FROM employees e
      LEFT JOIN businesses w ON w.id = e."businessId"
      LEFT JOIN branches br ON br.id = e."branchId"
      LEFT JOIN LATERAL (SELECT max(t."clockInAt") AS last_at FROM attendance t WHERE t."employeeId" = e.id) a ON true
      WHERE e."businessId" NOT IN ${reviewWorkplaces} AND ${phoneKey('e.phone')} NOT IN (${REVIEW_PHONES_WAFANYAKAZI.map((p) => `'${p}'`).join(',')})`,
  },
  cargo: {
    db: 'cargo',
    types: ['customer'],
    params: () => [],
    base: () => `SELECT c.id, c.name, c.phone, 'customer' AS type,
        CASE WHEN s.n = 0 THEN 'No shipments yet' WHEN s.n = 1 THEN '1 shipment' ELSE s.n || ' shipments' END AS plan,
        t.location AS location, c."createdAt" AS joined, s.last_at AS last_active,
        CASE WHEN t.plan = 'suspended' THEN 'Blocked' WHEN NOT c.active THEN 'Inactive' ELSE 'Active' END AS status
      FROM customers c
      JOIN tenants t ON t.id = c."tenantId"
      LEFT JOIN LATERAL (SELECT count(*) AS n, max(x."receivedAt") AS last_at FROM shipments x WHERE x."customerId" = c.id) s ON true
      WHERE NOT t."isDemo" AND c.name <> '${WALK_IN_NAME}'`,
  },
};

export const dbOf = (s: PeopleSystem) => people[s].db;
export const systemHasType = (s: PeopleSystem, type?: string) => !type || people[s].types.includes(type);

export interface PeopleFilters {
  joinedFrom?: Date | null;
  type?: string;
  q?: string;
}

/** Search text is always a parameter; % and _ in it are literal. */
export function peopleWhere(f: PeopleFilters, firstParam: number): { where: string; params: unknown[] } {
  const parts: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => {
    params.push(v);
    return `$${firstParam + params.length - 1}`;
  };
  if (f.joinedFrom) parts.push(`t.joined >= ${p(f.joinedFrom)}`);
  if (f.type) parts.push(`t.type = ${p(f.type)}`);
  const q = f.q?.trim();
  if (q) {
    const like = p(`%${q.replace(/[\\%_]/g, '\\$&')}%`);
    const or = [`t.name ILIKE ${like}`, `t.plan ILIKE ${like}`];
    const digits = q.replace(/\D/g, '').replace(/^(255|0)/, '');
    if (digits.length >= 3 && !/[a-z]/i.test(q)) or.push(`regexp_replace(coalesce(t.phone, ''), '\\D', '', 'g') LIKE ${p(`%${digits}%`)}`);
    parts.push(`(${or.join(' OR ')})`);
  }
  return { where: parts.length ? `WHERE ${parts.join(' AND ')}` : '', params };
}

/** Newest first. `limit` rows from this system; the service merges systems and slices the page. */
export function peopleList(system: PeopleSystem, f: PeopleFilters, limit: number): Q {
  const base = people[system];
  const fixed = base.params();
  const { where, params } = peopleWhere(f, fixed.length + 1);
  const all = [...fixed, ...params, limit];
  return { sql: `SELECT t.*, count(*) OVER()::int AS full_count FROM (${base.base()}) t ${where} ORDER BY t.joined DESC NULLS LAST, t.id DESC LIMIT $${all.length}`, params: all };
}

/** Totals plus how many joined inside each [from, to) window. */
export function peopleCounts(system: PeopleSystem, windows: [Date, Date][]): Q {
  const base = people[system];
  const params: unknown[] = [...base.params()];
  const cols = windows.map(([a, b], i) => {
    params.push(a, b);
    return `count(*) FILTER (WHERE t.joined >= $${params.length - 1} AND t.joined < $${params.length})::int AS w${i}`;
  });
  return { sql: `SELECT ${['count(*)::int AS total', ...cols].join(', ')} FROM (${base.base()}) t`, params };
}

export function phoneOf(system: PeopleSystem, id: number): Q {
  const base = people[system];
  const fixed = base.params();
  return { sql: `SELECT t.name, t.phone FROM (${base.base()}) t WHERE t.id = $${fixed.length + 1}`, params: [...fixed, id] };
}
