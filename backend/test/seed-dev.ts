/**
 * Local development data: made-up source databases plus uptime and visitor history.
 * Never touches production. `npm run seed:dev`, then `npm run seed:owner -- --phone … --name …`.
 */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { dbOptions } from '../src/db-options';
import { ManualNote, Staff, SystemNote, UptimeCheck, VisitorDaily } from '../src/entities';
import { HTTP_TARGETS, SERVICES, svc } from '../src/health/targets';
import { lastDays } from '../src/common/logic/time';
import { addVisitor, countSketch, newSketch } from '../src/visitors/log-parser';
import { SITES } from '../src/visitors/visitors.service';
import { createSources, fillSources } from './sources-setup';

dotenv.config({ quiet: true } as any);

const names = { inventory: 'monitor_dev_inventory', wafanyakazi: 'monitor_dev_wafanyakazi', cargo: 'monitor_dev_cargo' };

async function main() {
  if (process.env.NODE_ENV === 'production') throw new Error('Development seed only');
  await createSources(names);
  await fillSources(names, 5);

  const ds = await new DataSource({ ...dbOptions(), migrationsRun: true }).initialize();
  const checks: Partial<UptimeCheck>[] = [];
  const now = Date.now();
  const targets = [...HTTP_TARGETS.map((t) => ({ id: t.id, kind: 'http' as const })), ...SERVICES.map((s) => ({ id: svc(s), kind: 'service' as const }))];
  for (const t of targets) {
    for (let m = 0; m < 120; m++) checks.push({ target: t.id, kind: t.kind, ok: true, statusCode: t.kind === 'http' ? 200 : null, responseMs: t.kind === 'http' ? 90 + (m * 7) % 110 : null, checkedAt: new Date(now - m * 60_000) });
    // Thirty days of history, one point an hour, with two made-up outages for the strips.
    for (let h = 3; h < 29 * 24; h++) {
      const day = Math.floor(h / 24);
      const ok = !(t.id === 'site:cargo' && day === 11 && h % 24 < 3) && !(t.id === 'site:soko' && day === 4 && h % 24 === 0);
      checks.push({ target: t.id, kind: t.kind, ok, statusCode: t.kind === 'http' ? (ok ? 200 : 502) : null, responseMs: t.kind === 'http' ? 140 : null, checkedAt: new Date(now - h * 3600_000) });
    }
  }
  await ds.getRepository(UptimeCheck).clear();
  for (let i = 0; i < checks.length; i += 1000) await ds.getRepository(UptimeCheck).insert(checks.slice(i, i + 1000) as UptimeCheck[]);

  const days = lastDays(14);
  const rows: Partial<VisitorDaily>[] = [];
  SITES.slice(0, 2).forEach(({ site }, s) => {
    days.forEach((date, d) => {
      const sketch = newSketch();
      const n = (s === 0 ? 300 : 170) + d * (s === 0 ? 20 : 8) + ((d * 37) % 50);
      for (let i = 0; i < n; i++) addVisitor(sketch, `made-up-${site}-${date}-${i}`, 'seed');
      rows.push({ date, site, sketch, visitors: countSketch(sketch), pageViews: n * 3, sources: { Instagram: n * 0.46, Google: n * 0.22, WhatsApp: n * 0.18, Direct: n * 0.09, Facebook: n * 0.05 } });
    });
  });
  await ds.getRepository(VisitorDaily).save(rows as VisitorDaily[]);

  await ds.getRepository(SystemNote).save({ card: 'wafanyakazi', note: 'In App Review', updatedByName: 'Seed', updatedAt: new Date() });
  if (!(await ds.getRepository(ManualNote).count())) await ds.getRepository(ManualNote).insert({ system: 'soko', title: 'Soko privacy page not live yet', detail: 'Example of a note staff can add', severity: 'warn', createdById: 0, createdByName: 'Seed' });
  console.log(`Local data ready. ${await ds.getRepository(Staff).count()} staff.`);
  await ds.destroy();
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
