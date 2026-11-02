import { ArgumentsHost, Catch, HttpException, Logger, ValidationPipe } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';
import helmet from 'helmet';
import { corsOptions, trustProxySetting } from './security';

/** Unknown errors become a plain 500 with no message or stack; details go to the log only. */
@Catch()
export class SafeExceptionFilter extends BaseExceptionFilter {
  private readonly log = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    if (exception instanceof HttpException) return super.catch(exception, host);
    const res = host.switchToHttp().getResponse();
    const e = exception as { status?: number; type?: string; message?: string; stack?: string };
    if (e?.status === 413) return res.status(413).json({ statusCode: 413, message: 'Request is too large', error: 'Payload Too Large' });
    if (e?.status === 400 && e?.type) return res.status(400).json({ statusCode: 400, message: 'Invalid request', error: 'Bad Request' });
    this.log.error(e?.message ?? String(exception), e?.stack);
    res.status(500).json({ statusCode: 500, message: 'Server error. Please try again later', error: 'Internal Server Error' });
  }
}

/** Shared by main.ts and the e2e tests. */
export function configureApp(app: NestExpressApplication, env: Record<string, string | undefined> = process.env) {
  app.set('trust proxy', trustProxySetting(env));
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(json({ limit: '50kb' }));
  app.setGlobalPrefix('api');
  app.enableCors(corsOptions(env));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new SafeExceptionFilter(app.getHttpAdapter()));
}
