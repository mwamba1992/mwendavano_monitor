import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Actor, canRevealPhone, canSeeNumbers, canSeePeople, isPeopleSystem, PEOPLE_SYSTEMS, PeopleSystem } from '../access/access';
import { ActivityService, AuthStaff } from '../common/core';
import { eatDayStart } from '../common/logic/time';
import * as q from '../sources/queries';
import { SourcesService } from '../sources/sources.service';

export const PAGE_SIZE = 50;
export const EXPORT_LIMIT = 10_000;
export const TYPE_LABEL: Record<string, string> = { owner: 'Shop owner', staff: 'Shop staff', buyer: 'Buyer', worker: 'Worker', manager: 'Manager', customer: 'Cargo customer' };

/** 0754 ••• 210. No full number leaves the API except through the logged reveal. */
export function maskPhone(raw: string | null | undefined): string {
  const d = String(raw ?? '').replace(/\D/g, '');
  if (d.length < 7) return '•••';
  const local = d.startsWith('255') && d.length === 12 ? `0${d.slice(3)}` : d;
  return `${local.slice(0, 4)} ••• ${local.slice(-3)}`;
}

/** Quotes, and stops a name like =HYPERLINK(...) running as a formula when opened in Excel. */
export function csvCell(v: unknown): string {
  const s = String(v ?? '');
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export type Joined = 'today' | '7d' | '30d' | 'all';

export function joinedFrom(j: Joined | undefined, now: Date = new Date()): Date | null {
  const day = eatDayStart(now).getTime();
  if (j === 'today') return new Date(day);
  if (j === '7d') return new Date(day - 6 * 24 * 3600_000);
  if (j === '30d') return new Date(day - 29 * 24 * 3600_000);
  return null;
}

export interface UserQuery {
  system?: string;
  type?: string;
  joined?: Joined;
  q?: string;
  page?: number;
}

export interface UserRow {
  id: number;
  system: PeopleSystem;
  name: string;
  phone: string;
  type: string;
  plan: string;
  location: string;
  joined: Date | null;
  lastActive: Date | null;
  status: string;
  canReveal: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly sources: SourcesService,
    private readonly activity: ActivityService,
  ) {}

  /** Which systems' people this request may list; a named system the person cannot see at all is a 403. */
  private scope(a: Actor, system?: string): PeopleSystem[] {
    if (system) {
      if (!isPeopleSystem(system) || !canSeeNumbers(a, system)) throw new ForbiddenException('You do not have access to this system');
      return canSeePeople(a, system) ? [system] : [];
    }
    return PEOPLE_SYSTEMS.filter((s) => canSeePeople(a, s));
  }

  private async collect(a: Actor, f: UserQuery, need: number) {
    const filters = { joinedFrom: joinedFrom(f.joined), type: f.type, q: f.q };
    const failed: PeopleSystem[] = [];
    const lists = await Promise.all(
      this.scope(a, f.system)
        .filter((s) => q.systemHasType(s, f.type))
        .map(async (s) => {
          const rows = await this.sources.tryQuery(q.dbOf(s), q.peopleList(s, filters, need));
          if (!rows) failed.push(s);
          return (rows ?? []).map((r) => ({ ...r, system: s }));
        }),
    );
    const total = lists.reduce((n, l) => n + (l[0]?.full_count ?? 0), 0);
    const rows = lists.flat().sort((x, y) => (y.joined?.getTime() ?? 0) - (x.joined?.getTime() ?? 0) || y.id - x.id);
    return { rows, total, failed };
  }

  private toRow(a: Actor, r: any): UserRow {
    return {
      id: r.id,
      system: r.system,
      name: r.name ?? '',
      phone: maskPhone(r.phone),
      type: TYPE_LABEL[r.type] ?? r.type,
      plan: r.plan ?? '',
      location: r.location ?? '',
      joined: r.joined,
      lastActive: r.last_active,
      status: r.status,
      canReveal: canRevealPhone(a, r.system) && !!r.phone,
    };
  }

  async list(a: Actor, f: UserQuery) {
    const page = Math.max(1, Math.floor(Number(f.page) || 1));
    const { rows, total, failed } = await this.collect(a, f, page * PAGE_SIZE);
    return { rows: rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((r) => this.toRow(a, r)), total, page, pageSize: PAGE_SIZE, failed, peopleHidden: !!f.system && !canSeePeople(a, f.system as PeopleSystem) };
  }

  /** Counts per system. Numbers only, so View level sees them too. */
  async totals(a: Actor) {
    const now = new Date();
    const week = joinedFrom('7d', now)!;
    return Promise.all(
      PEOPLE_SYSTEMS.filter((s) => canSeeNumbers(a, s)).map(async (s) => {
        const rows = await this.sources.tryQuery<{ total: number; w0: number }>(q.dbOf(s), q.peopleCounts(s, [[week, now]]));
        return { system: s, total: rows?.[0]?.total ?? null, week: rows?.[0]?.w0 ?? null };
      }),
    );
  }

  /** Masked for everyone, Admin included: a spreadsheet of full numbers is too easy to lose. */
  async exportCsv(a: AuthStaff, f: UserQuery, ip: string | null): Promise<string> {
    if (!this.scope(a, f.system).length) throw new ForbiddenException('You do not have access to user details');
    const { rows } = await this.collect(a, f, EXPORT_LIMIT);
    const lines = rows.slice(0, EXPORT_LIMIT).map((r) => {
      const u = this.toRow(a, r);
      return [u.name, u.phone, u.system, u.type, u.plan, u.location, u.joined?.toISOString() ?? '', u.lastActive?.toISOString() ?? '', u.status].map(csvCell).join(',');
    });
    await this.activity.record({ staffId: a.id, staffName: a.name, action: 'export', system: f.system ?? null, text: `Exported ${lines.length} users to CSV (${f.system ?? 'all systems'}, joined ${f.joined ?? 'all time'}${f.q ? ', with a search' : ''})`, ip });
    return ['Name,Phone,System,Type,Plan or shop,Location,Joined,Last active,Status', ...lines].join('\r\n') + '\r\n';
  }

  async revealPhone(a: AuthStaff, system: string, id: number, ip: string | null) {
    if (!isPeopleSystem(system) || !canRevealPhone(a, system)) throw new ForbiddenException('Only an Admin of this system can see a full phone number');
    const [row] = await this.sources.query<{ name: string; phone: string }>(q.dbOf(system), q.phoneOf(system, id));
    if (!row?.phone) throw new NotFoundException('This person was not found');
    await this.activity.record({ staffId: a.id, staffName: a.name, action: 'reveal_phone', system, text: `Viewed the full phone number of ${row.name} (${maskPhone(row.phone)})`, ip });
    return { phone: row.phone };
  }
}
