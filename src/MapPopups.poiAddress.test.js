import {
  escapeHtml,
  formatAddressLineFromOsmProperties,
  formatNominatimReverseLine,
  omitAddressTagsForDetailGrid,
  primaryCityFromAreaLabel,
} from './MapPopups.js';

describe('MapPopups POI address helpers', () => {
  describe('escapeHtml', () => {
    it('escapes HTML special characters', () => {
      expect(escapeHtml('<a>')).toBe('&lt;a&gt;');
      expect(escapeHtml('A & B')).toBe('A &amp; B');
    });
  });

  describe('formatAddressLineFromOsmProperties', () => {
    it('returns addr:full when present', () => {
      expect(
        formatAddressLineFromOsmProperties({
          'addr:full': '  Av. Ipiranga, 123  ',
        })
      ).toBe('Av. Ipiranga, 123');
    });

    it('returns contact:address', () => {
      expect(
        formatAddressLineFromOsmProperties({
          'contact:address': 'Rua X, 10',
        })
      ).toBe('Rua X, 10');
    });

    it('combines street and housenumber', () => {
      expect(
        formatAddressLineFromOsmProperties({
          'addr:street': 'Rua da Praia',
          'addr:housenumber': '500',
        })
      ).toContain('Rua da Praia');
    });

    it('adds suburb and city when available (no state)', () => {
      const line = formatAddressLineFromOsmProperties({
        'addr:street': 'Rua A',
        'addr:housenumber': '1',
        'addr:suburb': 'Centro',
        'addr:city': 'Porto Alegre',
        'addr:state': 'RS',
      });
      expect(line).toMatch(/Rua A/);
      expect(line).toMatch(/Centro/);
      expect(line).toMatch(/Porto Alegre/);
      expect(line).not.toMatch(/\bRS\b/);
    });

    it('returns null when no address tags', () => {
      expect(formatAddressLineFromOsmProperties({ name: 'Bike shop' })).toBeNull();
      expect(formatAddressLineFromOsmProperties(null)).toBeNull();
    });
  });

  describe('omitAddressTagsForDetailGrid', () => {
    it('removes addr:* and contact:address', () => {
      const out = omitAddressTagsForDetailGrid({
        name: 'X',
        'addr:street': 'Rua A',
        'addr:city': 'Y',
        'contact:address': 'Z',
        website: 'http://example.com',
      });
      expect(out.name).toBe('X');
      expect(out.website).toBe('http://example.com');
      expect(out['addr:street']).toBeUndefined();
      expect(out['addr:city']).toBeUndefined();
      expect(out['contact:address']).toBeUndefined();
    });
  });

  describe('primaryCityFromAreaLabel', () => {
    it('returns first comma segment', () => {
      expect(primaryCityFromAreaLabel('Porto Alegre, RS, Brasil')).toBe('Porto Alegre');
      expect(primaryCityFromAreaLabel('São Paulo')).toBe('São Paulo');
    });
  });

  describe('formatNominatimReverseLine', () => {
    it('returns null on error payload', () => {
      expect(formatNominatimReverseLine({ error: 'x' })).toBeNull();
      expect(formatNominatimReverseLine(null)).toBeNull();
    });

    it('builds local line without state', () => {
      const line = formatNominatimReverseLine({
        display_name: 'Ignore this long string, Brazil',
        address: {
          road: 'Av. Borges de Medeiros',
          house_number: '123',
          suburb: 'Centro Histórico',
          city: 'Porto Alegre',
          state: 'Rio Grande do Sul',
          country: 'Brasil',
        },
      });
      expect(line).toContain('Av. Borges de Medeiros');
      expect(line).toContain('123');
      expect(line).toContain('Porto Alegre');
      expect(line).not.toMatch(/Rio Grande do Sul/);
      expect(line).not.toMatch(/Brasil/);
      expect(line).not.toContain('Ignore this long');
    });

    it('omits city when it matches selected map area', () => {
      const line = formatNominatimReverseLine(
        {
          address: {
            road: 'Rua X',
            suburb: 'Centro Histórico',
            city: 'Porto Alegre',
            state: 'RS',
          },
        },
        { selectedAreaLabel: 'Porto Alegre, Rio Grande do Sul, Brasil' }
      );
      expect(line).toBe('Rua X · Centro Histórico');
      expect(line).not.toMatch(/Porto Alegre/);
    });

    it('returns null when address block missing', () => {
      expect(formatNominatimReverseLine({ display_name: 'Only display' })).toBeNull();
    });
  });
});
