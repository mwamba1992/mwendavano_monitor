/** DataSource for the TypeORM CLI: `npm run build && npm run migration:run`. */
import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';
import { dbOptions } from './db-options';

dotenv.config({ quiet: true } as any);

export default new DataSource({ ...dbOptions(), migrationsRun: false });
