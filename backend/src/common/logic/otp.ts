/**
 * One-time codes (pure logic). 6 digits, valid 10 min, 5 wrong tries per code.
 * Per phone: at most 1 code per 60 s and 5 per hour.
 */
import { createHmac, randomInt, timingSafeEqual } from 'crypto';

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_RESEND_MS = 60_000;
export const OTP_MAX_PER_HOUR = 5;

export const OTP_INVALID_MESSAGE = 'The code is wrong or has expired';
export const OTP_WAIT_MESSAGE = 'Wait a minute before asking for another code';
export const OTP_HOURLY_MESSAGE = 'Too many codes requested. Try again in an hour';

export const generateOtp = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** HMAC bound to phone + purpose, so a code for one flow never works for another. */
export const hashOtp = (code: string, phone: string, purpose: string, secret: string) =>
  createHmac('sha256', secret || '').update(`${purpose}:${phone}:${String(code).trim()}`).digest('hex');

/** null = allowed; otherwise the 429 message. `recent` = createdAt of this phone + purpose's codes. */
export function otpRateLimit(recent: Date[], now: Date = new Date()): string | null {
  const t = now.getTime();
  if (recent.some((d) => t - d.getTime() < OTP_RESEND_MS)) return OTP_WAIT_MESSAGE;
  if (recent.filter((d) => t - d.getTime() < 3600_000).length >= OTP_MAX_PER_HOUR) return OTP_HOURLY_MESSAGE;
  return null;
}

export interface OtpRow {
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  consumedAt: Date | null;
}

export type OtpCheck = 'ok' | 'wrong' | 'expired' | 'exhausted' | 'consumed';

export function checkOtp(row: OtpRow | null, codeHash: string, now: Date = new Date()): OtpCheck {
  if (!row) return 'expired';
  if (row.consumedAt) return 'consumed';
  if (row.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (row.attempts >= OTP_MAX_ATTEMPTS) return 'exhausted';
  const a = Buffer.from(row.codeHash, 'hex');
  const b = Buffer.from(codeHash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b) ? 'ok' : 'wrong';
}
