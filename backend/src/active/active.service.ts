import { Injectable } from '@nestjs/common';
import { Actor, canSeeNumbers, PeopleSystem } from '../access/access';
import { SourcesService } from '../sources/sources.service';

const TZ_DAY = `(now() AT TIME ZONE 'Africa/Dar_es_Salaam')::date`;

export interface ActiveCounts {
  system: PeopleSystem;
  /** 'activity' = one row per person per day (exact); 'last-login' = only each person's latest login (Cargo). */
  source: 'activity' | 'last-login';
  available: boolean;
  today: number;
  d7: number;
  d30: number;
  /** Last 14 days, people per day (activity sources only). */
  byDay: { day: string; count: number }[];
  since: string | null;
}

const empty = (system: PeopleSystem, source: ActiveCounts['source']): ActiveCounts => ({ system, source, available: false, today: 0, d7: 0, d30: 0, byDay: [], since: null });

/** Read-only SELECTs: who actually used each system (Mwendavano platform staff left out). */
export const activeSql = {
  /** Dukani: kind 'staff' = Mauzo (owners and staff), 'buyer' = Soko. */
  dukani: (kind: 'staff' | 'buyer') => ({
    sql: `SELECT count(DISTINCT subject_id) FILTER (WHERE day = ${TZ_DAY})::int AS today,
                 count(DISTINCT subject_id) FILTER (WHERE day > ${TZ_DAY} - 7)::int AS d7,
                 count(DISTINCT subject_id) FILTER (WHERE day > ${TZ_DAY} - 30)::int AS d30,
                 to_char(min(day), 'YYYY-MM-DD') AS since
            FROM core.activity_day WHERE kind = $1 AND NOT is_platform`,
    params: [kind],
  }),
  dukaniByDay: (kind: 'staff' | 'buyer') => ({
    sql: `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(DISTINCT a.subject_id)::int AS count
            FROM generate_series(${TZ_DAY} - 13, ${TZ_DAY}, '1 day') d
            LEFT JOIN core.activity_day a ON a.day = d AND a.kind = $1 AND NOT a.is_platform
           GROUP BY d ORDER BY d`,
    params: [kind],
  }),
  wafanyakazi: {
    sql: `SELECT count(DISTINCT subject_id) FILTER (WHERE day = ${TZ_DAY})::int AS today,
                 count(DISTINCT subject_id) FILTER (WHERE day > ${TZ_DAY} - 7)::int AS d7,
                 count(DISTINCT subject_id) FILTER (WHERE day > ${TZ_DAY} - 30)::int AS d30,
                 to_char(min(day), 'YYYY-MM-DD') AS since
            FROM activity_day`,
    params: [] as unknown[],
  },
  wafanyakaziByDay: {
    sql: `SELECT to_char(d, 'YYYY-MM-DD') AS day, count(DISTINCT a.subject_id)::int AS count
            FROM generate_series(${TZ_DAY} - 13, ${TZ_DAY}, '1 day') d
            LEFT JOIN activity_day a ON a.day = d
           GROUP BY d ORDER BY d`,
    params: [] as unknown[],
  },
  /** Cargo keeps only each user's latest login, so 7 and 30 days count people whose last login falls in that window. */
  cargo: {
    sql: `SELECT count(*) FILTER (WHERE ("lastLoginAt" AT TIME ZONE 'Africa/Dar_es_Salaam')::date = ${TZ_DAY})::int AS today,
                 count(*) FILTER (WHERE "lastLoginAt" > now() - interval '7 days')::int AS d7,
                 count(*) FILTER (WHERE "lastLoginAt" > now() - interval '30 days')::int AS d30,
                 NULL AS since
            FROM users`,
    params: [] as unknown[],
  },
};

@Injectable()
export class ActiveService {
  constructor(private readonly sources: SourcesService) {}

  async report(a: Actor): Promise<ActiveCounts[]> {
    const jobs: Promise<ActiveCounts>[] = [];
    const fill = (base: ActiveCounts, row: any, byDay: any[] | null): ActiveCounts =>
      row ? { ...base, available: true, today: row.today ?? 0, d7: row.d7 ?? 0, d30: row.d30 ?? 0, since: row.since ?? null, byDay: byDay ?? [] } : base;
    for (const kind of ['staff', 'buyer'] as const) {
      const system: PeopleSystem = kind === 'staff' ? 'mauzo' : 'soko';
      if (!canSeeNumbers(a, system)) continue;
      jobs.push(
        Promise.all([this.sources.tryQuery('inventory', activeSql.dukani(kind)), this.sources.tryQuery('inventory', activeSql.dukaniByDay(kind))]).then(([r, d]) =>
          fill(empty(system, 'activity'), r?.[0], d),
        ),
      );
    }
    if (canSeeNumbers(a, 'wafanyakazi'))
      jobs.push(
        Promise.all([this.sources.tryQuery('wafanyakazi', activeSql.wafanyakazi), this.sources.tryQuery('wafanyakazi', activeSql.wafanyakaziByDay)]).then(([r, d]) =>
          fill(empty('wafanyakazi', 'activity'), r?.[0], d),
        ),
      );
    if (canSeeNumbers(a, 'cargo')) jobs.push(this.sources.tryQuery('cargo', activeSql.cargo).then((r) => fill(empty('cargo', 'last-login'), r?.[0], null)));
    return Promise.all(jobs);
  }
}
