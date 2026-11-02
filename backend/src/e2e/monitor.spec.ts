import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { mkdtempSync, renameSync, rmSync, statSync, writeFileSync, appendFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AccessMap, fullAccess, noAccess } from '../access/access';
import { configureApp } from '../common/http-setup';
import { normalizePhone } from '../common/logic/phone';
import { ActivityLog, LogOffset, Staff, UptimeCheck, VisitorDaily } from '../entities';
import { ChecksService } from '../health/checks.service';
import { OverviewService } from '../overview/overview.service';
import { SourcesService } from '../sources/sources.service';
import { VisitorsService } from '../visitors/visitors.service';
import { asAdmin, createSources, fillSources, RO_PASSWORD } from '../../test/sources-setup';

const sources = { inventory: 'monitor_test_inventory', wafanyakazi: 'monitor_test_wafanyakazi', cargo: 'monitor_test_cargo' };
const PASSWORD = 'correct-horse-battery';
const logDir = mkdtempSync(join(tmpdir(), 'monitor-logs-'));

Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_DATABASE: 'mwendavano_monitor_test',
  JWT_SECRET: 'test-secret-test-secret-test-secret',
  RO_DB_USERNAME: 'monitor_ro',
  RO_DB_PASSWORD: RO_PASSWORD,
  RO_DB_INVENTORY: sources.inventory,
  RO_DB_WAFANYAKAZI: sources.wafanyakazi,
  RO_DB_CARGO: sources.cargo,
  REVIEW_PHONE: '+255799000111',
  HEALTH_CHECKS_ENABLED: 'false',
  VISITOR_PARSER_ENABLED: 'false',
  NGINX_LOG_DIR: logDir,
});

describe('Monitor end to end', () => {
  let app: NestExpressApplication;
  let ds: DataSource;
  let http: any;
  const tokens: Record<string, string> = {};

  const makeStaff = async (phone: string, name: string, access: AccessMap, extra: Partial<Staff> = {}) =>
    ds.getRepository(Staff).save(ds.getRepository(Staff).create({ phone: normalizePhone(phone)!, name, access, passwordHash: await bcrypt.hash(PASSWORD, 4), mustChangePassword: false, ...extra }));

  const bearer = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const login = async (phone: string) => (await request(http).post('/api/auth/login').send({ phone, password: PASSWORD }).expect(200)).body;

  beforeAll(async () => {
    await createSources(sources);
    await fillSources(sources);
    await asAdmin('postgres', async (c) => {
      await c.query('DROP DATABASE IF EXISTS mwendavano_monitor_test WITH (FORCE)');
      await c.query('CREATE DATABASE mwendavano_monitor_test');
    });
    const { AppModule } = await import('../app.module');
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.init();
    http = app.getHttpServer();
    ds = app.get(DataSource);
    await ds.runMigrations();

    await makeStaff('0711100001', 'Owner Mkuu', fullAccess(), { isOwner: true });
    await makeStaff('0711100002', 'View Mtu', { ...noAccess(), soko: 'view', mauzo: 'view' });
    await makeStaff('0711100003', 'Support Mtu', { ...noAccess(), mauzo: 'support', soko: 'support', wafanyakazi: 'support' });
    tokens.view = (await login('0711100002')).accessToken;
    tokens.support = (await login('0711100003')).accessToken;
    tokens.owner = (await login('0711100001')).accessToken;
  }, 120_000); // Builds three databases and, on a cold cache, compiles the whole app.

  afterAll(async () => {
    await app.close();
    rmSync(logDir, { recursive: true, force: true });
  });

  describe('no write path to the monitored databases', () => {
    const asRo = async (database: string, sql: string, options?: string) => {
      const c = new Client({ host: 'localhost', user: 'monitor_ro', password: RO_PASSWORD, database, options });
      await c.connect();
      try {
        return await c.query(sql);
      } finally {
        await c.end();
      }
    };
    it.each([
      [sources.inventory, `INSERT INTO core.buyer (phone) VALUES ('+255700111222')`],
      [sources.wafanyakazi, `UPDATE employees SET name = 'x'`],
      [sources.cargo, `DELETE FROM customers`],
      [sources.cargo, `CREATE TABLE sneaky (id int)`],
    ])('the role alone refuses a write: %s', async (db, sql) => {
      await expect(asRo(db, sql)).rejects.toThrow(/permission denied/);
    });
    it('reads work', async () => expect((await asRo(sources.cargo, 'SELECT count(*) FROM customers')).rows).toHaveLength(1));
    it("the app's own connections are read-only too", async () => {
      const s = app.get(SourcesService);
      await expect(s.query('cargo', { sql: `DELETE FROM customers` })).rejects.toThrow(/read-only transaction/);
    });
  });

  describe('sign-in', () => {
    it('needs a token', () => request(http).get('/api/overview').expect(401));
    it('health is public', () => request(http).get('/api/health').expect(200));
    it('does not say whether a phone exists', async () => {
      const a = await request(http).post('/api/auth/login').send({ phone: '0711100002', password: 'wrong-password' }).expect(401);
      const b = await request(http).post('/api/auth/login').send({ phone: '0711199999', password: 'wrong-password' }).expect(401);
      expect(a.body.message).toBe(b.body.message);
    });
    it('locks after 5 failures for 15 minutes, even with the right password', async () => {
      await makeStaff('0711100009', 'Locked Mtu', noAccess());
      for (let i = 0; i < 5; i++) await request(http).post('/api/auth/login').send({ phone: '0711100009', password: 'nope' });
      await request(http).post('/api/auth/login').send({ phone: '0711100009', password: PASSWORD }).expect(429);
    });
    it('phone and password are enough, for an Admin too', async () => {
      const r = await login('0711100001');
      expect(r.accessToken).toBeTruthy();
      expect(r.staff.isOwner).toBe(true);
    });
    it('the second-step routes are gone', async () => {
      await request(http).post('/api/auth/verify').send({ challenge: 'x', code: '123456' }).expect(404);
    });
    it('sets the refresh token only as an httpOnly cookie, and rotates it', async () => {
      await makeStaff('0711100010', 'Cookie Mtu', noAccess());
      const res = await request(http).post('/api/auth/login').send({ phone: '0711100010', password: PASSWORD }).expect(200);
      expect(res.body.refreshToken).toBeUndefined();
      const cookie = res.headers['set-cookie'][0];
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      const pair = cookie.split(';')[0];
      const next = await request(http).post('/api/auth/refresh').set('Cookie', pair).expect(200);
      expect(next.headers['set-cookie'][0].split(';')[0]).not.toBe(pair);
      await ds.query(`UPDATE sessions SET "rotatedAt" = now() - interval '5 minutes'`);
      await request(http).post('/api/auth/refresh').set('Cookie', pair).expect(401);
      await request(http).post('/api/auth/refresh').set('Cookie', next.headers['set-cookie'][0].split(';')[0]).expect(401);
    });
    it('a temporary password opens nothing until changed', async () => {
      await makeStaff('0711100011', 'Temp Mtu', fullAccess(), { mustChangePassword: true, access: { ...noAccess(), soko: 'view' } });
      const r = await login('0711100011');
      const auth = { Authorization: `Bearer ${r.accessToken}` };
      const blocked = await request(http).get('/api/overview').set(auth).expect(403);
      expect(blocked.body.error).toBe('PASSWORD_CHANGE_REQUIRED');
      await request(http).post('/api/auth/password').set(auth).send({ current: PASSWORD, next: 'short' }).expect(400);
      const ok = await request(http).post('/api/auth/password').set(auth).send({ current: PASSWORD, next: 'a-much-longer-password' }).expect(200);
      await request(http).get('/api/overview').set('Authorization', `Bearer ${ok.body.accessToken}`).expect(200);
      await request(http).get('/api/overview').set(auth).expect(401);
    });
  });

  describe('roles on the API', () => {
    const phoneDigits = /\d{4}\s*\d{3}\s*\d{3}|\+?255\d{9}/;

    it('a View user sees totals but no person, no phone', async () => {
      const r = await request(http).get('/api/users?system=soko&joined=all').set(bearer('view')).expect(200);
      expect(r.body.rows).toEqual([]);
      expect(r.body.peopleHidden).toBe(true);
      expect(r.body.totals.find((t: any) => t.system === 'soko').total).toBeGreaterThan(0);
      expect(JSON.stringify(r.body)).not.toMatch(phoneDigits);
      expect(JSON.stringify(r.body)).not.toContain('Fatuma');
    });
    it('a View user gets no sign-ups, export or reveal', async () => {
      const o = await request(http).get('/api/overview?period=30d').set(bearer('view')).expect(200);
      expect(o.body.signups).toEqual([]);
      await request(http).get('/api/users/export.csv?system=soko').set(bearer('view')).expect(403);
      await request(http).post('/api/users/soko/1/reveal-phone').set(bearer('view')).expect(403);
    });
    it('a None user cannot see that system anywhere', async () => {
      await request(http).get('/api/users?system=cargo').set(bearer('view')).expect(403);
      await request(http).get('/api/users/export.csv?system=cargo').set(bearer('view')).expect(403);
      const u = await request(http).get('/api/users?joined=all').set(bearer('view')).expect(200);
      expect(u.body.totals.map((t: any) => t.system)).toEqual(['mauzo', 'soko']);
      const s = await request(http).get('/api/systems').set(bearer('view')).expect(200);
      expect(s.body.cards.map((c: any) => c.id)).toEqual(['mauzo', 'soko', 'global']);
      expect(s.body.server).toBeNull();
      const o = await request(http).get('/api/overview').set(bearer('view')).expect(200);
      expect(o.body.kpis.map((k: any) => k.key)).toEqual(['users', 'visitors', 'shops', 'orders']);
    });
    it('Support sees people with masked phones and cannot reveal', async () => {
      const r = await request(http).get('/api/users?system=soko&joined=all').set(bearer('support')).expect(200);
      const f = r.body.rows.find((x: any) => x.name === 'Fatuma Mnunuzi');
      expect(f.phone).toBe('0713 ••• 884');
      expect(f.canReveal).toBe(false);
      expect(JSON.stringify(r.body)).not.toContain('713555884');
      await request(http).post(`/api/users/soko/${f.id}/reveal-phone`).set(bearer('support')).expect(403);
    });
    it('the CSV holds masked phones, for an Admin too, and is logged', async () => {
      const r = await request(http).get('/api/users/export.csv?system=soko&joined=all').set(bearer('owner')).expect(200);
      expect(r.text).toContain('0713 ••• 884');
      expect(r.text).not.toContain('713555884');
      expect(await ds.getRepository(ActivityLog).countBy({ action: 'export' })).toBe(1);
    });
    it('an Admin reveal returns the number and the log does not keep it', async () => {
      const list = await request(http).get('/api/users?system=soko&joined=all').set(bearer('owner')).expect(200);
      const f = list.body.rows.find((x: any) => x.name === 'Fatuma Mnunuzi');
      expect(f.phone).toBe('0713 ••• 884');
      const r = await request(http).post(`/api/users/soko/${f.id}/reveal-phone`).set(bearer('owner')).expect(200);
      expect(r.body.phone).toBe('+255713555884');
      const [row] = await ds.getRepository(ActivityLog).find({ where: { action: 'reveal_phone' } });
      expect(row.text).toContain('0713 ••• 884');
      expect(row.text).not.toContain('713555884');
    });
    it('staff pages are closed to everyone but staff managers', async () => {
      await request(http).get('/api/staff').set(bearer('support')).expect(403);
      await request(http).get('/api/activity').set(bearer('view')).expect(403);
      await request(http).post('/api/staff/invite').set(bearer('support')).send({ name: 'X', phone: '0711100050', access: {} }).expect(403);
    });
    it('a changed role applies to a token already issued', async () => {
      const s = await makeStaff('0711100020', 'Change Mtu', { ...noAccess(), cargo: 'support' });
      const t = (await login('0711100020')).accessToken;
      await request(http).get('/api/users?system=cargo').set('Authorization', `Bearer ${t}`).expect(200);
      await request(http).patch(`/api/staff/${s.id}`).set(bearer('owner')).send({ access: { ...noAccess() } }).expect(200);
      await request(http).get('/api/users?system=cargo').set('Authorization', `Bearer ${t}`).expect(403);
    });
    it('invite gives a one-time password that is never logged', async () => {
      const r = await request(http).post('/api/staff/invite').set(bearer('owner')).send({ name: 'Mpya Mtu', phone: '0711100030', jobRole: 'Sales', access: { soko: 'view' } }).expect(201);
      expect(r.body.temporaryPassword.length).toBeGreaterThan(12);
      const log = await ds.getRepository(ActivityLog).find({ where: { action: 'staff_invited' } });
      expect(JSON.stringify(log)).not.toContain(r.body.temporaryPassword);
      const first = await request(http).post('/api/auth/login').send({ phone: '0711100030', password: r.body.temporaryPassword }).expect(200);
      expect(first.body.staff.mustChangePassword).toBe(true);
    });
    it('nobody but the owner can change the owner or give Admin on Server', async () => {
      const mgr = await makeStaff('0711100040', 'Meneja Mtu', { ...noAccess(), server: 'admin' });
      const t = (await login('0711100040')).accessToken;
      const auth = { Authorization: `Bearer ${t}` };
      const owner = await ds.getRepository(Staff).findOneByOrFail({ isOwner: true });
      await request(http).patch(`/api/staff/${owner.id}`).set(auth).send({ active: false }).expect(403);
      await request(http).patch(`/api/staff/${mgr.id}`).set(auth).send({ access: fullAccess() }).expect(403);
      await request(http).post('/api/staff/invite').set(auth).send({ name: 'Y', phone: '0711100041', access: { server: 'admin' } }).expect(403);
    });
    it('filters the activity log by person', async () => {
      const viewer = await ds.getRepository(Staff).findOneByOrFail({ phone: '+255711100002' });
      const r = await request(http).get(`/api/activity?staffId=${viewer.id}`).set(bearer('owner')).expect(200);
      expect(r.body.length).toBeGreaterThan(0);
      expect(r.body.every((x: any) => x.staffId === viewer.id)).toBe(true);
    });
  });

  describe('real numbers against the real schemas', () => {
    it('leaves test data out of the user list', async () => {
      const r = await request(http).get('/api/users?joined=all&page=1').set(bearer('owner')).expect(200);
      const names = JSON.stringify(r.body.rows);
      for (const x of ['Mjaribu Test', 'App Review', 'Reviewer One', 'WALK IN KARIAKOO', 'Demo Mteja', 'Aliyefutwa']) expect(names).not.toContain(x);
      expect(r.body.failed).toEqual([]);
    });
    it('computes the system cards', async () => {
      const r = await request(http).get('/api/systems').set(bearer('owner')).expect(200);
      const stats = Object.fromEntries(r.body.cards.map((c: any) => [c.id, Object.fromEntries(c.stats.map((s: any) => [s.l, s.v]))]));
      expect(stats.cargo).toEqual({ 'In transit': '2', Arrived: '1', Customers: '9' });
      expect(stats.wafanyakazi).toEqual({ Workplaces: '1', 'Checked in': '2', Late: '1' });
      expect(stats.global).toMatchObject({ Products: '2', 'Sales today': '2', 'WhatsApp orders': '0' });
      expect(stats.mauzo).toMatchObject({ Shops: '14', Trials: '1' });
      expect(stats.soko).toMatchObject({ Buyers: '21', Messages: '1' });
    });
    it('computes every KPI', async () => {
      const r = await request(http).get('/api/overview?period=today').set(bearer('owner')).expect(200);
      expect(r.body.kpis.map((k: any) => k.key)).toEqual(['users', 'visitors', 'shops', 'orders', 'staff']);
      expect(r.body.kpis.every((k: any) => k.value !== '—' && k.trend.length === 14)).toBe(true);
      expect(r.body.kpis.find((k: any) => k.key === 'staff').trend[13]).toBe(2);
      expect(r.body.signups).toHaveLength(6);
      expect(r.body.signups[0].name).toBe('Neema Jipya');
      const w = await request(http).get('/api/overview?period=7d').set(bearer('owner')).expect(200);
      expect(w.body.kpis.find((k: any) => k.key === 'staff').value).toMatch(/%$/);
    });
    it('filters, searches and pages users', async () => {
      const by = async (q: string) => (await request(http).get(`/api/users?joined=all&${q}`).set(bearer('owner')).expect(200)).body;
      expect((await by('q=Fatuma')).total).toBe(1);
      expect((await by('q=0713555')).rows[0].name).toBe('Fatuma Mnunuzi');
      expect((await by('q=Duka%20la%20Mfano')).rows.length).toBeGreaterThan(0);
      expect((await by('type=manager')).rows.map((x: any) => x.name)).toEqual(['Rehema Meneja']);
      expect((await by('type=customer')).rows.every((x: any) => x.system === 'cargo')).toBe(true);
      const a = await by('page=1');
      expect(a.rows).toHaveLength(50);
      expect(a.total).toBeGreaterThan(50);
      const b = await by('page=2');
      expect(b.rows[0].name).not.toBe(a.rows[0].name);
    });
    it('raises trial and chat report alerts', async () => {
      const r = await request(http).get('/api/alerts').set(bearer('owner')).expect(200);
      expect(r.body.map((a: any) => a.id)).toEqual(expect.arrayContaining(['trials', 'reports']));
      const v = await request(http).get('/api/alerts').set(bearer('view')).expect(200);
      expect(v.body.every((a: any) => ['mauzo', 'soko'].includes(a.system))).toBe(true);
    });
    it('manual notes and card notes work, and are logged', async () => {
      const n = await request(http).post('/api/alerts/notes').set(bearer('support')).send({ system: 'soko', title: 'D-U-N-S pending', severity: 'warn' }).expect(201);
      await request(http).post('/api/alerts/notes').set(bearer('view')).send({ system: 'soko', title: 'Nope' }).expect(403);
      const list = await request(http).get('/api/alerts').set(bearer('owner')).expect(200);
      expect(list.body.some((a: any) => a.noteId === n.body.id)).toBe(true);
      await request(http).delete(`/api/alerts/notes/${n.body.id}`).set(bearer('support')).expect(200);
      await request(http).patch('/api/systems/soko/note').set(bearer('owner')).send({ note: 'In App Review' }).expect(200);
      await request(http).patch('/api/systems/soko/note').set(bearer('support')).send({ note: 'x' }).expect(403);
      const s = await request(http).get('/api/systems').set(bearer('owner')).expect(200);
      expect(s.body.cards.find((c: any) => c.id === 'soko').note).toBe('In App Review');
    });
  });

  describe('health checks', () => {
    it('shows a stopped service as Down with an alert after one check, and recovers', async () => {
      const checks = app.get(ChecksService);
      const overview = app.get(OverviewService);
      overview.clearCache();
      checks.probeHttp = async () => ({ status: 200, ms: 120 });
      let cargo = 'active';
      checks.probeService = async (n) => (n === 'cargo-api' ? cargo : 'active');
      await checks.tick();
      overview.clearCache();
      const card = async () => (await request(http).get('/api/systems').set(bearer('owner')).expect(200)).body.cards.find((c: any) => c.id === 'cargo');
      expect((await card()).status).toBe('Online');
      expect((await card()).uptime).toBe(100);

      expect((await card()).days).toHaveLength(30);
      expect((await card()).days[29].pct).toBe(100);

      cargo = 'inactive';
      await checks.tick();
      overview.clearCache();
      expect((await card()).status).toBe('Down');
      const alerts = await request(http).get('/api/alerts').set(bearer('owner')).expect(200);
      expect(alerts.body[0]).toMatchObject({ id: 'down:cargo', level: 'bad', detail: 'Service stopped: cargo-api' });
      expect((await card()).uptime).toBeLessThan(100);

      cargo = 'active';
      await checks.tick();
      expect((await card()).status).toBe('Online');
    });
    it('only the fixed names reach systemctl', async () => {
      const seen: string[] = [];
      const checks = app.get(ChecksService);
      checks.probeService = async (n) => {
        seen.push(n);
        return 'active';
      };
      await checks.tick();
      expect(seen.sort()).toEqual(['cargo-api', 'dukani-api', 'dukani-soko', 'nginx', 'postgresql', 'wafanyakazi-api']);
    });
    it('rolls raw checks older than 30 days into daily totals', async () => {
      const checks = app.get(ChecksService);
      const repo = ds.getRepository(UptimeCheck);
      await repo.insert([{ target: 'site:cargo', kind: 'http', ok: true, checkedAt: new Date(Date.now() - 40 * 86400_000) }, { target: 'site:cargo', kind: 'http', ok: false, checkedAt: new Date(Date.now() - 40 * 86400_000) }]);
      await checks.rollup();
      expect(await ds.query(`SELECT count(*)::int n FROM uptime_check WHERE "checkedAt" < now() - interval '30 days'`)).toEqual([{ n: 0 }]);
      expect(await ds.query(`SELECT checks, "okChecks" FROM uptime_daily`)).toEqual([{ checks: 2, okChecks: 1 }]);
    });
    it('server tiles have no SMS balance', async () => {
      const r = await request(http).get('/api/systems').set(bearer('owner')).expect(200);
      expect(r.body.server.map((t: any) => t.key)).toEqual(['api', 'db', 'disk', 'memory', 'load']);
      expect(r.body.server[0].value).toBe('120 ms');
    });
  });

  describe('visitors from nginx logs', () => {
    const UA = 'Mozilla/5.0 (iPhone) Safari/604.1';
    const time = () => new Date().toUTCString().replace(/^\w+, (\d+) (\w+) (\d+) ([\d:]+) GMT$/, '$1/$2/$3:$4 +0000');
    const line = (ip: string, path = '/', ref = '-', ua = UA) => `${ip} - - [${time()}] "GET ${path} HTTP/1.1" 200 100 "${ref}" "${ua}"\n`;
    const file = join(logDir, 'dukanisoko.com.access.log');

    it('counts people, drops bots and assets, resumes, survives rotation, keeps no IP', async () => {
      const v = app.get(VisitorsService);
      writeFileSync(file, line('41.0.0.1', '/', 'https://l.instagram.com/') + line('41.0.0.1', '/shops') + line('41.0.0.2', '/', 'https://www.google.com/') + line('66.0.0.1', '/', '-', 'Googlebot/2.1') + line('41.0.0.3', '/_nuxt/app.js') + line('41.0.0.3', '/api/market/shops'));
      await v.run();
      const row = () => ds.getRepository(VisitorDaily).findOneByOrFail({ site: 'dukanisoko.com' });
      expect(await row()).toMatchObject({ visitors: 2, pageViews: 3 });
      expect((await row()).sources).toEqual({ Instagram: 1, Direct: 1, Google: 1 });

      await v.run();
      expect((await row()).pageViews).toBe(3);

      appendFileSync(file, line('41.0.0.1', '/again') + line('41.0.0.4'));
      await v.run();
      expect(await row()).toMatchObject({ visitors: 3, pageViews: 5 });

      // A half-written line waits for the next run.
      appendFileSync(file, line('41.0.0.5').slice(0, 20));
      await v.run();
      expect((await row()).pageViews).toBe(5);
      appendFileSync(file, line('41.0.0.5').slice(20));
      await v.run();
      expect((await row()).pageViews).toBe(6);

      // logrotate moves the file with lines we have not read yet.
      appendFileSync(file, line('41.0.0.6'));
      const inode = statSync(file).ino;
      renameSync(file, `${file}.1`);
      writeFileSync(file, line('41.0.0.7'));
      expect(statSync(file).ino).not.toBe(inode);
      await v.run();
      expect(await row()).toMatchObject({ pageViews: 8 });

      const stored = JSON.stringify(await ds.query(`SELECT date, site, visitors, "pageViews", sources FROM visitor_daily`)) + JSON.stringify(await ds.getRepository(LogOffset).find());
      expect(stored).not.toMatch(/41\.0\.0/);
      const sketch = (await row()).sketch.toString('latin1');
      expect(sketch).not.toContain('41.0.0');
      expect(sketch).not.toContain('Mozilla');
    });

    it('shows on the panel by site and source', async () => {
      const r = await request(http).get('/api/visitors?days=14').set(bearer('owner')).expect(200);
      expect(r.body.sites).toEqual(['dukanisoko.com']);
      expect(r.body.days).toHaveLength(14);
      expect(r.body.days[13].counts['dukanisoko.com']).toBeGreaterThan(0);
      expect(r.body.sources[0].pct).toBeGreaterThan(0);
      await request(http).get('/api/visitors?days=9999').set(bearer('owner')).expect(400);
    });
    it('hides a site from someone with no access to its system', async () => {
      await asAdmin('mwendavano_monitor_test', (c) => c.query(`INSERT INTO visitor_daily (date, site, visitors, sketch) VALUES (CURRENT_DATE, 'cargo.mwendavano.com', 5, '\\x00')`));
      const r = await request(http).get('/api/visitors').set(bearer('view')).expect(200);
      expect(r.body.sites).not.toContain('cargo.mwendavano.com');
    });
  });

  it('records sign-ins in the activity log', async () => {
    expect(await ds.getRepository(ActivityLog).countBy({ action: 'login' })).toBeGreaterThan(3);
    expect(await ds.getRepository(ActivityLog).countBy({ action: 'login_failed' })).toBeGreaterThan(0);
  });
});
