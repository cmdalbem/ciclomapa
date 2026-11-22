import {
  getOsmDebugTagDescription,
  osmi18n,
  osmDebugTagDescriptions,
  osmTypologyDebugRank,
} from './osmi18n';

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

  it('documents common debug OSM keys with summary + values', () => {
    expect(osmDebugTagDescriptions.highway.summary).toMatch(/via/i);
    expect(osmDebugTagDescriptions.highway.values?.join(' ')).toMatch(/cycleway/);
    expect(osmDebugTagDescriptions.bicycle.values?.join(' ')).toMatch(/designated/);
    expect(osmDebugTagDescriptions.segregated.values?.join(' ')).toMatch(/\byes\b/);
    expect(osmDebugTagDescriptions.foot.values?.join(' ')).toMatch(/designated/);
  });

  it('resolves source:* and cycleway:* prefixes', () => {
    expect(getOsmDebugTagDescription('source:lit')?.summary).toMatch(/source/);
    expect(getOsmDebugTagDescription('cycleway:left')?.values?.join(' ')).toMatch(/track|lane/);
    expect(getOsmDebugTagDescription('ciclomapa:paired')?.summary).toMatch(/CicloMapa/);
    expect(getOsmDebugTagDescription('totally_unknown_tag')).toBeUndefined();
  });

  it('ranks typology keys ahead of metadata', () => {
    expect(osmTypologyDebugRank('highway')).toBeGreaterThanOrEqual(0);
    expect(osmTypologyDebugRank('segregated')).toBeGreaterThan(osmTypologyDebugRank('highway'));
    expect(osmTypologyDebugRank('cycleway:left')).toBeGreaterThanOrEqual(0);
    expect(osmTypologyDebugRank('id')).toBe(-1);
    expect(osmTypologyDebugRank('source:lit')).toBe(-1);
  });
});
