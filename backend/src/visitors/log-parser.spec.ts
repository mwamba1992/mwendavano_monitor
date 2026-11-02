import { addVisitor, classifyReferrer, countSketch, isBot, isPageView, isStaticOrApi, mergeSketch, newSketch, parseLine } from './log-parser';

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const line = (over: Partial<{ ip: string; req: string; status: number; ref: string; ua: string; time: string }> = {}) =>
  `${over.ip ?? '41.59.1.2'} - - [${over.time ?? '02/Nov/2026:07:58:12 +0300'}] "${over.req ?? 'GET /shops/duka HTTP/1.1'}" ${over.status ?? 200} 5120 "${over.ref ?? 'https://l.instagram.com/'}" "${over.ua ?? UA}"`;

describe('parseLine', () => {
  it('reads a combined line and honours the offset', () => {
    const l = parseLine(line())!;
    expect(l).toMatchObject({ ip: '41.59.1.2', method: 'GET', path: '/shops/duka', status: 200, referrer: 'https://l.instagram.com/', userAgent: UA });
    expect(l.time.toISOString()).toBe('2026-11-02T04:58:12.000Z');
  });
  it('keeps a user agent with an escaped quote', () => expect(parseLine(line({ ua: 'odd \\"agent\\"' }))?.userAgent).toContain('odd'));
  it('returns null on rubbish, never throws', () => {
    expect(parseLine('')).toBeNull();
    expect(parseLine('not a log line')).toBeNull();
    expect(parseLine(line({ time: '99/Foo/2026:07:58:12 +0300' }))).toBeNull();
    expect(parseLine('1.2.3.4 - - [02/Nov/2026:07:58:12 +0300] "\\x16\\x03\\x01" 400 0 "-" "-"')).toBeNull();
  });
});

describe('bot filter', () => {
  it.each(['Googlebot/2.1', 'Mozilla/5.0 (compatible; bingbot/2.0)', 'facebookexternalhit/1.1', 'WhatsApp/2.23.20.0', 'AhrefsBot/7.0', 'Slackbot-LinkExpanding 1.0', 'TelegramBot (like TwitterBot)', 'Mozilla/5.0 link preview', 'curl/8.4.0', 'Baiduspider', 'MwendavanoMonitor/1.0 bot', '-', ''])('drops %s', (ua) => expect(isBot(ua)).toBe(true));
  it('keeps real browsers', () => {
    expect(isBot(UA)).toBe(false);
    expect(isBot('Mozilla/5.0 (Linux; Android 13) Chrome/120.0 Mobile Safari/537.36')).toBe(false);
  });
});

describe('what counts as a page', () => {
  it.each(['/_nuxt/entry.abc.js', '/assets/app.css', '/logo.png', '/api/market/shops', '/favicon.ico', '/sitemap.xml', '/robots.txt', '/app.js?v=2'])('skips %s', (p) => expect(isStaticOrApi(p)).toBe(true));
  it.each(['/', '/shops/duka', '/p/123?ref=ig'])('keeps %s', (p) => expect(isStaticOrApi(p)).toBe(false));
  it('needs a good GET', () => {
    expect(isPageView(parseLine(line())!)).toBe(true);
    expect(isPageView(parseLine(line({ status: 304 }))!)).toBe(true);
    expect(isPageView(parseLine(line({ status: 404 }))!)).toBe(false);
    expect(isPageView(parseLine(line({ req: 'POST /login HTTP/1.1' }))!)).toBe(false);
  });
});

describe('referrers', () => {
  it.each([
    ['https://l.instagram.com/?u=x', 'Instagram'],
    ['android-app://com.instagram.android/', 'Instagram'],
    ['https://www.google.co.tz/', 'Google'],
    ['https://www.google.com/search', 'Google'],
    ['android-app://com.whatsapp/', 'WhatsApp'],
    ['https://wa.me/255700', 'WhatsApp'],
    ['https://m.facebook.com/', 'Facebook'],
    ['https://l.facebook.com/l.php', 'Facebook'],
    ['-', 'Direct'],
    ['', 'Direct'],
    ['https://example.com/', 'Other'],
    ['https://notgoogle.com/', 'Other'],
  ])('%s is %s', (ref, src) => expect(classifyReferrer(ref, 'dukanisoko.com')).toBe(src));
  it('ignores moves inside the site', () => {
    expect(classifyReferrer('https://dukanisoko.com/shops', 'dukanisoko.com')).toBeNull();
    expect(classifyReferrer('https://www.dukanisoko.com/', 'dukanisoko.com')).toBeNull();
  });
});

describe('visitor sketch', () => {
  it('is exact-ish when small and ignores repeats', () => {
    const s = newSketch();
    for (let n = 0; n < 5; n++) for (let i = 0; i < 40; i++) addVisitor(s, `10.0.0.${i}`, UA);
    expect(countSketch(s)).toBe(40);
  });
  it('counts a different browser on one IP separately', () => {
    const s = newSketch();
    addVisitor(s, '1.1.1.1', 'a');
    addVisitor(s, '1.1.1.1', 'b');
    expect(countSketch(s)).toBe(2);
  });
  it('stays within 5% at scale', () => {
    const s = newSketch();
    for (let i = 0; i < 20000; i++) addVisitor(s, `v${i}`, UA);
    expect(Math.abs(countSketch(s) - 20000) / 20000).toBeLessThan(0.05);
  });
  it('merges without double-counting', () => {
    const a = newSketch();
    const b = newSketch();
    for (let i = 0; i < 300; i++) addVisitor(a, `v${i}`, UA);
    for (let i = 150; i < 450; i++) addVisitor(b, `v${i}`, UA);
    mergeSketch(a, b);
    expect(Math.abs(countSketch(a) - 450)).toBeLessThan(20);
  });
});
