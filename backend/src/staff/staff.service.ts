import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { AccessMap, canManageStaff, levelOf, parseAccess, staffEditProblem, SYSTEMS } from '../access/access';
import { AuthService } from '../auth/auth.service';
import { ActivityService, AuthStaff } from '../common/core';
import { normalizePhone } from '../common/logic/phone';
import { ActivityLog, Staff } from '../entities';

export const tempPassword = () => randomBytes(12).toString('base64url');

export interface InviteInput {
  name: string;
  phone: string;
  email?: string;
  jobRole?: string;
  access: unknown;
}

export interface PatchInput {
  name?: string;
  email?: string;
  jobRole?: string;
  access?: unknown;
  active?: boolean;
  resetTwoStep?: boolean;
  resetPassword?: boolean;
}

const summary = (a: AccessMap) => SYSTEMS.map((s) => `${s} ${a[s]}`).join(', ');

@Injectable()
export class StaffService {
  constructor(
    private readonly ds: DataSource,
    private readonly activity: ActivityService,
    private readonly auth: AuthService,
  ) {}

  private get repo() {
    return this.ds.getRepository(Staff);
  }

  private gate(a: AuthStaff) {
    if (!canManageStaff(a)) throw new ForbiddenException('Only an Admin on Server or the owner can see this');
  }

  /** Only the owner hands out Admin on Server, which is the power to manage staff. */
  private checkGrant(a: AuthStaff, access: AccessMap) {
    if (access.server === 'admin' && !a.isOwner) throw new ForbiddenException('Only the owner can give Admin on Server');
  }

  private view(s: Staff) {
    return { id: s.id, name: s.name, phone: s.phone, email: s.email, jobRole: s.jobRole, isOwner: s.isOwner, active: s.active, access: s.isOwner ? Object.fromEntries(SYSTEMS.map((k) => [k, levelOf(s, k)])) : s.access, twoFactorMethod: s.twoFactorMethod, lastSeenAt: s.lastSeenAt };
  }

  async list(a: AuthStaff) {
    this.gate(a);
    return (await this.repo.find({ order: { isOwner: 'DESC', name: 'ASC' } })).map((s) => this.view(s));
  }

  async invite(a: AuthStaff, b: InviteInput, ip: string | null) {
    this.gate(a);
    const phone = normalizePhone(b.phone);
    if (!phone) throw new BadRequestException('Enter a valid phone number');
    const access = parseAccess(b.access);
    if (!access) throw new BadRequestException('Unknown system or access level');
    this.checkGrant(a, access);
    if (await this.repo.exist({ where: { phone } })) throw new ConflictException('Someone with this phone number is already on the team');
    const password = tempPassword();
    const s = await this.repo.save(this.repo.create({ name: b.name.trim(), phone, email: b.email?.trim() || null, jobRole: (b.jobRole ?? '').trim(), access, passwordHash: await bcrypt.hash(password, 12), mustChangePassword: true }));
    await this.activity.record({ staffId: a.id, staffName: a.name, action: 'staff_invited', text: `Invited ${s.name}: ${summary(access)}`, ip });
    // Shown to the inviter once and never stored or logged in the clear.
    return { staff: this.view(s), temporaryPassword: password };
  }

  async update(a: AuthStaff, id: number, b: PatchInput, ip: string | null) {
    this.gate(a);
    const s = await this.repo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('This person was not found');
    const problem = staffEditProblem(a, s);
    if (problem) throw new ForbiddenException(problem);

    const changes: Partial<Staff> = {};
    const said: string[] = [];
    if (b.name !== undefined && b.name.trim() !== s.name) {
      changes.name = b.name.trim();
      said.push('changed their name');
    }
    if (b.email !== undefined) changes.email = b.email.trim() || null;
    if (b.jobRole !== undefined) changes.jobRole = b.jobRole.trim();
    if (b.access !== undefined) {
      const access = parseAccess(b.access);
      if (!access) throw new BadRequestException('Unknown system or access level');
      if (access.server === 'admin' && s.access.server !== 'admin') this.checkGrant(a, access);
      changes.access = access;
      said.push(`set access: ${summary(access)}`);
    }
    if (b.active !== undefined && b.active !== s.active) {
      changes.active = b.active;
      said.push(b.active ? 'turned the account on' : 'turned the account off');
    }
    if (b.resetTwoStep) {
      changes.twoFactorMethod = null;
      changes.totpSecret = null;
      said.push('reset two-step login');
    }
    let temporaryPassword: string | undefined;
    if (b.resetPassword) {
      temporaryPassword = tempPassword();
      changes.passwordHash = await bcrypt.hash(temporaryPassword, 12);
      changes.mustChangePassword = true;
      said.push('reset the password');
    }
    if (b.active === false || b.resetPassword || b.resetTwoStep) {
      changes.tokenVersion = s.tokenVersion + 1;
      await this.auth.revokeAll(s.id);
    }
    if (Object.keys(changes).length) await this.repo.update({ id }, changes);
    if (said.length) await this.activity.record({ staffId: a.id, staffName: a.name, action: 'staff_changed', text: `${s.name}: ${said.join('; ')}`, ip });
    return { staff: this.view(await this.repo.findOneOrFail({ where: { id } })), ...(temporaryPassword ? { temporaryPassword } : {}) };
  }

  async activityLog(a: AuthStaff, staffId?: number) {
    this.gate(a);
    const rows = await this.ds.getRepository(ActivityLog).find({ where: staffId ? { staffId } : {}, order: { id: 'DESC' }, take: 100 });
    return rows.map((r) => ({ id: r.id, staffId: r.staffId, staffName: r.staffName, action: r.action, system: r.system, text: r.text, createdAt: r.createdAt }));
  }
}
