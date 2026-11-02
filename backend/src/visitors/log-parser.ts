import { createHash } from 'crypto';

/** Pure parsing and counting for nginx "combined" access logs. Nothing here keeps an IP. */
export interface LogLine {
  ip: string;
  time: Date;
  method: string;
  path: string;
  status: number;
  referrer: string;
  userAgent: string;
}

const LINE = /^(\S+) \S+ \S+ \[([^\]]+)\] "([A-Z]+) (\S+)[^"]*" (\d{3}) \S+ "((?:[^"\\]|\\.)*)" "((?:[^"\\]|\\.)*)"/;
const MONTHS: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

export function parseLine(line: string): LogLine | null {
  const m = LINE.exec(line);
  if (!m) return null;
  const t = /^(\d{2})\/(\w{3})\/(\d{4}):(\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/.exec(m[2]);
  if (!t || !MONTHS[t[2]]) return null;
  const time = new Date(`${t[3]}-${MONTHS[t[2]]}-${t[1]}T${t[4]}${t[5]}:${t[6]}`);
  if (Number.isNaN(time.getTime())) return null;
  return { ip: m[1], time, method: m[3], path: m[4], status: Number(m[5]), referrer: m[6], userAgent: m[7] };
}

const BOT = /bot|crawl|spider|preview|slurp|facebookexternalhit|whatsapp|headless|lighthouse|monitor|curl|wget|python-|go-http|okhttp|axios|node-fetch/i;
export const isBot = (ua: string) => !ua || ua === '-' || BOT.test(ua);

const STATIC = /\.(?:js|mjs|css|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|eot|otf|mp4|webm|pdf|zip|apk|txt|xml|json|webmanifest)$/i;
const NOT_PAGE = /^\/(?:api|_nuxt|__nuxt|assets|_ipx|uploads|download|\.well-known)(?:\/|$)/i;

export function isStaticOrApi(path: string): boolean {
  const p = path.split(/[?#]/)[0];
  return STATIC.test(p) || NOT_PAGE.test(p);
}

/** A person loading a page: a good GET of something that is not an asset or an API call. */
export const isPageView = (l: LogLine) => l.method === 'GET' && (l.status === 200 || l.status === 304) && !isStaticOrApi(l.path) && !isBot(l.userAgent);

export const SOURCES = ['Instagram', 'Google', 'WhatsApp', 'Facebook', 'Direct', 'Other'] as const;
export type Source = (typeof SOURCES)[number];

/** null = moving around inside the same site, which is not an arrival. */
export function classifyReferrer(referrer: string, siteHost: string): Source | null {
  const r = referrer.trim();
  if (!r || r === '-') return 'Direct';
  const host = (/^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(r)?.[1] ?? r).toLowerCase().replace(/:\d+$/, '');
  const bare = siteHost.toLowerCase().replace(/^www\./, '');
  if (host === bare || host.endsWith(`.${bare}`)) return null;
  if (/(^|\.)instagram\.com$|^ig\.me$|com\.instagram\.android/.test(host)) return 'Instagram';
  if (/(^|\.)google(\.[a-z]{2,3}){1,2}$|com\.google\.android/.test(host)) return 'Google';
  if (/(^|\.)whatsapp\.com$|^wa\.me$|com\.whatsapp/.test(host)) return 'WhatsApp';
  if (/(^|\.)facebook\.com$|^fb\.me$|(^|\.)fb\.com$|com\.facebook/.test(host)) return 'Facebook';
  return 'Other';
}

/**
 * HyperLogLog: counts distinct visitors across runs and restarts while storing no IP, no user agent
 * and no per-visitor hash, only 4,096 small registers (error about 1.6%).
 */
const P = 12;
const M = 1 << P;
const ALPHA = 0.7213 / (1 + 1.079 / M);

export const newSketch = () => Buffer.alloc(M);

export function addVisitor(sketch: Buffer, ip: string, userAgent: string) {
  const h = createHash('sha1').update(`${ip}|${userAgent}`).digest();
  const idx = h.readUInt16BE(0) >>> (16 - P);
  const rest = h.readBigUInt64BE(2);
  const rank = rest === 0n ? 65 : 65 - rest.toString(2).length;
  if (rank > sketch[idx]) sketch[idx] = rank;
}

export function mergeSketch(into: Buffer, from: Buffer) {
  for (let i = 0; i < M; i++) if (from[i] > into[i]) into[i] = from[i];
}

export function countSketch(sketch: Buffer): number {
  let sum = 0;
  let zeros = 0;
  for (let i = 0; i < M; i++) {
    sum += 2 ** -sketch[i];
    if (sketch[i] === 0) zeros++;
  }
  const raw = (ALPHA * M * M) / sum;
  return Math.round(raw <= 2.5 * M && zeros ? M * Math.log(M / zeros) : raw);
}
