import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as dotenv from 'dotenv';
import { AppModule } from './app.module';
import { configureApp } from './common/http-setup';
import { assertProductionConfig, isProductionEnv } from './common/security';

dotenv.config({ quiet: true } as any);

async function bootstrap() {
  assertProductionConfig();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false, logger: isProductionEnv() ? ['log', 'warn', 'error'] : undefined });
  configureApp(app);
  app.enableShutdownHooks();
  const port = Number(process.env.PORT || 3202);
  await app.listen(port, '127.0.0.1');
  Logger.log(`Mwendavano Monitor API on http://127.0.0.1:${port}/api`, 'Bootstrap');
}
bootstrap().catch((e) => {
  Logger.error(e?.message ?? e, undefined, 'Bootstrap');
  process.exit(1);
});
