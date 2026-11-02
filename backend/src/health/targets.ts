import { SystemKey } from '../access/access';

/** systemctl only ever sees these literals. Nothing from a request reaches it. */
export const SERVICES = ['dukani-api', 'dukani-store', 'wafanyakazi-api', 'cargo-api', 'nginx', 'postgresql'] as const;
export type ServiceName = (typeof SERVICES)[number];

export const HTTP_TARGETS: { id: string; url: string }[] = [
  { id: 'site:mauzo', url: 'https://dukanimauzo.com' },
  { id: 'site:soko', url: 'https://dukanisoko.com' },
  { id: 'site:wafanyakazi', url: 'https://wafanyakazi.mwendavano.com' },
  { id: 'site:cargo', url: 'https://cargo.mwendavano.com' },
  { id: 'site:store', url: 'https://store.mwendavano.com' },
  // dukani-api has no health route, so this is its cheapest public GET.
  { id: 'api:dukani', url: 'https://business.mwendavano.com/market/shops?limit=1' },
  { id: 'api:wafanyakazi', url: 'https://wafanyakazi.mwendavano.com/api/health' },
  { id: 'api:cargo', url: 'https://cargo.mwendavano.com/api/health' },
];

export const svc = (name: ServiceName) => `service:${name}`;

export interface Card {
  id: string;
  name: string;
  domain: string;
  initials: string;
  /** Whose access level decides who sees this card. */
  system: SystemKey;
  http: string[];
  services: ServiceName[];
  appDir: string;
  buildDir: string;
}

export const CARDS: Card[] = [
  { id: 'mauzo', name: 'Dukani Mauzo', domain: 'dukanimauzo.com · shops and sales', initials: 'DM', system: 'mauzo', http: ['site:mauzo', 'api:dukani'], services: ['dukani-api'], appDir: '/var/www/inventory-management-backend', buildDir: 'dist' },
  { id: 'soko', name: 'Dukani Soko', domain: 'dukanisoko.com · marketplace', initials: 'DS', system: 'soko', http: ['site:soko', 'api:dukani'], services: ['dukani-api', 'dukani-store'], appDir: '/var/www/ecommerce-store-front', buildDir: '.output' },
  { id: 'wafanyakazi', name: 'Dukani Wafanyakazi', domain: 'Staff attendance and pay', initials: 'DW', system: 'wafanyakazi', http: ['site:wafanyakazi', 'api:wafanyakazi'], services: ['wafanyakazi-api'], appDir: '/var/www/dukani-wafanyakazi', buildDir: 'backend/dist' },
  { id: 'cargo', name: 'Mwendavano Cargo', domain: 'Shipments Dubai to Dar', initials: 'MC', system: 'cargo', http: ['site:cargo', 'api:cargo'], services: ['cargo-api'], appDir: '/var/www/mwendavano-cargo', buildDir: 'backend/dist' },
  { id: 'global', name: 'Global Authentics TZ', domain: 'store.mwendavano.com · our own shop', initials: 'GA', system: 'mauzo', http: ['site:store', 'api:dukani'], services: ['dukani-api'], appDir: '/var/www/inventory-management-backend', buildDir: 'dist' },
];

export type Status = 'Online' | 'Degraded' | 'Down' | 'No data';
/** Newest first; at most the last two per target. */
export type Recent = Map<string, boolean[]>;

/**
 * - A stopped service is Down at once: systemctl does not flap.
 * - One failed web check is only Degraded (a blip); two in a row on every web target is Down.
 *   With checks each minute, both reach the panel within 2 minutes.
 */
export function cardStatus(card: Pick<Card, 'http' | 'services'>, recent: Recent): Status {
  const known = [...card.http, ...card.services.map(svc)].filter((t) => recent.get(t)?.length);
  if (!known.length) return 'No data';
  if (card.services.some((s) => recent.get(svc(s))?.[0] === false)) return 'Down';
  const http = card.http.filter((t) => recent.get(t)?.length);
  if (http.length && http.every((t) => recent.get(t)!.length >= 2 && recent.get(t)!.slice(0, 2).every((ok) => !ok))) return 'Down';
  if (http.some((t) => recent.get(t)![0] === false)) return 'Degraded';
  return 'Online';
}

export interface Tile {
  key: string;
  name: string;
  value: string;
  pct: number;
  note: string;
  level: 'ok' | 'warn' | 'bad';
}

export const DISK_BAD = 80;
export const MEMORY_BAD = 85;
export const levelFor = (v: number, warn: number, bad: number): Tile['level'] => (v >= bad ? 'bad' : v >= warn ? 'warn' : 'ok');
