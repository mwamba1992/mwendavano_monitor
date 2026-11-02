import { join } from 'path';
import { DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';

/**
 * The Monitor's own database only. Never synchronizes: the schema comes from migrations,
 * which run at boot in production. The monitored databases are in sources/sources.service.ts.
 */
export function dbOptions(): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD || undefined,
    database: process.env.DB_DATABASE || 'mwendavano_monitor',
    entities: ENTITIES,
    migrations: [join(__dirname, 'migrations', __filename.endsWith('.ts') ? '*.ts' : '*.js').replace(/\\/g, '/')],
    migrationsTableName: 'migrations',
    synchronize: false,
    migrationsRun: process.env.NODE_ENV === 'production' && process.env.DB_MIGRATIONS_RUN !== 'false',
  };
}
