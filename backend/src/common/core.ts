import { CanActivate, createParamDecorator, ExecutionContext, Global, HttpException, HttpStatus, Injectable, Module, SetMetadata, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { Actor } from '../access/access';
import { ActivityLog, Lockout, Staff } from '../entities';
import { isLocked, LOCKED_MESSAGE, normalizeLockState, registerFailure } from './logic/lockout';

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
  providers: [LockoutService, ActivityService],
  exports: [LockoutService, ActivityService],
})
export class CoreModule {}
