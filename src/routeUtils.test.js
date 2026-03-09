import { formatDistance, formatDuration, getRouteScore } from './utils/routeUtils.js';

describe('formatDistance', () => {
  it('formats meters as km with one decimal', () => {
    expect(formatDistance(5500)).toBe('5.5 km');
  });
  it('returns N/A for null/undefined', () => {
    expect(formatDistance(null)).toBe('N/A');
    expect(formatDistance(undefined)).toBe('N/A');
  });
});

describe('formatDuration', () => {
  it('formats seconds as minutes', () => {
    expect(formatDuration(300)).toBe('5 min');
  });
  it('returns N/A for null/undefined', () => {
    expect(formatDuration(null)).toBe('N/A');
    expect(formatDuration(undefined)).toBe('N/A');
  });
});

describe('getRouteScore', () => {
  it('returns score and cssClass for route with coverage', () => {
    const route = {
      coverage: 80,
      coverageByType: { Ciclovia: 50, Ciclofaixa: 30 },
    };
    const result = getRouteScore(route);
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('cssClass');
    expect(typeof result.score).toBe('number');
    expect(['bg-red-600', 'bg-yellow-600', 'bg-green-600']).toContain(result.cssClass);
  });
  it('returns score null and cssClass null when route has no coverageByType', () => {
    const result = getRouteScore({});
    expect(result).toEqual({ score: null, cssClass: null });
  });
  it('returns score 0 and red class when totalCoverage is 0', () => {
    const route = { coverage: 0, coverageByType: {} };
    const result = getRouteScore(route);
    expect(result.score).toBe(0);
    expect(result.cssClass).toBe('bg-red-600');
  });
});
