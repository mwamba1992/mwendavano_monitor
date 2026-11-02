import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';

/** RFC 6238 authenticator codes (30 s, 6 digits, SHA-1: what every authenticator app expects). */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_S = 30;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
    value &= (1 << bits) - 1;
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s.replace(/=+$/, '').toUpperCase()) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('Invalid base32');
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
    value &= (1 << bits) - 1;
  }
  return Buffer.from(out);
}

export const generateTotpSecret = () => base32Encode(randomBytes(20));

export function totpAt(secret: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', base32Decode(secret)).update(msg).digest();
  const off = h[h.length - 1] & 15;
  return String((h.readUInt32BE(off) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** Accepts the current code and one step either side, for phones with a slightly wrong clock. */
export function checkTotp(secret: string, code: string, now: Date = new Date()): boolean {
  const c = String(code).trim();
  if (!/^\d{6}$/.test(c)) return false;
  const counter = Math.floor(now.getTime() / 1000 / STEP_S);
  return [counter - 1, counter, counter + 1].some((n) => timingSafeEqual(Buffer.from(totpAt(secret, n)), Buffer.from(c)));
}

export const totpUri = (secret: string, phone: string) => `otpauth://totp/${encodeURIComponent(`Mwendavano Monitor:${phone}`)}?secret=${secret}&issuer=${encodeURIComponent('Mwendavano Monitor')}&digits=6&period=${STEP_S}`;

/** AES-256-GCM for the TOTP secret at rest. */
const keyOf = (key: string) => createHash('sha256').update(key).digest();

export function sealSecret(plain: string, key: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', keyOf(key), iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), body].map((b) => b.toString('base64')).join('.');
}

export function openSecret(sealed: string, key: string): string {
  const [iv, tag, body] = sealed.split('.').map((p) => Buffer.from(p, 'base64'));
  const d = createDecipheriv('aes-256-gcm', keyOf(key), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString('utf8');
}
