import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import type { AccessMap, SystemKey } from '../access/access';

/**
 * Everything here lives in the Monitor's own database (mwendavano_monitor).
 * The monitored systems are read with raw SQL through SourcesService, never through entities.
 */

@Entity('staff')
export class Staff {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 120 }) name: string;
  @Column({ type: 'varchar', length: 20, unique: true }) phone: string;
  @Column({ type: 'varchar', length: 160, nullable: true }) email: string | null;
  /** What they do at Mwendavano, e.g. "Customer support". Not a permission. */
  @Column({ type: 'varchar', length: 80, default: '' }) jobRole: string;
  @Column({ type: 'boolean', default: false }) isOwner: boolean;
  @Column({ type: 'boolean', default: true }) active: boolean;
  @Column({ type: 'varchar', length: 100 }) passwordHash: string;
  @Column({ type: 'boolean', default: true }) mustChangePassword: boolean;
  @Column({ type: 'jsonb' }) access: AccessMap;
  /** Raised to log someone out everywhere. */
  @Column({ type: 'int', default: 0 }) tokenVersion: number;
  @Column({ type: 'timestamptz', nullable: true }) lastSeenAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

/** One sign-in. The refresh token rotates on use; only its hash is stored. */
@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column({ type: 'int' }) staffId: number;
  @Column({ type: 'varchar', length: 64 }) tokenHash: string;
  /** The token before the last rotation: two tabs refreshing at once must not end the session. */
  @Column({ type: 'varchar', length: 64, nullable: true }) prevHash: string | null;
  @Column({ type: 'timestamptz', nullable: true }) rotatedAt: Date | null;
  @Column({ type: 'timestamptz' }) expiresAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) revokedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('lockouts')
export class Lockout {
  @PrimaryColumn({ type: 'varchar', length: 80 }) key: string;
  @Column({ type: 'int', default: 0 }) failures: number;
  @Column({ type: 'timestamptz', nullable: true }) lastFailureAt: Date | null;
  @Column({ type: 'timestamptz', nullable: true }) lockedUntil: Date | null;
}

/** Append-only record of what staff did inside the Monitor. Never holds a full phone number or a secret. */
@Entity('activity_log')
@Index(['staffId', 'createdAt'])
export class ActivityLog {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'int', nullable: true }) staffId: number | null;
  @Column({ type: 'varchar', length: 120 }) staffName: string;
  @Column({ type: 'varchar', length: 40 }) action: string;
  /** mauzo, soko, wafanyakazi, cargo, server, or null for the Monitor itself. */
  @Column({ type: 'varchar', length: 20, nullable: true }) system: string | null;
  @Column({ type: 'varchar', length: 300 }) text: string;
  @Column({ type: 'varchar', length: 45, nullable: true }) ip: string | null;
  @Index() @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

/** One check of one target. Raw rows are kept 30 days, then rolled up into uptime_daily. */
@Entity('uptime_check')
@Index(['target', 'checkedAt'])
export class UptimeCheck {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' }) id: string;
  @Column({ type: 'varchar', length: 60 }) target: string;
  @Column({ type: 'varchar', length: 10 }) kind: 'http' | 'service';
  @Column({ type: 'boolean' }) ok: boolean;
  @Column({ type: 'int', nullable: true }) statusCode: number | null;
  @Column({ type: 'int', nullable: true }) responseMs: number | null;
  @Index() @Column({ type: 'timestamptz' }) checkedAt: Date;
}

@Entity('uptime_daily')
export class UptimeDaily {
  @PrimaryColumn({ type: 'date' }) date: string;
  @PrimaryColumn({ type: 'varchar', length: 60 }) target: string;
  @Column({ type: 'int' }) checks: number;
  @Column({ type: 'int' }) okChecks: number;
  @Column({ type: 'int', nullable: true }) avgMs: number | null;
}

/** Aggregates only. `sketch` is a HyperLogLog: it counts distinct visitors and holds no IP or user agent. */
@Entity('visitor_daily')
export class VisitorDaily {
  @PrimaryColumn({ type: 'date' }) date: string;
  @PrimaryColumn({ type: 'varchar', length: 60 }) site: string;
  @Column({ type: 'int', default: 0 }) visitors: number;
  @Column({ type: 'int', default: 0 }) pageViews: number;
  @Column({ type: 'jsonb', default: {} }) sources: Record<string, number>;
  @Column({ type: 'bytea' }) sketch: Buffer;
}

/** How far each nginx log has been read, so a restart resumes where it stopped. */
@Entity('log_offset')
export class LogOffset {
  @PrimaryColumn({ type: 'varchar', length: 300 }) path: string;
  @Column({ type: 'bigint', nullable: true }) inode: string | null;
  @Column({ type: 'bigint', default: 0 }) offset: string;
  @Column({ type: 'timestamptz' }) updatedAt: Date;
}

/** A note staff added to "Needs attention". */
@Entity('manual_note')
export class ManualNote {
  @PrimaryGeneratedColumn() id: number;
  @Column({ type: 'varchar', length: 20 }) system: SystemKey;
  @Column({ type: 'varchar', length: 140 }) title: string;
  @Column({ type: 'varchar', length: 300, default: '' }) detail: string;
  @Column({ type: 'varchar', length: 10, default: 'warn' }) severity: 'warn' | 'bad';
  @Column({ type: 'int' }) createdById: number;
  @Column({ type: 'varchar', length: 120 }) createdByName: string;
  @Column({ type: 'timestamptz', nullable: true }) resolvedAt: Date | null;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

/** The manual pill on a system card, e.g. "In App Review". The card's id, not a system key: Global Authentics has its own. */
@Entity('system_note')
export class SystemNote {
  @PrimaryColumn({ type: 'varchar', length: 20 }) card: string;
  @Column({ type: 'varchar', length: 40 }) note: string;
  @Column({ type: 'varchar', length: 120 }) updatedByName: string;
  @Column({ type: 'timestamptz' }) updatedAt: Date;
}

export const ENTITIES = [Staff, Session, Lockout, ActivityLog, UptimeCheck, UptimeDaily, VisitorDaily, LogOffset, ManualNote, SystemNote];
