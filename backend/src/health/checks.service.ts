import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { execFile } from 'child_process';
import { promises as fs } from 'fs';
import * as os from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { isProductionEnv } from '../common/security';
import { UptimeCheck } from '../entities';
import { Card, CARDS, cardStatus, DISK_BAD, HTTP_TARGETS, levelFor, MEMORY_BAD, Recent, ServiceName, SERVICES, Status, svc, Tile } from './targets';

const HTTP_TIMEOUT_MS = 5_000;
const RAW_DAYS = 30;
const GB = 1024 ** 3;
const gb = (n: number) => (n / GB).toFixed(n / GB >= 100 ? 0 : 1);

export type ProbeHttp = (url: string) => Promise<{ status: number | null; ms: number }>;
/** 'active', another systemctl state, or null when systemctl does not exist on this machine. */
export type ProbeService = (name: ServiceName) => Promise<string | null>;

const run = (cmd: string, args: string[]) =>
  new Promise<string | null>((resolve) => {
    execFile(cmd, args, { timeout: 5_000 }, (err, stdout) => {
      if ((err as NodeJS.ErrnoException | null)?.code === 'ENOENT') return resolve(null);
      resolve(String(stdout).trim());
    });
  });

@Injectable()
export class ChecksService {
  private readonly log = new Logger(ChecksService.name);
  private running = false;
  private deployCache: { at: number; dates: Map<string, string | null> } | null = null;

  /** Overridden in tests. */
  probeHttp: ProbeHttp = async (url) => {
    const t = Date.now();
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(HTTP_TIMEOUT_MS), redirect: 'follow', headers: { 'User-Agent': 'MwendavanoMonitor/1.0 bot' } });
      await res.arrayBuffer().catch(() => undefined);
      return { status: res.status, ms: Date.now() - t };
    } catch {
      return { status: null, ms: Date.now() - t };
    }
  };
  probeService: ProbeService = (name) => run('systemctl', ['is-active', name]);

  constructor(private readonly ds: DataSource) {}

  get enabled() {
    return process.env.HEALTH_CHECKS_ENABLED ? process.env.HEALTH_CHECKS_ENABLED === 'true' : isProductionEnv();
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async scheduled() {
    if (this.enabled) await this.tick().catch((e) => this.log.error(`Health check failed: ${e?.message ?? e}`));
  }

  /** Daily, 02:30 in Dar: rolls raw checks older than 30 days into uptime_daily. */
  @Cron('30 23 * * *')
  async scheduledRollup() {
    if (this.enabled) await this.rollup().catch((e) => this.log.error(`Roll-up failed: ${e?.message ?? e}`));
  }

  async tick(now: Date = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const rows: Partial<UptimeCheck>[] = [];
      await Promise.all([
        ...HTTP_TARGETS.map(async (t) => {
          const r = await this.probeHttp(t.url);
          rows.push({ target: t.id, kind: 'http', ok: r.status !== null && r.status < 400, statusCode: r.status, responseMs: r.ms, checkedAt: now });
        }),
        ...SERVICES.map(async (s) => {
          const state = await this.probeService(s);
          if (state !== null) rows.push({ target: svc(s), kind: 'service', ok: state === 'active', statusCode: null, responseMs: null, checkedAt: now });
        }),
      ]);
      await this.ds.getRepository(UptimeCheck).insert(rows as UptimeCheck[]);
    } finally {
      this.running = false;
    }
  }

  async rollup() {
    await this.ds.transaction(async (m) => {
      const cutoff = `now() - interval '${RAW_DAYS} days'`;
      await m.query(`INSERT INTO uptime_daily (date, target, checks, "okChecks", "avgMs")
        SELECT ("checkedAt" AT TIME ZONE 'Africa/Dar_es_Salaam')::date, target, count(*), count(*) FILTER (WHERE ok), avg("responseMs")::int
          FROM uptime_check WHERE "checkedAt" < ${cutoff} GROUP BY 1, 2
        ON CONFLICT (date, target) DO UPDATE SET checks = uptime_daily.checks + EXCLUDED.checks, "okChecks" = uptime_daily."okChecks" + EXCLUDED."okChecks", "avgMs" = EXCLUDED."avgMs"`);
      await m.query(`DELETE FROM uptime_check WHERE "checkedAt" < ${cutoff}`);
    });
  }

  /** Checks older than 10 minutes do not count: if the scheduler dies, the panel says No data, not Online. */
  async recent(): Promise<{ recent: Recent; lastCheckAt: Date | null }> {
    const rows: { target: string; ok: boolean; checkedAt: Date }[] = await this.ds.query(`SELECT target, ok, "checkedAt" FROM (
        SELECT target, ok, "checkedAt", row_number() OVER (PARTITION BY target ORDER BY "checkedAt" DESC) n
        FROM uptime_check WHERE "checkedAt" > now() - interval '10 minutes') t WHERE n <= 2 ORDER BY target, n`);
    const recent: Recent = new Map();
    let lastCheckAt: Date | null = null;
    for (const r of rows) {
      recent.set(r.target, [...(recent.get(r.target) ?? []), r.ok]);
      if (!lastCheckAt || r.checkedAt > lastCheckAt) lastCheckAt = r.checkedAt;
    }
    return { recent, lastCheckAt };
  }

  /** target → uptime % over the last 30 days. */
  async uptime(): Promise<Map<string, number>> {
    const rows: { target: string; pct: string }[] = await this.ds.query(`SELECT target, 100.0 * count(*) FILTER (WHERE ok) / count(*) AS pct FROM uptime_check WHERE "checkedAt" > now() - interval '${RAW_DAYS} days' GROUP BY target`);
    return new Map(rows.map((r) => [r.target, Number(r.pct)]));
  }

  /** A card is only as available as its weakest part. */
  cardUptime(card: Card, uptime: Map<string, number>): number | null {
    const v = [...card.http, ...card.services.map(svc)].map((t) => uptime.get(t)).filter((x): x is number => x !== undefined);
    return v.length ? Math.min(...v) : null;
  }

  statuses(recent: Recent): Map<string, Status> {
    return new Map(CARDS.map((c) => [c.id, cardStatus(c, recent)]));
  }

  /** git date of the deployed checkout. Cargo and others deploy by rsync with no .git, so then the build folder's date. */
  async deployDates(): Promise<Map<string, string | null>> {
    if (this.deployCache && Date.now() - this.deployCache.at < 5 * 60_000) return this.deployCache.dates;
    const dates = new Map<string, string | null>();
    await Promise.all(
      CARDS.map(async (c) => {
        const git = await run('git', ['-c', 'safe.directory=*', '-C', c.appDir, 'log', '-1', '--format=%cI']);
        if (git && /^\d{4}-/.test(git)) return dates.set(c.id, git);
        const st = await fs.stat(join(c.appDir, c.buildDir)).catch(() => null);
        return dates.set(c.id, st ? st.mtime.toISOString() : null);
      }),
    );
    this.deployCache = { at: Date.now(), dates };
    return dates;
  }

  async server(): Promise<{ tiles: Tile[]; disk: number | null; memory: number }> {
    const [conn] = await this.ds.query(`SELECT (SELECT count(*) FROM pg_stat_activity)::int AS used, current_setting('max_connections')::int AS max`);
    const [api] = await this.ds.query(`SELECT avg("responseMs")::int AS ms FROM uptime_check WHERE target = 'api:dukani' AND ok AND "checkedAt" > now() - interval '1 hour'`);
    const st = await fs.statfs('/').catch(() => null);
    const total = os.totalmem();
    const memory = Math.round(((total - os.freemem()) / total) * 100);
    const tiles: Tile[] = [];
    tiles.push(api?.ms != null
      ? { key: 'api', name: 'API (dukani-api)', value: `${api.ms} ms`, pct: Math.min(100, Math.round(api.ms / 20)), note: 'Average response, last hour', level: levelFor(api.ms, 800, 2000) }
      : { key: 'api', name: 'API (dukani-api)', value: 'No data', pct: 0, note: 'No successful checks in the last hour', level: 'warn' });
    const dbPct = Math.round((conn.used / conn.max) * 100);
    tiles.push({ key: 'db', name: 'Database', value: `${conn.used} / ${conn.max}`, pct: dbPct, note: 'Connections in use', level: levelFor(dbPct, 70, 90) });
    let disk: number | null = null;
    if (st) {
      const size = st.blocks * st.bsize;
      const used = size - st.bavail * st.bsize;
      disk = Math.round((used / size) * 100);
      tiles.push({ key: 'disk', name: 'Disk', value: `${disk}%`, pct: disk, note: `${gb(used)} GB of ${gb(size)} GB`, level: levelFor(disk, 70, DISK_BAD) });
    }
    tiles.push({ key: 'memory', name: 'Memory', value: `${memory}%`, pct: memory, note: `${gb(total - os.freemem())} GB of ${gb(total)} GB`, level: levelFor(memory, 70, MEMORY_BAD) });
    const cores = os.cpus().length || 1;
    const load = os.loadavg()[0];
    const loadPct = Math.min(100, Math.round((load / cores) * 100));
    tiles.push({ key: 'load', name: 'Load', value: load.toFixed(2), pct: loadPct, note: `1-minute average, ${cores} cores`, level: levelFor(loadPct, 70, 100) });
    return { tiles, disk, memory };
  }
}
