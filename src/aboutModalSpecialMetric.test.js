import { getAboutModalSpecialMetric } from './aboutModalMetrics.js';

describe('getAboutModalSpecialMetric', () => {
  it('prefers PNB over IDECiclo when both exist', () => {
    const m = getAboutModalSpecialMetric({ pnb_total: 12, ideciclo: 0.4 });
    expect(m?.key).toBe('pnb');
    expect(m?.valueText).toMatch(/12/);
  });

  it('returns IDECiclo when PNB absent', () => {
    const m = getAboutModalSpecialMetric({ ideciclo: 0.375, ideciclo_year: 2023 });
    expect(m?.key).toBe('ideciclo');
    expect(m?.title).toBe('IDECiclo');
    expect(m?.year).toBe(2023);
  });

  it('returns null when neither is set', () => {
    expect(getAboutModalSpecialMetric({})).toBe(null);
    expect(getAboutModalSpecialMetric(null)).toBe(null);
  });
});
