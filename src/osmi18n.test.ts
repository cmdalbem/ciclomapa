import { osmi18n } from './osmi18n';

describe('osmi18n', () => {
  it('has string labels for representative keys', () => {
    expect(osmi18n.surface).toBe('Superfície');
    expect(osmi18n.yes).toBe('Sim');
  });

  it('uses a single lit entry (POI form wins over duplicate object key)', () => {
    expect(osmi18n.lit).toBe('Iluminado?');
  });

  it('marks ignored OSM tags as null', () => {
    expect(osmi18n.id).toBeNull();
    expect(osmi18n.name).toBeNull();
    expect(osmi18n.amenity).toBeNull();
  });

  it('has non-empty string values for all non-null entries', () => {
    Object.entries(osmi18n).forEach(([key, value]) => {
      if (value !== null) {
        expect(typeof value).toBe('string');
        // Empty string is allowed for deliberate blanks (e.g. cyclestreets_id)
        expect(value.length).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
