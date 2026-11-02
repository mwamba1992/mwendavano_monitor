import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

/** Production guards and HTTP settings read from the environment (pure, so they can be unit-tested). */
type Env = Record<string, string | undefined>;

export const MIN_SECRET_LENGTH = 32;
export const RO_ROLE = 'monitor_ro';

export const isProductionEnv = (env: Env = process.env) => env.NODE_ENV === 'production';

/** Empty means safe to boot. */
export function productionConfigProblems(env: Env = process.env): string[] {
  if (!isProductionEnv(env)) return [];
  const problems: string[] = [];
  for (const name of ['JWT_SECRET', 'SECRETS_KEY']) {
    const v = env[name] ?? '';
    if (v.length < MIN_SECRET_LENGTH) problems.push(`${name} must be at least ${MIN_SECRET_LENGTH} characters (openssl rand -hex 32)`);
    else if (v.startsWith('change-me')) problems.push(`${name} is still the placeholder from the example file`);
  }
  if (env.RO_DB_USERNAME !== RO_ROLE) problems.push(`RO_DB_USERNAME must be ${RO_ROLE}: the systems are read through the SELECT-only role, never their own users`);
  return problems;
}

export function assertProductionConfig(env: Env = process.env): void {
  const problems = productionConfigProblems(env);
  if (problems.length) throw new Error(`Unsafe production configuration:\n- ${problems.join('\n- ')}`);
}

export function corsOptions(env: Env = process.env): CorsOptions {
  const origins = (env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const base: CorsOptions = { methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Authorization', 'Content-Type', 'Accept'], credentials: true, maxAge: 600 };
  if (origins.length) return { ...base, origin: origins };
  return { ...base, origin: !isProductionEnv(env) };
}

/** Real client IP behind nginx; a public hop is never trusted, so X-Forwarded-For cannot be spoofed. */
export function trustProxySetting(env: Env = process.env): string | number | boolean {
  const raw = env.TRUST_PROXY?.trim();
  if (!raw) return 'loopback, linklocal, uniquelocal';
  if (raw === 'false' || raw === '0') return false;
  return /^\d+$/.test(raw) ? Number(raw) : raw;
}

export const secretsKey = (env: Env = process.env) => env.SECRETS_KEY || env.JWT_SECRET || '';
