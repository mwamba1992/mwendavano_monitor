/**
 * Phones are stored in E.164 with a plus: +255754123456. Tanzanian local formats are accepted
 * (0754 123 456, 754123456, 255754123456); other countries need the + or 00 prefix
 * (China warehouse staff: +86 138 0013 8000).
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const intl = s.startsWith('+') || s.startsWith('00');
  let d = s.replace(/\D/g, '');
  if (intl) {
    if (s.startsWith('00')) d = d.slice(2);
    if (d.startsWith('2550')) d = '255' + d.slice(4);
    return /^[1-9]\d{7,14}$/.test(d) ? `+${d}` : null;
  }
  if (/^0[67]\d{8}$/.test(d)) return `+255${d.slice(1)}`;
  if (/^[67]\d{8}$/.test(d)) return `+255${d}`;
  if (/^255[67]\d{8}$/.test(d)) return `+${d}`;
  return null;
}

export const phoneDigits = (p: string) => p.replace(/\D/g, '');
export const last4 = (p: string) => phoneDigits(p).slice(-4);
export const maskPhone = (p: string) => (p.length > 7 ? `${p.slice(0, 7)}***${p.slice(-2)}` : '***');

/** Selcom and Beem want 255XXXXXXXXX. */
export const msisdn = (p: string) => phoneDigits(p);
