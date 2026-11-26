import { GLOBAL_AUTHENTICS_ID, invTs, phoneKey, Q, reviewPhoneSoko, TEST_SHOP_NAME } from './queries';

/**
 * Customer journey: SELECTs over core.app_event (steps the Dukani Soko and Dukani Mauzo apps
 * report, see inventory-management-backend src/app-events) joined to the buyer, shop and item
 * tables for names. created_at there is timestamptz, unlike most core.* timestamps.
 *
 * Every builder takes $1 = the start of the period (null = all time).
 */
export type JourneyApp = 'soko' | 'mauzo';
export const isJourneyApp = (v: unknown): v is JourneyApp => v === 'soko' || v === 'mauzo';

export interface FunnelStep {
  key: string;
  label: string;
  /** SQL condition on a row `e` of the app's events. */
  match: string;
}

const is = (event: string) => `e.event = '${event}'`;

/**
 * In order: a phone counts at a step only if it reached it at or after the step before.
 * A buyer already signed in never sees the sign-in screen, so any step sent with a buyer
 * counts as signing in.
 */
export const SOKO_FUNNEL: FunnelStep[] = [
  { key: 'app_open', label: 'Opened the app', match: is('app_open') },
  { key: 'product_view', label: 'Viewed a product', match: is('product_view') },
  { key: 'add_to_cart', label: 'Added to cart', match: is('add_to_cart') },
  { key: 'signin_start', label: 'Started sign-in', match: `(${is('signin_start')} OR e.buyer_id IS NOT NULL)` },
  { key: 'signin_success', label: 'Signed in', match: `(${is('signin_success')} OR e.buyer_id IS NOT NULL)` },
  { key: 'checkout_start', label: 'Started checkout', match: is('checkout_start') },
  { key: 'order_placed', label: 'Placed an order', match: is('order_placed') },
];

export const MAUZO_FUNNEL: FunnelStep[] = [
  { key: 'app_open', label: 'Opened the app', match: is('app_open') },
  { key: 'signup_start', label: 'Started sign-up', match: is('signup_start') },
  { key: 'signup_code_sent', label: 'Got the SMS code', match: is('signup_code_sent') },
  { key: 'shop_created', label: 'Created the shop', match: is('shop_created') },
  { key: 'first_product', label: 'Added a first product', match: is('first_product') },
  { key: 'sale_recorded', label: 'Recorded a first sale', match: is('sale_recorded') },
];
/** Then, of those, how many used the app on this many of the last 7 days. */
export const MAUZO_ACTIVE = [
  { key: 'active_3', label: 'Active 3+ of the last 7 days', days: 3 },
  { key: 'active_daily', label: 'Active daily (6–7 of 7)', days: 6 },
];

const testShopIds = `(SELECT id FROM core.business WHERE name ILIKE '${TEST_SHOP_NAME}')`;
const DAR = `'Africa/Dar_es_Salaam'`;

/** Phones to leave out: App Review's (Soko), and our own or the test shop's (Mauzo). */
function excluded(app: JourneyApp, reviewParam: string): string {
  return app === 'soko'
    ? `(SELECT x.device_id FROM core.app_event x WHERE x.app = 'soko' AND x.buyer_id IN (SELECT id FROM core.buyer WHERE ${phoneKey('phone')} = ${reviewParam}))`
    : `(SELECT x.device_id FROM core.app_event x WHERE x.app = 'mauzo' AND (x.business_id = ${GLOBAL_AUTHENTICS_ID} OR x.business_id IN ${testShopIds}))`;
}

/**
 * Mauzo phones of shops that existed before the phone first sent a step (people of existing
 * shops updating the app): they never sign up, so the sign-up funnel leaves them out.
 */
const existingShopPhones = `(SELECT DISTINCT x.device_id FROM core.app_event x
      JOIN core.business b ON b.id = x.business_id
      JOIN (SELECT device_id, min(created_at) AS f FROM core.app_event WHERE app = 'mauzo' GROUP BY device_id) f ON f.device_id = x.device_id
      WHERE x.app = 'mauzo' AND ${invTs('b.registered_at')} < f.f - interval '1 hour')`;

/** The app's events in the period, as CTE `e`. Uses $1 (period start) and, for Soko, $2 (review phone). */
function eventsCte(app: JourneyApp, opts: { newOnly?: boolean } = {}): string {
  return `e AS (SELECT device_id, event, buyer_id, business_id, props, platform, created_at AS t FROM core.app_event
      WHERE app = '${app}' AND ($1::timestamptz IS NULL OR created_at >= $1)
        AND device_id NOT IN ${excluded(app, '$2')}
        ${opts.newOnly ? `AND device_id NOT IN ${existingShopPhones}` : ''})`;
}

/** $1 period start; Soko adds $2, the App Review phone. Postgres refuses a parameter no SQL uses. */
const baseParams = (app: JourneyApp, from: Date | null): unknown[] => (app === 'soko' ? [from, reviewPhoneSoko()] : [from]);
const next = (params: unknown[]) => `$${params.length + 1}`;

/** Phones reaching each step in order: columns s0..sN, plus active_3 / active_daily for Mauzo. */
export function funnel(app: JourneyApp, from: Date | null): Q {
  const steps = app === 'soko' ? SOKO_FUNNEL : MAUZO_FUNNEL;
  const ctes = [eventsCte(app, { newOnly: app === 'mauzo' })];
  steps.forEach((s, i) => {
    ctes.push(
      i === 0
        ? `s0 AS (SELECT e.device_id, min(e.t) AS t FROM e WHERE ${s.match} GROUP BY e.device_id)`
        : `s${i} AS (SELECT p.device_id, min(e.t) AS t FROM s${i - 1} p JOIN e ON e.device_id = p.device_id AND e.t >= p.t AND ${s.match} GROUP BY p.device_id)`,
    );
  });
  const cols = steps.map((_, i) => `(SELECT count(*) FROM s${i})::int AS s${i}`);
  if (app === 'mauzo') {
    const last = `s${steps.length - 1}`;
    ctes.push(`act AS (SELECT p.device_id, count(DISTINCT (x.created_at AT TIME ZONE ${DAR})::date)::int AS days
        FROM ${last} p JOIN core.app_event x ON x.app = 'mauzo' AND x.device_id = p.device_id AND x.created_at >= now() - interval '7 days'
        GROUP BY p.device_id)`);
    MAUZO_ACTIVE.forEach((a) => cols.push(`(SELECT count(*) FROM act WHERE days >= ${a.days})::int AS ${a.key}`));
  }
  return { sql: `WITH ${ctes.join(',\n')} SELECT ${cols.join(', ')}`, params: baseParams(app, from) };
}

/** The first app_open source of each phone (Play Store referrer), as a LATERAL on `d`. */
const firstSource = (app: JourneyApp) => `LEFT JOIN LATERAL (SELECT x.props->>'source' AS source FROM core.app_event x
      WHERE x.app = '${app}' AND x.device_id = d.device_id AND x.event = 'app_open' AND x.props ? 'source'
      ORDER BY x.created_at LIMIT 1) src ON true`;

/** Soko: the most recent phones with what each did in the period. */
export function sokoVisitors(from: Date | null, limit: number): Q {
  const params = baseParams('soko', from);
  return {
    sql: `WITH ${eventsCte('soko')},
      d AS (SELECT device_id, min(t) AS first_at, max(t) AS last_at,
          count(*) FILTER (WHERE event = 'app_open')::int AS opens,
          count(DISTINCT props->>'product_id') FILTER (WHERE event = 'product_view')::int AS products,
          count(*) FILTER (WHERE event = 'add_to_cart')::int AS adds,
          count(*) FILTER (WHERE event = 'checkout_start')::int AS checkouts,
          count(*) FILTER (WHERE event = 'order_placed')::int AS orders,
          count(*) FILTER (WHERE event = 'signin_code_failed')::int AS code_failed,
          count(*) FILTER (WHERE event = 'message_shop_open')::int AS messages,
          max(platform) AS platform
        FROM e GROUP BY device_id ORDER BY max(t) DESC LIMIT ${next(params)})
      SELECT d.*, lb.buyer_id, b.name AS buyer_name, la.product_id AS last_added_id, i.name AS last_added_name, src.source
      FROM d
      LEFT JOIN LATERAL (SELECT x.buyer_id FROM core.app_event x WHERE x.app = 'soko' AND x.device_id = d.device_id AND x.buyer_id IS NOT NULL ORDER BY x.created_at DESC LIMIT 1) lb ON true
      LEFT JOIN core.buyer b ON b.id = lb.buyer_id
      LEFT JOIN LATERAL (SELECT (x.props->>'product_id')::int AS product_id FROM core.app_event x
          WHERE x.app = 'soko' AND x.device_id = d.device_id AND x.event = 'add_to_cart' AND x.props ? 'product_id'
            AND ($1::timestamptz IS NULL OR x.created_at >= $1)
          ORDER BY x.created_at DESC LIMIT 1) la ON true
      LEFT JOIN core.item i ON i.id = la.product_id
      ${firstSource('soko')}
      ORDER BY d.last_at DESC`,
    params: [...params, limit],
  };
}

/** Soko: most viewed products, with adds to cart and Soko orders that included them. */
export function sokoProducts(from: Date | null, limit: number): Q {
  const params = baseParams('soko', from);
  return {
    sql: `WITH ${eventsCte('soko')},
      p AS (SELECT (props->>'product_id')::int AS id,
          count(*) FILTER (WHERE event = 'product_view')::int AS views,
          count(DISTINCT device_id) FILTER (WHERE event = 'product_view')::int AS viewers,
          count(*) FILTER (WHERE event = 'add_to_cart')::int AS adds
        FROM e WHERE event IN ('product_view', 'add_to_cart') AND props->>'product_id' ~ '^[0-9]{1,9}$'
        GROUP BY 1 ORDER BY views DESC, adds DESC LIMIT ${next(params)})
      SELECT p.*, i.name, s.name AS shop, coalesce(o.n, 0)::int AS orders
      FROM p
      LEFT JOIN core.item i ON i.id = p.id
      LEFT JOIN core.business s ON s.id = i.business_id
      LEFT JOIN LATERAL (SELECT count(DISTINCT w.id) AS n FROM core.whatsapp_order_items oi
          JOIN core.whatsapp_orders w ON w.id = oi.order_id
          WHERE oi.item_id = p.id AND w."orderSource" = 'ecommerce' AND ($1::timestamptz IS NULL OR ${invTs('w.created_at')} >= $1)) o ON true
      ORDER BY p.views DESC, p.adds DESC`,
    params: [...params, limit],
  };
}

/** New phones in the period (first step ever inside it), by the source of their install. */
export function installsBySource(app: JourneyApp, from: Date | null): Q {
  return {
    sql: `WITH d AS (SELECT device_id FROM core.app_event WHERE app = '${app}' GROUP BY device_id
          HAVING ($1::timestamptz IS NULL OR min(created_at) >= $1))
      SELECT coalesce(src.source, 'unknown') AS source, count(*)::int AS devices
      FROM d ${firstSource(app)}
      WHERE d.device_id NOT IN ${excluded(app, '$2')}
      GROUP BY 1 ORDER BY 2 DESC, 1`,
    params: baseParams(app, from),
  };
}

/**
 * Mauzo: real shops that signed up in the period, newest first, with how far each got.
 * Counts come from the shop's own tables, so shops from before the app sent steps show too.
 */
export function mauzoShops(from: Date | null, limit: number): Q {
  const params = baseParams('mauzo', from);
  return {
    sql: `SELECT b.id, b.name, ${invTs('b.registered_at')} AS signed_up, b.market_listed,
        (SELECT count(*) FROM core.item i WHERE i.business_id = b.id AND NOT i.deleted AND i.deleted_at IS NULL)::int AS products,
        r.sales, r.last_sale, a.last_app, coalesce(a.days7, 0)::int AS days7, a.platform, coalesce(a.soko_opened, false) AS soko_opened
      FROM core.business b
      LEFT JOIN LATERAL (SELECT count(*)::int AS sales, max(${invTs('x.created_at')}) AS last_sale FROM core.sale_receipt x WHERE x.business_id = b.id) r ON true
      LEFT JOIN LATERAL (SELECT max(x.created_at) AS last_app,
          count(DISTINCT (x.created_at AT TIME ZONE ${DAR})::date) FILTER (WHERE x.created_at >= now() - interval '7 days') AS days7,
          max(x.platform) AS platform,
          bool_or(x.event = 'soko_enabled') AS soko_opened
        FROM core.app_event x WHERE x.app = 'mauzo' AND x.business_id = b.id) a ON true
      WHERE b.status = 'active' AND b.id <> ${GLOBAL_AUTHENTICS_ID} AND b.id NOT IN ${testShopIds}
        AND ($1::timestamptz IS NULL OR ${invTs('b.registered_at')} >= $1)
      ORDER BY b.registered_at DESC NULLS LAST, b.id DESC
      LIMIT ${next(params)}`,
    params: [...params, limit],
  };
}

/** Whether core.app_event exists and monitor_ro may read it (before the deploy step, it may not). */
export const journeyReady = (): Q => ({
  sql: `SELECT CASE WHEN to_regclass('core.app_event') IS NULL THEN false ELSE has_table_privilege(current_user, 'core.app_event', 'SELECT') END AS ready`,
  params: [],
});
