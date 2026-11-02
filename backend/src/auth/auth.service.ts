import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { DataSource, IsNull } from 'typeorm';
import { canManageStaff, requiresTwoStep } from '../access/access';
import { ActivityService, AuthStaff, LockoutService, otpInvalid, OtpService, SmsService } from '../common/core';
import { normalizePhone } from '../common/logic/phone';
import { checkTotp, generateTotpSecret, openSecret, sealSecret, totpUri } from '../common/logic/totp';
import { isProductionEnv, secretsKey } from '../common/security';
import { Session, Staff } from '../entities';

export const REFRESH_COOKIE = 'monitor_rt';
export const SESSION_MS = 7 * 24 * 3600_000;
const REFRESH_GRACE_MS = 30_000;
const BCRYPT_COST = 12;
const OTP_PURPOSE = 'signin';
export const MIN_PASSWORD = 10;
/** Compared against when the phone is unknown, so timing does not reveal who has an account. */
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST);

type Step = 'sms' | 'totp' | 'enroll';
interface ChallengeClaims {
  sub: number;
  tv: number;
  typ: 'challenge';
  step: Step;
}

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const BAD_LOGIN = 'Wrong phone or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly ds: DataSource,
    private readonly jwt: JwtService,
    private readonly lockout: LockoutService,
    private readonly otp: OtpService,
    private readonly sms: SmsService,
    private readonly activity: ActivityService,
  ) {}

  private get staff() {
    return this.ds.getRepository(Staff);
  }
  private get sessions() {
    return this.ds.getRepository(Session);
  }

  profile(s: Staff) {
    return { id: s.id, name: s.name, phone: s.phone, email: s.email, jobRole: s.jobRole, isOwner: s.isOwner, access: s.access, twoFactorMethod: s.twoFactorMethod, mustChangePassword: s.mustChangePassword, canManageStaff: canManageStaff(s), twoStepRequired: requiresTwoStep(s), smsAvailable: this.sms.enabled };
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
    if (!s.twoFactorMethod && !requiresTwoStep(s)) return this.finish(s, ip);

    const useSms = s.twoFactorMethod === 'sms' || !s.twoFactorMethod;
    // In production a code nobody can receive is useless, so with no Beem keys the person enrols an app.
    const smsWorks = this.sms.enabled || !isProductionEnv();
    if (useSms && smsWorks) {
      const code = await this.otp.create(s.phone, OTP_PURPOSE);
      await this.sms.send(s.phone, `Mwendavano Monitor: nambari yako ya kuingia ni ${code}. Usimpe mtu yeyote.`);
      return { step: 'sms' as const, challenge: await this.challenge(s, 'sms'), ...(isProductionEnv() ? {} : { devCode: code }) };
    }
    if (s.twoFactorMethod === 'totp') return { step: 'totp' as const, challenge: await this.challenge(s, 'totp') };
    return { step: 'enroll' as const, challenge: await this.challenge(s, 'enroll'), ...(await this.beginEnrol(s)) };
  }

  private challenge(s: Staff, step: Step) {
    const claims: ChallengeClaims = { sub: s.id, tv: s.tokenVersion, typ: 'challenge', step };
    return this.jwt.signAsync(claims, { expiresIn: '10m' });
  }

  private async beginEnrol(s: Staff) {
    const secret = generateTotpSecret();
    await this.staff.update({ id: s.id }, { totpSecret: sealSecret(secret, secretsKey()) });
    return { secret, otpauthUri: totpUri(secret, s.phone) };
  }

  async verify(challenge: string, code: string, ip: string | null) {
    let c: ChallengeClaims;
    try {
      c = await this.jwt.verifyAsync(challenge);
    } catch {
      throw new UnauthorizedException('This sign-in has expired. Please start again');
    }
    if (c?.typ !== 'challenge') throw new UnauthorizedException('This sign-in has expired. Please start again');
    const s = await this.staff.findOne({ where: { id: c.sub } });
    if (!s || !s.active || s.tokenVersion !== c.tv) throw new UnauthorizedException('This sign-in has expired. Please start again');
    const ok = await this.lockout.attempt(`verify:${s.id}`, async () => (c.step === 'sms' ? this.otp.check(s.phone, OTP_PURPOSE, code) : this.checkApp(s, code)));
    if (!ok) {
      await this.activity.record({ staffId: s.id, staffName: s.name, action: 'login_failed', text: 'Failed sign-in: wrong code', ip });
      throw otpInvalid();
    }
    if (c.step === 'enroll') {
      await this.staff.update({ id: s.id }, { twoFactorMethod: 'totp' });
      s.twoFactorMethod = 'totp';
      await this.activity.record({ staffId: s.id, staffName: s.name, action: 'two_step_on', text: 'Turned on two-step login with an authenticator app', ip });
    }
    return this.finish(s, ip);
  }

  private checkApp(s: Staff, code: string) {
    return Promise.resolve(!!s.totpSecret && checkTotp(openSecret(s.totpSecret, secretsKey()), code));
  }

  private async finish(s: Staff, ip: string | null) {
    const refreshToken = randomBytes(32).toString('base64url');
    const session = await this.sessions.save(this.sessions.create({ staffId: s.id, tokenHash: sha(refreshToken), expiresAt: new Date(Date.now() + SESSION_MS) }));
    await this.staff.update({ id: s.id }, { lastSeenAt: new Date() });
    await this.activity.record({ staffId: s.id, staffName: s.name, action: 'login', text: 'Signed in', ip });
    return { step: 'done' as const, accessToken: await this.accessToken(s, session.id), staff: this.profile(s), refreshToken };
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

  async setupApp(a: AuthStaff) {
    const s = await this.staff.findOneOrFail({ where: { id: a.id } });
    if (s.twoFactorMethod === 'totp') throw new BadRequestException('Your authenticator app is already set up');
    return this.beginEnrol(s);
  }

  async confirmApp(a: AuthStaff, code: string, ip: string | null) {
    const s = await this.staff.findOneOrFail({ where: { id: a.id } });
    if (!s.totpSecret) throw new BadRequestException('Start the set-up first');
    if (!(await this.lockout.attempt(`verify:${s.id}`, () => this.checkApp(s, code)))) throw otpInvalid();
    await this.staff.update({ id: s.id }, { twoFactorMethod: 'totp' });
    await this.activity.record({ staffId: s.id, staffName: s.name, action: 'two_step_on', text: 'Turned on two-step login with an authenticator app', ip });
    return this.me(a);
  }

  async useSms(a: AuthStaff, ip: string | null) {
    if (!this.sms.enabled) throw new BadRequestException('SMS codes are not set up. Use an authenticator app');
    await this.staff.update({ id: a.id }, { twoFactorMethod: 'sms', totpSecret: null });
    await this.activity.record({ staffId: a.id, staffName: a.name, action: 'two_step_on', text: 'Turned on two-step login by SMS', ip });
    return this.me(a);
  }

  async turnOff(a: AuthStaff, ip: string | null) {
    if (requiresTwoStep(a)) throw new ForbiddenException('Two-step login is required for anyone with Admin access');
    await this.staff.update({ id: a.id }, { twoFactorMethod: null, totpSecret: null });
    await this.activity.record({ staffId: a.id, staffName: a.name, action: 'two_step_off', text: 'Turned off two-step login', ip });
    return this.me(a);
  }

  /** Ends every session of one person, e.g. after their access changes. */
  async revokeAll(staffId: number) {
    await this.sessions.update({ staffId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }
}
