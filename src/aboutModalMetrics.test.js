import {
  getAboutModalMetrics,
  formatLengthStrategyLabel,
  formatMapDataUpdatedAt,
} from './aboutModalMetrics.js';

describe('aboutModalMetrics', () => {
  const minimalLayers = [
    { id: 'ciclovia', name: 'Ciclovia', shortName: 'Ciclovia', type: 'way' },
    { id: 'ciclofaixa', name: 'Ciclofaixa', shortName: 'Ciclofaixa', type: 'way' },
    { id: 'ciclorrota', name: 'Ciclorrota', shortName: 'Ciclorrota', type: 'way' },
    {
      id: 'calcada-compartilhada',
      name: 'Calçada compartilhada',
      shortName: 'Calçada',
      type: 'way',
    },
    { id: 'bicipark', name: 'Bicicletários', shortName: 'Bicis', type: 'poi' },
  ];

  it('sums infra km and poi counts', () => {
    const lengths = {
      ciclovia: 10,
      ciclofaixa: 5.5,
      ciclorrota: 2,
      'calcada-compartilhada': 1.5,
      bicipark: 42,
    };
    const m = getAboutModalMetrics(lengths, minimalLayers);
    expect(m.infraTotalKm).toBeCloseTo(19, 5);
    expect(m.infraRows).toHaveLength(4);
    expect(m.cicloviaCiclofaixaKm).toBeCloseTo(15.5, 5);
    expect(m.poiTotal).toBe(42);
    expect(m.poiRows.some((r) => r.id === 'bicipark' && r.count === 42)).toBe(true);
  });

  it('returns null when layers missing', () => {
    expect(getAboutModalMetrics({}, null)).toBe(null);
  });

  it('formatLengthStrategyLabel maps defaults', () => {
    expect(formatLengthStrategyLabel('average')).toMatch(/média/);
  });

  it('formatMapDataUpdatedAt formats pt-BR', () => {
    const s = formatMapDataUpdatedAt(new Date('2026-03-15T14:30:00Z'));
    expect(s).toBeTruthy();
    expect(typeof s).toBe('string');
  });
});
