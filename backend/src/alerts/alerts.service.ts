import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull } from 'typeorm';
import { Actor, canAddNote, canSeeNumbers, isSystem, levelOf, SystemKey } from '../access/access';
import { ActivityService, AuthStaff } from '../common/core';
import { ManualNote, SystemNote } from '../entities';
import { ChecksService } from '../health/checks.service';
import { CARDS, DISK_BAD, MEMORY_BAD, svc } from '../health/targets';
import { TtlCache } from '../overview/overview.service';
import { trialsEnding, unreviewedReports } from '../sources/queries';
import { SourcesService } from '../sources/sources.service';

export interface Alert {
  id: string;
  title: string;
  detail: string;
  level: 'bad' | 'warn';
  system: SystemKey;
  noteId?: number;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

@Injectable()
export class AlertsService {
  private readonly cache = new TtlCache(60_000);

  constructor(
    private readonly ds: DataSource,
    private readonly sources: SourcesService,
    private readonly checks: ChecksService,
    private readonly activity: ActivityService,
  ) {}

  private async computed(): Promise<Alert[]> {
    const out: Alert[] = [];
    // Not cached: "a stopped service alerts within 2 minutes" allows no extra minute here.
    const { recent } = await this.checks.recent();
    const status = this.checks.statuses(recent);
    for (const c of CARDS) {
      const s = status.get(c.id);
      if (s === 'Down') {
        const stopped = c.services.filter((n) => recent.get(svc(n))?.[0] === false);
        out.push({ id: `down:${c.id}`, title: `${c.name} is down`, detail: stopped.length ? `Service stopped: ${stopped.join(', ')}` : 'The website is not answering', level: 'bad', system: c.system });
      } else if (s === 'Degraded') {
        out.push({ id: `slow:${c.id}`, title: `${c.name} is degraded`, detail: 'The last check failed on part of this system', level: 'warn', system: c.system });
      }
    }
    for (const n of ['nginx', 'postgresql'] as const) {
      if (recent.get(svc(n))?.[0] === false) out.push({ id: `down:${n}`, title: `${n} is stopped`, detail: 'Every system depends on this service', level: 'bad', system: 'server' });
    }
    const { disk, memory } = await this.checks.server();
    if (disk !== null && disk > DISK_BAD) out.push({ id: 'disk', title: `Disk is ${disk}% full`, detail: `Over the ${DISK_BAD}% limit`, level: 'bad', system: 'server' });
    if (memory > MEMORY_BAD) out.push({ id: 'memory', title: `Memory is ${memory}% used`, detail: `Over the ${MEMORY_BAD}% limit`, level: 'bad', system: 'server' });

    const business = await this.cache.get('business', async () => {
      const [t, r] = await Promise.all([this.sources.tryQuery('inventory', trialsEnding(new Date())), this.sources.tryQuery('inventory', unreviewedReports())]);
      return { trials: t?.[0]?.n ?? 0, reports: r?.[0]?.n ?? 0 };
    });
    if (business.trials) out.push({ id: 'trials', title: `${plural(business.trials, 'Mauzo trial ends', 'Mauzo trials end')} within 24 hours`, detail: 'No payment yet', level: 'warn', system: 'mauzo' });
    if (business.reports) out.push({ id: 'reports', title: `${plural(business.reports, 'Soko chat report', 'Soko chat reports')} not reviewed`, detail: 'Someone reported a conversation', level: 'warn', system: 'soko' });
    return out;
  }

  async forStaff(a: Actor): Promise<Alert[]> {
    const notes = await this.ds.getRepository(ManualNote).find({ where: { resolvedAt: IsNull() }, order: { createdAt: 'DESC' } });
    const manual: Alert[] = notes.map((n) => ({ id: `note:${n.id}`, noteId: n.id, title: n.title, detail: n.detail, level: n.severity, system: n.system }));
    const all = [...(await this.computed()), ...manual].filter((x) => canSeeNumbers(a, x.system));
    return all.sort((x, y) => Number(y.level === 'bad') - Number(x.level === 'bad'));
  }

  async addNote(a: AuthStaff, b: { system: string; title: string; detail?: string; severity?: string }, ip: string | null) {
    if (!isSystem(b.system)) throw new BadRequestException('Unknown system');
    if (!canAddNote(a, b.system)) throw new ForbiddenException('You need Support or Admin on this system');
    const repo = this.ds.getRepository(ManualNote);
    const note = await repo.save(repo.create({ system: b.system, title: b.title.trim(), detail: (b.detail ?? '').trim(), severity: b.severity === 'bad' ? 'bad' : 'warn', createdById: a.id, createdByName: a.name }));
    await this.activity.record({ staffId: a.id, staffName: a.name, action: 'note_added', system: b.system, text: `Added a note: ${note.title}`, ip });
    return note;
  }

  async resolveNote(a: AuthStaff, id: number, ip: string | null) {
    const repo = this.ds.getRepository(ManualNote);
    const note = await repo.findOne({ where: { id, resolvedAt: IsNull() } });
    if (!note) throw new NotFoundException('This note was not found');
    if (!canAddNote(a, note.system)) throw new ForbiddenException('You need Support or Admin on this system');
    await repo.update({ id }, { resolvedAt: new Date() });
    await this.activity.record({ staffId: a.id, staffName: a.name, action: 'note_resolved', system: note.system, text: `Closed a note: ${note.title}`, ip });
    return { ok: true };
  }

  /** The manual pill on a card, e.g. "In App Review". */
  async setCardNote(a: AuthStaff, cardId: string, note: string | null, ip: string | null) {
    const card = CARDS.find((c) => c.id === cardId);
    if (!card) throw new NotFoundException('Unknown system');
    if (levelOf(a, card.system) !== 'admin') throw new ForbiddenException('Only an Admin of this system can change this');
    const repo = this.ds.getRepository(SystemNote);
    const text = note?.trim();
    if (text) await repo.save({ card: cardId, note: text, updatedByName: a.name, updatedAt: new Date() });
    else await repo.delete({ card: cardId });
    await this.activity.record({ staffId: a.id, staffName: a.name, action: 'settings_changed', system: card.system, text: text ? `Set ${card.name} note to "${text}"` : `Cleared the note on ${card.name}`, ip });
    return { ok: true };
  }
}
