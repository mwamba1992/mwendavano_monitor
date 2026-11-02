import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

/**
 * Local copies of the monitored databases, for development and the e2e tests. They hold only the
 * made-up rows below: production data never comes here. Each is reachable by a real monitor_ro
 * role with the same SELECT-only grants as production (deploy/monitor-ro.sql).
 */
export const RO_PASSWORD = 'local-only-monitor-ro';
export type SourceNames = { inventory: string; wafanyakazi: string; cargo: string };

const admin = (database: string) => new Client({ host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USERNAME || undefined, password: process.env.DB_PASSWORD || undefined, database });

async function withDb<T>(database: string, fn: (c: Client) => Promise<T>): Promise<T> {
  const c = admin(database);
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function recreate(name: string, file: string, schemas: string[]) {
  await withDb('postgres', async (c) => {
    await c.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await c.query(`CREATE DATABASE ${name}`);
  });
  await withDb(name, async (c) => {
    await c.query(readFileSync(join(__dirname, 'sources', file), 'utf8'));
    // Test rows should not have to fill every related table.
    await c.query(`DO $$ DECLARE r record; BEGIN
      FOR r IN SELECT conrelid::regclass AS t, conname FROM pg_constraint WHERE contype = 'f' LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.t, r.conname);
      END LOOP; END $$`);
    await c.query(`GRANT CONNECT ON DATABASE ${name} TO monitor_ro`);
    for (const s of schemas) {
      await c.query(`GRANT USAGE ON SCHEMA ${s} TO monitor_ro`);
      await c.query(`GRANT SELECT ON ALL TABLES IN SCHEMA ${s} TO monitor_ro`);
    }
  });
}

export async function createSources(n: SourceNames) {
  await withDb('postgres', (c) => c.query(`DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'monitor_ro') THEN CREATE ROLE monitor_ro LOGIN PASSWORD '${RO_PASSWORD}'; END IF;
    END $$`));
  await recreate(n.inventory, 'inventory.sql', ['core']);
  await recreate(n.wafanyakazi, 'wafanyakazi.sql', ['public']);
  await recreate(n.cargo, 'cargo.sql', ['public']);
}

export const asAdmin = withDb;

/** Rows `days` back from now, on a fixed pattern so results are predictable. */
export async function fillSources(n: SourceNames, scale = 1) {
  const now = Date.now();
  const ago = (days: number) => new Date(now - days * 86400_000).toISOString();

  await withDb(n.inventory, async (c) => {
    await c.query(`SET search_path = core`);
    const biz = async (id: number, name: string, status: string, phone: string, days: number) =>
      c.query(`INSERT INTO business (id, name, status, phone, address, registered_at) VALUES ($1, $2, $3, $4, 'Kariakoo, Dar', ($5::timestamptz AT TIME ZONE 'UTC'))`, [id, name, status, phone, ago(days)]);
    await biz(1, 'Global Authentics TZ', 'active', '0711000001', 300);
    await biz(2, 'Duka la Mfano', 'active', '0711000002', 3);
    await biz(3, 'Duka la Majaribio', 'active', '0711000003', 1);
    await biz(4, 'Duka Lililofungwa', 'suspended', '0711000004', 20);
    await biz(5, 'Duka Jipya', 'active', '0711000005', 0.01);
    for (let i = 6; i < 6 + 12 * scale; i++) await biz(i, `Duka la ${i}`, 'active', `07110${String(i).padStart(5, '0')}`, i * 2);

    const user = async (id: number, name: string, phone: string, businessId: number, days: number) =>
      c.query(`INSERT INTO "user" (id, name, username, mobile_number, business_id, password, address, created_at, active, enabled, account_non_locked, deleted) VALUES ($1, $2, $3, $4, $5, 'x', 'Dar', ($6::timestamptz AT TIME ZONE 'UTC'), true, true, true, false)`, [id, name, `u${id}`, phone, businessId, ago(days)]);
    await user(1, 'Juma Mfano', '0754123210', 2, 3);
    await user(2, 'Asha Msaidizi', '0754123211', 2, 2);
    await user(3, 'Mjaribu Test', '0754123212', 3, 1);
    await user(4, 'Salim Mfungwa', '0754123213', 4, 20);
    await user(5, 'Neema Jipya', '0754123214', 5, 0.01);
    for (let i = 6; i < 6 + 12 * scale; i++) await user(i, `Mmiliki ${i}`, `07543${String(i).padStart(5, '0')}`, i, i * 2);
    await c.query(`INSERT INTO "user" (id, name, username, mobile_number, business_id, password, address, active, enabled, account_non_locked, deleted, deleted_at) VALUES (9999, 'Aliyefutwa', 'gone', '0754000999', 2, 'x', 'Dar', true, true, true, true, now())`);

    await c.query(`INSERT INTO subscription (business_id, plan, status, trial_ends_at, created_at, updated_at) VALUES
      (2, 'duka', 'active', NULL, now(), now()),
      (5, 'duka', 'trial', (now() AT TIME ZONE 'UTC') + interval '10 hours', now(), now())`);

    const buyer = async (id: number, name: string, phone: string, days: number) =>
      c.query(`INSERT INTO buyer (id, name, phone, city, region, created_at, updated_at) VALUES ($1, $2, $3, 'Sinza', 'Dar', ($4::timestamptz AT TIME ZONE 'UTC'), now())`, [id, name, phone, ago(days)]);
    await buyer(1, 'Fatuma Mnunuzi', '+255713555884', 1);
    await buyer(2, 'App Review', '+255799000111', 0.5);
    for (let i = 3; i < 3 + 20 * scale; i++) await buyer(i, `Mnunuzi ${i}`, `+25571${String(i).padStart(7, '0')}`, i);

    const receipts = 6 * scale;
    for (let i = 0; i < receipts; i++) {
      await c.query(`INSERT INTO sale_receipt (business_id, receipt_number, total_amount, payment_method, created_by_user_id, warehouse_id, created_at) VALUES ($1, $2, 1000, 'cash', 1, 1, (now() AT TIME ZONE 'UTC') - interval '1 minute')`, [i % 3 === 0 ? 1 : 2, `R${i}`]);
    }
    await c.query(`INSERT INTO chat_conversation (id, business_id, buyer_id) VALUES (1, 2, 1)`);
    await c.query(`INSERT INTO chat_message (conversation_id, sender, body) VALUES (1, 'buyer', 'Habari')`);
    await c.query(`INSERT INTO chat_report (conversation_id, reported_by, reason) VALUES (1, 'shop', 'Lugha mbaya')`);
    await c.query(`INSERT INTO item (id, name, code, business_id, active, deleted) VALUES (1, 'Saa', 'A1', 1, true, false), (2, 'Mkoba', 'A2', 1, true, false), (3, 'Imefutwa', 'A3', 1, true, true)`);
    await c.query(`SELECT setval(pg_get_serial_sequence('core.user', 'id'), 10000)`);
  });

  await withDb(n.wafanyakazi, async (c) => {
    await c.query(`INSERT INTO businesses (id, name, phone, settings) VALUES (1, 'Kiwanda cha Mfano', '0755000001', '{}'), (2, 'App Review Ltd', '0700000000', '{}')`);
    await c.query(`INSERT INTO branches (id, "businessId", name, lat, lng, "radiusM", active) VALUES (1, 1, 'Mbezi', 0, 0, 100, true)`);
    const emp = async (id: number, biz: number, name: string, phone: string, role: string, days: number) =>
      c.query(`INSERT INTO employees (id, "businessId", "branchId", name, phone, role, "pinHash", "joinedAt", "createdAt", "workDays") VALUES ($1, $2, 1, $3, $4, $5, 'x', ($6::timestamptz)::date, $6::timestamptz, '{1,2,3,4,5,6,7}')`, [id, biz, name, phone, role, ago(days)]);
    await emp(1, 1, 'Baraka Mfanyakazi', '0688000019', 'WORKER', 2);
    await emp(2, 1, 'Rehema Meneja', '0655000128', 'MANAGER', 10);
    await emp(3, 2, 'Reviewer One', '0700000001', 'WORKER', 1);
    for (let i = 4; i < 4 + 10 * scale; i++) await emp(i, 1, `Mfanyakazi ${i}`, `0689${String(i).padStart(6, '0')}`, 'WORKER', 40 + i);
    await c.query(`INSERT INTO attendance ("businessId", "branchId", "employeeId", date, "clockInAt", "lateMinutes", "inStatus", method, "inLat", "inLng") VALUES
      (1, 1, 1, ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date), now(), 12, 'OK', 'APP', 0, 0),
      (1, 1, 2, ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date), now(), 0, 'OK', 'APP', 0, 0),
      (2, 1, 3, ((now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date), now(), 0, 'OK', 'APP', 0, 0)`);
  });

  await withDb(n.cargo, async (c) => {
    await c.query(`INSERT INTO tenants (id, name, "shortName", slug, "codePrefix", phone, location, "isDemo", plan, rates, settings) VALUES
      (1, 'Bahari Cargo', 'Bahari', 'bahari', 'BEX', '0745000001', 'Dar es Salaam', false, 'active', '{}', '{}'),
      (2, 'Demo Cargo', 'Demo', 'demo', 'DMO', '0745000002', 'Demo', true, 'trial', '{}', '{}')`);
    const cust = async (id: number, t: number, name: string, phone: string, days: number) =>
      c.query(`INSERT INTO customers (id, "tenantId", name, phone, code, "createdAt") VALUES ($1, $2, $3, $4, $5, $6)`, [id, t, name, phone, `C${id}`, ago(days)]);
    await cust(1, 1, 'Zawadi Mteja', '0742000377', 4);
    await cust(2, 2, 'Demo Mteja', '0742000378', 1);
    await cust(3, 1, 'WALK IN KARIAKOO', '0742000379', 1);
    for (let i = 4; i < 4 + 8 * scale; i++) await cust(i, 1, `Mteja ${i}`, `0743${String(i).padStart(6, '0')}`, i * 3);
    const ship = async (id: number, t: number, cu: number, status: string) =>
      c.query(`INSERT INTO shipments (id, "tenantId", "customerId", number, status, "trackingToken", "receivedAt", "rawCode", mode, "warehouseId", goods, boxes, "boxCount", "weightKg", cbm, "chargeableKg", "estimateUsd") VALUES ($1, $2, $3, $4, $5, $6, now(), 'x', 'sea', 1, 'Nguo', '[]', 1, 1, 1, 1, 1)`, [id, t, cu, `S${id}`, status, `tok${id}`]);
    await ship(1, 1, 1, 'in_transit');
    await ship(2, 1, 1, 'in_transit');
    await ship(3, 1, 1, 'arrived');
    await ship(4, 2, 2, 'in_transit');
  });
}
