import { Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import maxmind, { CityResponse, Reader } from 'maxmind';

/**
 * Turns an IP into a place using a database file on this server (see deploy/update-geoip.sh), so no
 * visitor's IP is ever sent anywhere. Only the place name is kept: the IP goes no further than this.
 */
const UNKNOWN = 'Unknown';

export const DEFAULT_GEOIP_DB = '/var/lib/mwendavano-monitor/dbip-city-lite.mmdb';

/** A place, as stored in visitor_daily.locations: "Tanzania|Dar es Salaam". The city may be empty. */
export function locationKey(record: CityResponse | null | undefined): string {
  const country = record?.country?.names?.en ?? UNKNOWN;
  return `${country.replace(/\|/g, ' ')}|${(record?.city?.names?.en ?? '').replace(/\|/g, ' ')}`;
}

export function splitLocation(key: string): { country: string; city: string } {
  const [country, city = ''] = key.split('|');
  return { country, city };
}

/** Largest first; the rest of the list is left out, so shares need not add up to 100. */
function top(counts: Map<string, number>, limit: number) {
  const all = [...counts.values()].reduce((x, y) => x + y, 0);
  return [...counts]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, n]) => ({ name, n, pct: Math.round((n / all) * 100) }));
}

export function summarizeLocations(locations: Record<string, number>, limit = 6) {
  const countries = new Map<string, number>();
  const cities = new Map<string, number>();
  for (const [key, n] of Object.entries(locations)) {
    const { country, city } = splitLocation(key);
    if (country === UNKNOWN) continue;
    countries.set(country, (countries.get(country) ?? 0) + n);
    if (city) cities.set(`${city}, ${country}`, (cities.get(`${city}, ${country}`) ?? 0) + n);
  }
  return { countries: top(countries, limit), cities: top(cities, limit) };
}

export class GeoLookup {
  private readonly log = new Logger(GeoLookup.name);
  private reader: Reader<CityResponse> | null = null;
  private loadedAt = 0;
  private warned = false;

  private get path() {
    return process.env.GEOIP_DB || DEFAULT_GEOIP_DB;
  }

  /** Call before a run: opens the file, and again after the monthly update replaces it. */
  async refresh() {
    const st = await fs.stat(this.path).catch(() => null);
    if (!st) {
      this.reader = null;
      if (!this.warned) this.log.warn(`No location database at ${this.path}: visits are counted without a place`);
      this.warned = true;
      return;
    }
    if (this.reader && st.mtimeMs === this.loadedAt) return;
    try {
      this.reader = await maxmind.open<CityResponse>(this.path);
      this.loadedAt = st.mtimeMs;
    } catch (e: any) {
      this.reader = null;
      this.log.error(`Could not open ${this.path}: ${e?.message ?? e}`);
    }
  }

  /** null when there is no database or the address cannot be looked up, so nothing is counted for it. */
  place(ip: string): string | null {
    if (!this.reader || !maxmind.validate(ip)) return null;
    return locationKey(this.reader.get(ip));
  }
}
