import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createGunzip } from 'zlib';
import { createReadStream, promises as fs } from 'fs';
import { dirname, join } from 'path';
import { pipeline } from 'stream/promises';
import { Writable } from 'stream';
import { DataSource, In } from 'typeorm';
import { Actor, canSeeNumbers, SystemKey } from '../access/access';
import { eatDate, lastDays } from '../common/logic/time';
import { isProductionEnv } from '../common/security';
import { LogOffset, VisitorDaily } from '../entities';
import { GeoLookup, NetworkLookup, summarizeLocations } from './geo';
import { addVisitor, classifyReferrer, countSketch, isPageView, mergeSketch, newSketch, parseLine, SOURCES } from './log-parser';

/** One access_log per public site: see deploy/add-visitor-logs.sh. Those names are this table. */
export const SITES: { site: string; system: SystemKey }[] = [
  { site: 'dukanisoko.com', system: 'soko' },
  { site: 'dukanimauzo.com', system: 'mauzo' },
  { site: 'store.mwendavano.com', system: 'mauzo' },
  { site: 'cargo.mwendavano.com', system: 'cargo' },
  { site: 'wafanyakazi.mwendavano.com', system: 'wafanyakazi' },
  { site: 'mwendavano.com', system: 'server' },
];

interface Tally {
  sketch: Buffer;
  pageViews: number;
  sources: Record<string, number>;
  locations: Record<string, number>;
}
type Tallies = Map<string, Tally>;

/** Page loads of one browser (IP + user agent) on one day, held until the run ends so floods can be dropped. */
interface BrowserDay {
  ip: string;
  userAgent: string;
  pageViews: number;
  arrivals: { source: string; place: string | null }[];
}
/** date → "ip userAgent" → that browser's day. */
type Pending = Map<string, Map<string, BrowserDay>>;

/**
 * More page loads than this from one browser in one run (one day of history on the first read, about
 * ten minutes after that) is a script, not a person reading pages.
 */
export const FLOOD_LIMIT = 100;

/** Turns the run's browsers into the day totals, leaving out floods. */
export function settle(pending: Pending, limit = FLOOD_LIMIT): Tallies {
  const t: Tallies = new Map();
  for (const [date, browsers] of pending) {
    for (const b of browsers.values()) {
      if (b.pageViews > limit) continue;
      let day = t.get(date);
      if (!day) t.set(date, (day = { sketch: newSketch(), pageViews: 0, sources: {}, locations: {} }));
      day.pageViews += b.pageViews;
      addVisitor(day.sketch, b.ip, b.userAgent);
      for (const a of b.arrivals) {
        day.sources[a.source] = (day.sources[a.source] ?? 0) + 1;
        if (a.place) day.locations[a.place] = (day.locations[a.place] ?? 0) + 1;
      }
    }
  }
  return t;
}

/** Feeds complete lines to onLine and returns the bytes used, so a half-written last line waits for the next run. */
async function readLines(path: string, start: number, onLine: (l: string) => void): Promise<number> {
  const gz = path.endsWith('.gz');
  let rest: Buffer = Buffer.alloc(0);
  let used = 0;
  const sink = new Writable({
    write(chunk: Buffer, _e, done) {
      const buf = rest.length ? Buffer.concat([rest, chunk]) : chunk;
      let from = 0;
      for (let nl = buf.indexOf(10, from); nl !== -1; nl = buf.indexOf(10, from)) {
        onLine(buf.toString('utf8', from, nl));
        used += nl + 1 - from;
        from = nl + 1;
      }
      rest = buf.subarray(from);
      done();
    },
  });
  const src = createReadStream(path, { start: gz ? 0 : start });
  if (gz) await pipeline(src, createGunzip(), sink);
  else await pipeline(src, sink);
  return used;
}

const stat = (p: string) => fs.stat(p).catch(() => null);

@Injectable()
export class VisitorsService {
  private readonly log = new Logger(VisitorsService.name);
  private running = false;
  private readonly geo = new GeoLookup();
  private readonly networks = new NetworkLookup();

  constructor(private readonly ds: DataSource) {}

  private get logDir() {
    return process.env.NGINX_LOG_DIR || '/var/log/nginx';
  }
  private get enabled() {
    return process.env.VISITOR_PARSER_ENABLED ? process.env.VISITOR_PARSER_ENABLED === 'true' : isProductionEnv();
  }

  @Cron('*/10 * * * *')
  async scheduled() {
    if (this.enabled) await this.run().catch((e) => this.log.error(`Visitor parser failed: ${e?.message ?? e}`));
  }

  async run() {
    if (this.running) return;
    this.running = true;
    try {
      await this.geo.refresh();
      await this.networks.refresh();
      for (const { site } of SITES) await this.processSite(site);
    } finally {
      this.running = false;
    }
  }

  private consume(line: string, site: string, p: Pending) {
    const l = parseLine(line);
    if (!l || !isPageView(l)) return;
    // A data centre is a server calling itself a browser: crawlers, scanners, uptime checks.
    if (this.networks.isHosting(l.ip)) return;
    const date = eatDate(l.time);
    let browsers = p.get(date);
    if (!browsers) p.set(date, (browsers = new Map()));
    const key = `${l.ip} ${l.userAgent}`;
    let b = browsers.get(key);
    if (!b) browsers.set(key, (b = { ip: l.ip, userAgent: l.userAgent, pageViews: 0, arrivals: [] }));
    b.pageViews++;
    const source = classifyReferrer(l.referrer, site);
    if (!source) return;
    // Arrivals, like sources: clicking around inside a site does not make one person count as many.
    b.arrivals.push({ source, place: this.geo.place(l.ip) });
  }

  /** logrotate: x.log → x.log.1 → x.log.2.gz. The whole history is read once, on the first run. */
  private async processSite(site: string) {
    const live = join(this.logDir, `${site}.access.log`);
    const st = await stat(live);
    if (!st) return;
    const repo = this.ds.getRepository(LogOffset);
    const row = await repo.findOne({ where: { path: live } });
    const p: Pending = new Map();
    let offset = row ? Number(row.offset) : 0;
    const inode = String(st.ino);
    const rotated = `${live}.1`;

    if (!row) {
      for (const old of await this.rotatedFiles(live)) await readLines(old, 0, (l) => this.consume(l, site, p));
    } else if (row.inode !== inode) {
      // Rotated since the last run: finish the old file first, or the tail of it is lost.
      const prev = await stat(rotated);
      if (prev && String(prev.ino) === row.inode) await readLines(rotated, offset, (l) => this.consume(l, site, p));
      offset = 0;
    } else if (st.size < offset) {
      offset = 0;
    }
    offset += await readLines(live, offset, (l) => this.consume(l, site, p));
    await this.save(site, settle(p), live, inode, offset);
  }

  private async rotatedFiles(live: string): Promise<string[]> {
    const dir = dirname(live);
    const base = live.slice(dir.length + 1);
    const names = await fs.readdir(dir).catch(() => [] as string[]);
    const order = (n: string) => Number(/\.(\d+)(\.gz)?$/.exec(n)?.[1] ?? 0);
    return names
      .filter((n) => n.startsWith(`${base}.`) && /\.\d+(\.gz)?$/.test(n))
      .sort((a, b) => order(b) - order(a))
      .map((n) => join(dir, n));
  }

  /** Counts and the file position commit together, so a crash can neither lose nor double-count a run. */
  private async save(site: string, tallies: Tallies, path: string, inode: string, offset: number) {
    await this.ds.transaction(async (m) => {
      for (const [date, t] of tallies) {
        const row = await m.findOne(VisitorDaily, { where: { date, site }, lock: { mode: 'pessimistic_write' } });
        const sketch = row ? Buffer.from(row.sketch) : newSketch();
        mergeSketch(sketch, t.sketch);
        const sources = { ...(row?.sources ?? {}) };
        for (const [k, v] of Object.entries(t.sources)) sources[k] = (sources[k] ?? 0) + v;
        const locations = { ...(row?.locations ?? {}) };
        for (const [k, v] of Object.entries(t.locations)) locations[k] = (locations[k] ?? 0) + v;
        await m.save(VisitorDaily, { date, site, sketch, sources, locations, visitors: countSketch(sketch), pageViews: (row?.pageViews ?? 0) + t.pageViews });
      }
      await m.save(LogOffset, { path, inode, offset: String(offset), updatedAt: new Date() });
    });
  }

  private sitesFor(a: Actor) {
    return SITES.filter((s) => canSeeNumbers(a, s.system)).map((s) => s.site);
  }

  async totals(a: Actor, days: string[]): Promise<number | null> {
    const sites = this.sitesFor(a);
    if (!sites.length) return null;
    const [r] = await this.ds.getRepository(VisitorDaily).createQueryBuilder('v').select('coalesce(sum(v.visitors), 0)', 'n').where('v.date IN (:...days) AND v.site IN (:...sites)', { days, sites }).getRawMany();
    return Number(r.n);
  }

  async report(a: Actor, nDays: number) {
    const days = lastDays(nDays);
    const sites = this.sitesFor(a);
    const rows = sites.length ? await this.ds.getRepository(VisitorDaily).find({ where: { date: In(days), site: In(sites) }, select: { date: true, site: true, visitors: true, sources: true, locations: true } }) : [];
    const seen = sites.filter((s) => rows.some((r) => r.site === s));
    const sum: Record<string, number> = {};
    for (const r of rows) for (const [k, v] of Object.entries(r.sources)) sum[k] = (sum[k] ?? 0) + v;
    const all = Object.values(sum).reduce((x, y) => x + y, 0);
    const places: Record<string, number> = {};
    for (const r of rows) for (const [k, v] of Object.entries(r.locations)) places[k] = (places[k] ?? 0) + v;
    return {
      locations: summarizeLocations(places),
      sites: seen,
      days: days.map((date) => ({ date, counts: Object.fromEntries(seen.map((s) => [s, rows.find((r) => r.date === date && r.site === s)?.visitors ?? 0])) })),
      sources: all ? SOURCES.map((name) => ({ name, pct: Math.round(((sum[name] ?? 0) / all) * 100) })).filter((s) => s.pct > 0).sort((x, y) => y.pct - x.pct) : [],
    };
  }
}
