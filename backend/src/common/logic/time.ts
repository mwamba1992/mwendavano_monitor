/** The business runs on Dar es Salaam time (UTC+3, no daylight saving). */
const EAT_MS = 3 * 3600_000;
const DAY_MS = 24 * 3600_000;

export type Period = 'today' | '7d' | '30d';
export const isPeriod = (v: unknown): v is Period => v === 'today' || v === '7d' || v === '30d';

/** Calendar date in Dar es Salaam, YYYY-MM-DD. */
export const eatDate = (d: Date) => new Date(d.getTime() + EAT_MS).toISOString().slice(0, 10);

/** The moment today began in Dar es Salaam. */
export const eatDayStart = (d: Date) => new Date(Math.floor((d.getTime() + EAT_MS) / DAY_MS) * DAY_MS - EAT_MS);

export interface PeriodRange {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  /** Calendar days, inclusive, for tables keyed by date. */
  days: string[];
  prevDays: string[];
}

const dayList = (lastStart: Date, n: number) => Array.from({ length: n }, (_, i) => eatDate(new Date(lastStart.getTime() - (n - 1 - i) * DAY_MS)));

/**
 * Today runs from midnight until now and compares with yesterday up to the same time.
 * 7 and 30 days are that many calendar days, today included, against the same length before.
 */
export function periodRange(period: Period, now: Date = new Date()): PeriodRange {
  const today = eatDayStart(now);
  const n = period === 'today' ? 1 : period === '7d' ? 7 : 30;
  const start = new Date(today.getTime() - (n - 1) * DAY_MS);
  const lengthMs = now.getTime() - start.getTime();
  const prevStart = new Date(start.getTime() - n * DAY_MS);
  return {
    start,
    end: now,
    prevStart,
    prevEnd: new Date(prevStart.getTime() + lengthMs),
    days: dayList(today, n),
    prevDays: dayList(new Date(today.getTime() - n * DAY_MS), n),
  };
}

export const lastDays = (n: number, now: Date = new Date()) => dayList(eatDayStart(now), n);

/** One [start, end) window per calendar day, oldest first, today included. */
export function dayWindows(n: number, now: Date = new Date()): [Date, Date][] {
  const today = eatDayStart(now).getTime();
  return Array.from({ length: n }, (_, i) => {
    const start = today - (n - 1 - i) * DAY_MS;
    return [new Date(start), new Date(start + DAY_MS)] as [Date, Date];
  });
}
