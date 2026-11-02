import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

export type SourceDb = 'inventory' | 'wafanyakazi' | 'cargo';

/**
 * Read-only connections to the monitored databases. Three independent layers stop a write:
 *  1. the role (monitor_ro) has SELECT and nothing else,
 *  2. every connection starts with default_transaction_read_only=on,
 *  3. only raw SELECTs live in this codebase: no entities, no synchronize, no migrations.
 */
@Injectable()
export class SourcesService implements OnModuleDestroy {
  private readonly log = new Logger(SourcesService.name);
  private readonly pools = new Map<SourceDb, Pool>();

  private pool(db: SourceDb): Pool {
    let p = this.pools.get(db);
    if (!p) {
      const database = { inventory: process.env.RO_DB_INVENTORY || 'inventorydb', wafanyakazi: process.env.RO_DB_WAFANYAKAZI || 'wafanyakazi', cargo: process.env.RO_DB_CARGO || 'mwendavano_cargo' }[db];
      p = new Pool({
        host: process.env.RO_DB_HOST || process.env.DB_HOST || 'localhost',
        port: Number(process.env.RO_DB_PORT || process.env.DB_PORT || 5432),
        user: process.env.RO_DB_USERNAME || 'monitor_ro',
        password: process.env.RO_DB_PASSWORD || undefined,
        database,
        max: 4,
        idleTimeoutMillis: 60_000,
        connectionTimeoutMillis: 5_000,
        options: '-c default_transaction_read_only=on -c statement_timeout=8000',
      });
      p.on('error', (e) => this.log.error(`${db}: ${e.message}`));
      this.pools.set(db, p);
    }
    return p;
  }

  async query<T = any>(db: SourceDb, q: { sql: string; params?: unknown[] }): Promise<T[]> {
    const r = await this.pool(db).query(q.sql, q.params ?? []);
    return r.rows as T[];
  }

  /** One system being down must not take the panel with it: returns null and logs. */
  async tryQuery<T = any>(db: SourceDb, q: { sql: string; params?: unknown[] }): Promise<T[] | null> {
    try {
      return await this.query<T>(db, q);
    } catch (e: any) {
      this.log.error(`${db} query failed: ${e?.message ?? e}`);
      return null;
    }
  }

  async onModuleDestroy() {
    await Promise.all([...this.pools.values()].map((p) => p.end()));
  }
}
