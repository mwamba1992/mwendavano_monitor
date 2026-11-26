import { isHostingNetwork } from './geo';
import { countSketch } from './log-parser';
import { FLOOD_LIMIT, settle } from './visitors.service';

describe('isHostingNetwork', () => {
  it('flags cloud and hosting companies', () => {
    for (const org of ['AMAZON-02', 'Google LLC', 'Microsoft Corporation', 'Hetzner Online GmbH', 'Contabo GmbH', 'OVH SAS',
      'DigitalOcean, LLC', 'Alibaba US Technology Co., Ltd.', 'Tencent Building, Kejizhongyi Avenue', 'Akamai Connected Cloud',
      'M247 Europe SRL', 'Some Hosting Ltd', 'Censys, Inc.']) {
      expect(isHostingNetwork(org)).toBe(true);
    }
  });

  it('leaves Tanzanian mobile and home networks alone', () => {
    for (const org of ['Vodacom Tanzania', 'Airtel Tanzania', 'MIC Tanzania (Tigo / Yas)', 'Halotel', 'Tanzania Telecommunications Corporation',
      'Zantel', 'Liquid Telecom Tanzania', 'Simbanet (T) Ltd', 'Safaricom Limited']) {
      expect(isHostingNetwork(org)).toBe(false);
    }
  });

  it('treats an unknown network as a person', () => {
    expect(isHostingNetwork(undefined)).toBe(false);
    expect(isHostingNetwork('')).toBe(false);
  });
});

describe('settle', () => {
  const browser = (ip: string, pageViews: number, arrivals = 0) => ({
    ip, userAgent: 'Mozilla/5.0', pageViews,
    arrivals: Array.from({ length: arrivals }, () => ({ source: 'Direct', place: 'Tanzania|Dar es Salaam' })),
  });

  it('counts normal browsers, their page views, sources and places', () => {
    const t = settle(new Map([['2026-11-17', new Map([['a', browser('41.59.1.1', 5, 1)], ['b', browser('197.250.1.1', 2, 1)]])]]));
    const day = t.get('2026-11-17')!;
    expect(day.pageViews).toBe(7);
    expect(countSketch(day.sketch)).toBe(2);
    expect(day.sources).toEqual({ Direct: 2 });
    expect(day.locations).toEqual({ 'Tanzania|Dar es Salaam': 2 });
  });

  it('drops a browser that floods the site', () => {
    const t = settle(new Map([['2026-11-17', new Map([['bot', browser('5.6.7.8', FLOOD_LIMIT + 1, 40)], ['p', browser('41.59.1.1', 3, 1)]])]]));
    const day = t.get('2026-11-17')!;
    expect(day.pageViews).toBe(3);
    expect(countSketch(day.sketch)).toBe(1);
    expect(day.locations).toEqual({ 'Tanzania|Dar es Salaam': 1 });
  });

  it('leaves a day out when only floods came', () => {
    expect(settle(new Map([['2026-11-17', new Map([['bot', browser('5.6.7.8', 500)]])]])).size).toBe(0);
  });
});
