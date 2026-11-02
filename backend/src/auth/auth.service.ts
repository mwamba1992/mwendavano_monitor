import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { DataSource, IsNull } from 'typeorm';
import { canManageStaff } from '../access/access';
import { ActivityService, AuthStaff, LockoutService } from '../common/core';
import { normalizePhone } from '../common/logic/phone';
import { Session, Staff } from '../entities';

export const REFRESH_COOKIE = 'monitor_rt';
export const SESSION_MS = 7 * 24 * 3600_000;
const REFRESH_GRACE_MS = 30_000;
const BCRYPT_COST = 12;
export const MIN_PASSWORD = 10;
/** Compared against when the phone is unknown, so timing does not reveal who has an account. */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const BAD_LOGIN = 'Wrong phone or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly ds: DataSource,
    private readonly jwt: JwtService,
    private readonly lockout: LockoutService,
    private readonly activity: ActivityService,
  ) {}

  private get staff() {
    return this.ds.getRepository(Staff);
  }
  private get sessions() {
    return this.ds.getRepository(Session);
  }

  profile(s: Staff) {
    return { id: s.id, name: s.name, phone: s.phone, email: s.email, jobRole: s.jobRole, isOwner: s.isOwner, access: s.access, mustChangePassword: s.mustChangePassword, canManageStaff: canManageStaff(s) };
  }

  async login(rawPhone: string, password: string, ip: string | null) {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new UnauthorizedException(BAD_LOGIN);
    const staff = await this.staff.findOne({ where: { phone } });
    const ok = await this.lockout.attempt(`login:${phone}`, async () => {
      const match = await bcrypt.compare(password, staff?.passwordHash ?? DUMMY_HASH);
      return !!staff && staff.active && match;
    });
    if (!ok) {
      if (staff) await this.activity.record({ staffId: staff.id, staffName: staff.name, action: 'login_failed', text: 'Failed sign-in: wrong password', ip });
      throw new UnauthorizedException(BAD_LOGIN);
    }
    const s = staff!;
    const refreshToken = randomBytes(32).toString('base64url');
    const session = await this.sessions.save(this.sessions.create({ staffId: s.id, tokenHash: sha(refreshToken), expiresAt: new Date(Date.now() + SESSION_MS) }));
    await this.staff.update({ id: s.id }, { lastSeenAt: new Date() });
    await this.activity.record({ staffId: s.id, staffName: s.name, action: 'login', text: 'Signed in', ip });
    return { accessToken: await this.accessToken(s, session.id), staff: this.profile(s), refreshToken };
  }

  private accessToken(s: Staff, sid: string) {
    return this.jwt.signAsync({ sub: s.id, sid, tv: s.tokenVersion, typ: 'access' });
  }

  /** A rotated token is honoured for a moment (a second tab); later it means theft, so the session ends. */
  async refresh(token: string | undefined) {
    if (!token) throw new UnauthorizedException('Please sign in');
    const hash = sha(token);
    const session = await this.sessions.findOne({ where: [{ tokenHash: hash }, { prevHash: hash }] });
    const now = Date.now();
    if (!session || session.revokedAt || session.expiresAt.getTime() <= now) throw new UnauthorizedException('Please sign in');
    const staff = await this.staff.findOne({ where: { id: session.staffId } });
    if (!staff || !staff.active) throw new UnauthorizedException('Please sign in');
    if (session.prevHash === hash) {
      if (session.rotatedAt && now - session.rotatedAt.getTime() < REFRESH_GRACE_MS) return { accessToken: await this.accessToken(staff, session.id), staff: this.profile(staff), refreshToken: null };
      await this.sessions.update({ id: session.id }, { revokedAt: new Date() });
      throw new UnauthorizedException('Please sign in');
    }
    const next = randomBytes(32).toString('base64url');
    await this.sessions.update({ id: session.id }, { tokenHash: sha(next), prevHash: hash, rotatedAt: new Date() });
    return { accessToken: await this.accessToken(staff, session.id), staff: this.profile(staff), refreshToken: next };
  }

  async logout(token: string | undefined) {
    if (token) await this.sessions.update({ tokenHash: sha(token) }, { revokedAt: new Date() });
  }

  async me(a: AuthStaff) {
    return this.profile(await this.staff.findOneOrFail({ where: { id: a.id } }));
  }

  async changePassword(a: AuthStaff, current: string, next: string, ip: string | null) {
    const s = await this.staff.findOneOrFail({ where: { id: a.id } });
    if (next.length < MIN_PASSWORD) throw new BadRequestException(`Use at least ${MIN_PASSWORD} characters`);
    if (!(await this.lockout.attempt(`password:${s.id}`, () => bcrypt.compare(current, s.passwordHash)))) throw new BadRequestException('Your current password is wrong');
    if (current === next) throw new BadRequestException('Choose a different password');
    const tokenVersion = s.tokenVersion + 1;
    await this.staff.update({ id: s.id }, { passwordHash: await bcrypt.hash(next, BCRYPT_COST), mustChangePassword: false, tokenVersion });
    await this.sessions.createQueryBuilder().update().set({ revokedAt: new Date() }).where('"staffId" = :id AND id <> :sid AND "revokedAt" IS NULL', { id: s.id, sid: a.sessionId }).execute();
    await this.activity.record({ staffId: s.id, staffName: s.name, action: 'password_changed', text: 'Changed their password', ip });
    const fresh = await this.staff.findOneOrFail({ where: { id: s.id } });
    return { accessToken: await this.accessToken(fresh, a.sessionId), staff: this.profile(fresh) };
  }

  /** Ends every session of one person, e.g. after their account is turned off. */
  async revokeAll(staffId: number) {
    await this.sessions.update({ staffId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }
}
