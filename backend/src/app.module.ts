import { BadRequestException, Body, Controller, Delete, Get, Header, HttpCode, Module, Param, ParseIntPipe, Patch, Post, Query } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { DataSource } from 'typeorm';
import { AlertsService } from './alerts/alerts.service';
import { AuthModule } from './auth/auth.controller';
import { AuthStaff, ClientIp, CoreModule, CurrentStaff, JwtAuthGuard, Public } from './common/core';
import { isPeriod } from './common/logic/time';
import { dbOptions } from './db-options';
import { ChecksService } from './health/checks.service';
import { OverviewService } from './overview/overview.service';
import { SourcesService } from './sources/sources.service';
import { StaffService } from './staff/staff.service';
import { Joined, UsersService } from './users/users.service';
import { VisitorsService } from './visitors/visitors.service';

class NoteDto {
  @IsString() @MaxLength(20) system: string;
  @IsString() @Length(1, 140) title: string;
  @IsOptional() @IsString() @MaxLength(300) detail?: string;
  @IsOptional() @IsIn(['warn', 'bad']) severity?: string;
}
class CardNoteDto {
  @IsOptional() @IsString() @MaxLength(40) note?: string | null;
}
class InviteDto {
  @IsString() @Length(1, 120) name: string;
  @IsString() @MaxLength(30) phone: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(80) jobRole?: string;
  @IsObject() access: Record<string, string>;
}
class StaffPatchDto {
  @IsOptional() @IsString() @Length(1, 120) name?: string;
  @IsOptional() @IsString() @MaxLength(160) email?: string;
  @IsOptional() @IsString() @MaxLength(80) jobRole?: string;
  @IsOptional() @IsObject() access?: Record<string, string>;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsBoolean() resetTwoStep?: boolean;
  @IsOptional() @IsBoolean() resetPassword?: boolean;
}

const joinedOf = (v?: string): Joined | undefined => (v === 'today' || v === '7d' || v === '30d' || v === 'all' ? v : undefined);
const typeOf = (v?: string) => (v && ['owner', 'staff', 'buyer', 'worker', 'manager', 'customer'].includes(v) ? v : undefined);

@Controller()
export class ApiController {
  constructor(
    private readonly ds: DataSource,
    private readonly overview: OverviewService,
    private readonly visitors: VisitorsService,
    private readonly users: UsersService,
    private readonly alerts: AlertsService,
    private readonly staff: StaffService,
  ) {}

  @Public() @Get('health')
  async health() {
    await this.ds.query('SELECT 1');
    return { ok: true };
  }

  @Get('overview')
  async getOverview(@CurrentStaff() s: AuthStaff, @Query('period') period?: string) {
    const p = isPeriod(period) ? period : '7d';
    const [kpis, signups] = await Promise.all([this.overview.kpis(s, p), this.overview.signups(s)]);
    return { period: p, kpis, signups };
  }

  @Get('systems')
  systems(@CurrentStaff() s: AuthStaff) {
    return this.overview.systems(s);
  }

  @Patch('systems/:card/note')
  cardNote(@CurrentStaff() s: AuthStaff, @Param('card') card: string, @Body() b: CardNoteDto, @ClientIp() ip: string | null) {
    return this.alerts.setCardNote(s, card, b.note ?? null, ip);
  }

  @Get('visitors')
  getVisitors(@CurrentStaff() s: AuthStaff, @Query('days') days?: string) {
    const n = Number(days ?? 14);
    if (!Number.isInteger(n) || n < 1 || n > 90) throw new BadRequestException('days must be between 1 and 90');
    return this.visitors.report(s, n);
  }

  @Get('users')
  async getUsers(@CurrentStaff() s: AuthStaff, @Query('system') system?: string, @Query('type') type?: string, @Query('joined') joined?: string, @Query('q') q?: string, @Query('page') page?: string) {
    const f = { system: system || undefined, type: typeOf(type), joined: joinedOf(joined), q: q?.slice(0, 80), page: Number(page) || 1 };
    const [list, totals] = await Promise.all([this.users.list(s, f), this.users.totals(s)]);
    return { ...list, totals };
  }

  @Get('users/export.csv') @Header('Content-Type', 'text/csv; charset=utf-8') @Header('Content-Disposition', 'attachment; filename="mwendavano-users.csv"')
  exportUsers(@CurrentStaff() s: AuthStaff, @ClientIp() ip: string | null, @Query('system') system?: string, @Query('type') type?: string, @Query('joined') joined?: string, @Query('q') q?: string) {
    return this.users.exportCsv(s, { system: system || undefined, type: typeOf(type), joined: joinedOf(joined), q: q?.slice(0, 80) }, ip);
  }

  @Post('users/:system/:id/reveal-phone') @HttpCode(200)
  reveal(@CurrentStaff() s: AuthStaff, @Param('system') system: string, @Param('id', ParseIntPipe) id: number, @ClientIp() ip: string | null) {
    return this.users.revealPhone(s, system, id, ip);
  }

  @Get('alerts')
  getAlerts(@CurrentStaff() s: AuthStaff) {
    return this.alerts.forStaff(s);
  }

  @Post('alerts/notes')
  addNote(@CurrentStaff() s: AuthStaff, @Body() b: NoteDto, @ClientIp() ip: string | null) {
    return this.alerts.addNote(s, b, ip);
  }

  @Delete('alerts/notes/:id')
  resolveNote(@CurrentStaff() s: AuthStaff, @Param('id', ParseIntPipe) id: number, @ClientIp() ip: string | null) {
    return this.alerts.resolveNote(s, id, ip);
  }

  @Get('staff')
  listStaff(@CurrentStaff() s: AuthStaff) {
    return this.staff.list(s);
  }

  @Post('staff/invite')
  invite(@CurrentStaff() s: AuthStaff, @Body() b: InviteDto, @ClientIp() ip: string | null) {
    return this.staff.invite(s, b, ip);
  }

  @Patch('staff/:id')
  patchStaff(@CurrentStaff() s: AuthStaff, @Param('id', ParseIntPipe) id: number, @Body() b: StaffPatchDto, @ClientIp() ip: string | null) {
    return this.staff.update(s, id, b, ip);
  }

  @Get('activity')
  activity(@CurrentStaff() s: AuthStaff, @Query('staffId') staffId?: string) {
    return this.staff.activityLog(s, staffId ? Number(staffId) || undefined : undefined);
  }
}

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ScheduleModule.forRoot(), TypeOrmModule.forRootAsync({ useFactory: dbOptions }), CoreModule, AuthModule],
  controllers: [ApiController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }, SourcesService, ChecksService, VisitorsService, OverviewService, UsersService, AlertsService, StaffService],
})
export class AppModule {}
