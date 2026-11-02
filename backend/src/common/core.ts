import { BadRequestException, CanActivate, createParamDecorator, ExecutionContext, Global, HttpException, HttpStatus, Injectable, Logger, Module, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { DataSource, IsNull, LessThan } from 'typeorm';
import { Actor } from '../access/access';
import { ActivityLog, Lockout, OtpCode, Staff } from '../entities';
import { isLocked, LOCKED_MESSAGE, normalizeLockState, registerFailure } from './logic/lockout';
import { checkOtp, generateOtp, hashOtp, OTP_INVALID_MESSAGE, OTP_MAX_ATTEMPTS, OTP_TTL_MS, otpRateLimit } from './logic/otp';
import { maskPhone, msisdn } from './logic/phone';
import { secretsKey } from './security';

export interface AuthStaff extends Actor {
  id: number;
  name: string;
  sessionId: string;
}

export const IS_PUBLIC = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Reachable while a temporary password has still to be changed. */
export const ALLOW_TEMP_PASSWORD = 'allowTempPassword';
export const AllowTempPassword = () => SetMetadata(ALLOW_TEMP_PASSWORD, true);
export const CurrentStaff = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthStaff => ctx.switchToHttp().getRequest().staff);
export const ClientIp = createParamDecorator((_: unknown, ctx: ExecutionContext): string | null => ctx.switchToHttp().getRequest().ip ?? null);

interface AccessClaims {
  sub: number;
  sid: string;
  tv: number;
  typ: 'access';
}

/**
 * Global guard: Bearer JWT unless @Public(). Access comes from the database on every request,
 * so changing someone's role takes effect at once and a token can never carry a stale role.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly ds: DataSource,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const flag = (k: string) => this.reflector.getAllAndOverride<boolean>(k, [ctx.getHandler(), ctx.getClass()]);
    if (flag(IS_PUBLIC)) return true;
    const req = ctx.switchToHttp().getRequest();
    const header: string | undefined = req.headers['authorization'];
    const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) throw new UnauthorizedException('Please sign in');
    let c: AccessClaims;
    try {
      c = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Your session has expired. Please sign in again');
    }
    if (c?.typ !== 'access' || typeof c.sub !== 'number') throw new UnauthorizedException('Please sign in');
    const staff = await this.ds.getRepository(Staff).findOne({ where: { id: c.sub } });
    if (!staff || !staff.active || staff.tokenVersion !== c.tv) throw new UnauthorizedException('Your session has expired. Please sign in again');
    if (staff.mustChangePassword && !flag(ALLOW_TEMP_PASSWORD)) throw new HttpException({ statusCode: 403, message: 'Please change your temporary password first', error: 'PASSWORD_CHANGE_REQUIRED' }, HttpStatus.FORBIDDEN);
    req.staff = { id: staff.id, name: staff.name, isOwner: staff.isOwner, access: staff.access, sessionId: c.sid } as AuthStaff;
    const stale = !staff.lastSeenAt || Date.now() - staff.lastSeenAt.getTime() > 60_000;
    if (stale) void this.ds.getRepository(Staff).update({ id: staff.id }, { lastSeenAt: new Date() }).catch(() => undefined);
    return true;
  }
}

export class LockedException extends HttpException {
  constructor() {
    super({ statusCode: HttpStatus.TOO_MANY_REQUESTS, message: LOCKED_MESSAGE, error: 'Too Many Requests' }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/** Failed-attempt lockout in Postgres (Cargo's pattern): the row lock counts parallel guesses one by one. */
@Injectable()
export class LockoutService {
  constructor(private readonly ds: DataSource) {}

  async attempt(key: string, check: () => Promise<boolean>): Promise<boolean> {
    const result = await this.ds.transaction(async (m) => {
      await m.query(`INSERT INTO "lockouts" ("key") VALUES ($1) ON CONFLICT ("key") DO NOTHING`, [key]);
      const row = await m.findOneOrFail(Lockout, { where: { key }, lock: { mode: 'pessimistic_write' } });
      const now = new Date();
      const state = normalizeLockState(row, now);
      if (isLocked(state, now)) return 'locked' as const;
      if (await check()) {
        await m.delete(Lockout, { key });
        return 'ok' as const;
      }
      const next = registerFailure(state, now);
      await m.update(Lockout, { key }, next);
      return isLocked(next, now) ? ('locked' as const) : ('wrong' as const);
    });
    if (result === 'locked') throw new LockedException();
    return result === 'ok';
  }
}

@Injectable()
export class OtpService {
  constructor(private readonly ds: DataSource) {}

  async create(phone: string, purpose: string, now: Date = new Date()): Promise<string> {
    const repo = this.ds.getRepository(OtpCode);
    const recent = await repo.find({ where: { phone, purpose }, order: { createdAt: 'DESC' }, take: 10 });
    const limited = otpRateLimit(recent.map((r) => r.createdAt), now);
    if (limited) throw new HttpException({ statusCode: 429, message: limited, error: 'Too Many Requests' }, HttpStatus.TOO_MANY_REQUESTS);
    const code = generateOtp();
    await repo.update({ phone, purpose, consumedAt: IsNull() }, { consumedAt: now });
    await repo.save(repo.create({ phone, purpose, codeHash: hashOtp(code, phone, purpose, secretsKey()), expiresAt: new Date(now.getTime() + OTP_TTL_MS), attempts: 0, consumedAt: null, createdAt: now }));
    repo.delete({ createdAt: LessThan(new Date(now.getTime() - 24 * 3600_000)) }).catch(() => undefined);
    return code;
  }

  /** Consumes the newest code; wrong tries count. */
  async check(phone: string, purpose: string, code: string, now: Date = new Date()): Promise<boolean> {
    return this.ds.transaction(async (m) => {
      const row = await m.findOne(OtpCode, { where: { phone, purpose, consumedAt: IsNull() }, order: { id: 'DESC' }, lock: { mode: 'pessimistic_write' } });
      const r = checkOtp(row, hashOtp(code, phone, purpose, secretsKey()), now);
      if (!row) return false;
      if (r === 'ok') await m.update(OtpCode, { id: row.id }, { consumedAt: now });
      else if (r === 'wrong') {
        const attempts = row.attempts + 1;
        await m.update(OtpCode, { id: row.id }, attempts >= OTP_MAX_ATTEMPTS ? { attempts, consumedAt: now } : { attempts });
      }
      return r === 'ok';
    });
  }
}

export const otpInvalid = () => new BadRequestException(OTP_INVALID_MESSAGE);

/** SMS sign-in codes through Beem. Optional: with no keys, staff use an authenticator app. Never throws. */
@Injectable()
export class SmsService {
  private readonly log = new Logger(SmsService.name);

  get enabled(): boolean {
    return !!process.env.BEEM_API_KEY?.trim() && !!process.env.BEEM_SECRET_KEY?.trim();
  }

  async send(phone: string, message: string): Promise<boolean> {
    if (!this.enabled) return false;
    try {
      const auth = Buffer.from(`${process.env.BEEM_API_KEY!.trim()}:${process.env.BEEM_SECRET_KEY!.trim()}`).toString('base64');
      const res = await fetch('https://apisms.beem.africa/v1/send', {
        method: 'POST',
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_addr: (process.env.BEEM_SENDER_ID ?? '').trim() || 'INFO', encoding: 0, message, recipients: [{ recipient_id: 1, dest_addr: msisdn(phone) }] }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) this.log.error(`Beem SMS failed (${res.status}) for ${maskPhone(phone)}`);
      return res.ok;
    } catch (e: any) {
      this.log.error(`Beem SMS error for ${maskPhone(phone)}: ${e?.message ?? e}`);
      return false;
    }
  }
}

export interface ActivityInput {
  staffId: number | null;
  staffName: string;
  action: string;
  system?: string | null;
  text: string;
  ip?: string | null;
}

@Injectable()
export class ActivityService {
  constructor(private readonly ds: DataSource) {}

  /** Awaited on purpose: a sensitive action must not succeed without its log line. */
  async record(e: ActivityInput) {
    await this.ds.getRepository(ActivityLog).insert({ staffId: e.staffId, staffName: e.staffName, action: e.action, system: e.system ?? null, text: e.text.slice(0, 300), ip: e.ip ?? null });
  }
}

@Global()
@Module({
  imports: [JwtModule.registerAsync({ global: true, useFactory: () => ({ secret: process.env.JWT_SECRET || 'dev-only-secret-not-for-production', signOptions: { expiresIn: '15m' } }) })],
  providers: [LockoutService, OtpService, SmsService, ActivityService],
  exports: [LockoutService, OtpService, SmsService, ActivityService],
})
export class CoreModule {}
