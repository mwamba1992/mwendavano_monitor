import { locationKey, splitLocation, summarizeLocations } from './geo';

const record = (country?: string, city?: string) =>
  ({ country: country ? { names: { en: country } } : undefined, city: city ? { names: { en: city } } : undefined }) as any;

describe('locationKey', () => {
  it('keeps the country and city, and nothing else', () => {
    expect(locationKey(record('Tanzania', 'Dar es Salaam'))).toBe('Tanzania|Dar es Salaam');
  });

  it('copes with a country and no city, and with no match at all', () => {
    expect(locationKey(record('Kenya'))).toBe('Kenya|');
    expect(locationKey(null)).toBe('Unknown|');
  });

  it('cannot be split wrongly by a name holding the separator', () => {
    expect(splitLocation(locationKey(record('A|B', 'C|D')))).toEqual({ country: 'A B', city: 'C D' });
  });
});

describe('summarizeLocations', () => {
  it('adds cities up into their country, largest first', () => {
    const { countries, cities } = summarizeLocations({ 'Tanzania|Dar es Salaam': 6, 'Tanzania|Mwanza': 2, 'Kenya|Nairobi': 2 });
    expect(countries).toEqual([
      { name: 'Tanzania', n: 8, pct: 80 },
      { name: 'Kenya', n: 2, pct: 20 },
    ]);
    expect(cities[0]).toEqual({ name: 'Dar es Salaam, Tanzania', n: 6, pct: 60 });
  });

  it('counts a country with no known city, but does not list it as a city', () => {
    const { countries, cities } = summarizeLocations({ 'Kenya|': 3 });
    expect(countries).toEqual([{ name: 'Kenya', n: 3, pct: 100 }]);
    expect(cities).toEqual([]);
  });

  it('keeps unknown places out of the shares', () => {
    expect(summarizeLocations({ 'Unknown|': 9, 'Kenya|Nairobi': 1 }).countries).toEqual([{ name: 'Kenya', n: 1, pct: 100 }]);
  });

  it('lists the top places only', () => {
    const many = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`Country ${i}|`, i + 1]));
    expect(summarizeLocations(many, 3).countries.map((c) => c.n)).toEqual([9, 8, 7]);
  });

  it('is empty with nothing to show', () => {
    expect(summarizeLocations({})).toEqual({ countries: [], cities: [] });
  });
});
