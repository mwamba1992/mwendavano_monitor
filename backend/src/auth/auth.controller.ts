import { Body, Controller, Get, HttpCode, Module, Post, Req, Res } from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import type { Request, Response } from 'express';
import { AllowTempPassword, AuthStaff, ClientIp, CurrentStaff, Public } from '../common/core';
import { isProductionEnv } from '../common/security';
import { AuthService, REFRESH_COOKIE, SESSION_MS } from './auth.service';

class LoginDto {
  @IsString() @MaxLength(30) phone: string;
  @IsString() @MaxLength(200) password: string;
}
class VerifyDto {
  @IsString() @MaxLength(2000) challenge: string;
  @IsString() @MaxLength(10) code: string;
}
class PasswordDto {
  @IsString() @MaxLength(200) current: string;
  @IsString() @MaxLength(200) next: string;
}
class CodeDto {
  @IsString() @MaxLength(10) code: string;
}

const cookieOptions = () => ({ httpOnly: true, secure: isProductionEnv(), sameSite: 'strict' as const, path: '/api/auth' });

function readCookie(req: Request): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === REFRESH_COOKIE) return v.join('=');
  }
  return undefined;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** The refresh token only ever travels in the cookie. */
  private send(res: Response, r: { refreshToken?: string | null } & Record<string, unknown>) {
    const { refreshToken, ...body } = r;
    if (refreshToken) res.cookie(REFRESH_COOKIE, refreshToken, { ...cookieOptions(), maxAge: SESSION_MS });
    return body;
  }

  @Public() @Post('login') @HttpCode(200)
  async login(@Body() b: LoginDto, @ClientIp() ip: string | null, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.auth.login(b.phone, b.password, ip));
  }

  @Public() @Post('verify') @HttpCode(200)
  async verify(@Body() b: VerifyDto, @ClientIp() ip: string | null, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.auth.verify(b.challenge, b.code, ip));
  }

  @Public() @Post('refresh') @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.send(res, await this.auth.refresh(readCookie(req)));
  }

  @Public() @Post('logout') @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(readCookie(req));
    res.clearCookie(REFRESH_COOKIE, cookieOptions());
    return { ok: true };
  }

  @AllowTempPassword() @Get('me')
  me(@CurrentStaff() s: AuthStaff) {
    return this.auth.me(s);
  }

  @AllowTempPassword() @Post('password') @HttpCode(200)
  password(@CurrentStaff() s: AuthStaff, @Body() b: PasswordDto, @ClientIp() ip: string | null) {
    return this.auth.changePassword(s, b.current, b.next, ip);
  }

  @Post('two-step/app') @HttpCode(200)
  setupApp(@CurrentStaff() s: AuthStaff) {
    return this.auth.setupApp(s);
  }

  @Post('two-step/app/confirm') @HttpCode(200)
  confirmApp(@CurrentStaff() s: AuthStaff, @Body() b: CodeDto, @ClientIp() ip: string | null) {
    return this.auth.confirmApp(s, b.code, ip);
  }

  @Post('two-step/sms') @HttpCode(200)
  useSms(@CurrentStaff() s: AuthStaff, @ClientIp() ip: string | null) {
    return this.auth.useSms(s, ip);
  }

  @Post('two-step/off') @HttpCode(200)
  off(@CurrentStaff() s: AuthStaff, @ClientIp() ip: string | null) {
    return this.auth.turnOff(s, ip);
  }
}

@Module({ controllers: [AuthController], providers: [AuthService], exports: [AuthService] })
export class AuthModule {}
