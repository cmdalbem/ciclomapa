import {
  calculateSunPosition,
  getCurrentSunPosition,
  isCurrentlyDaytime,
} from './sunPositionUtils';

describe('calculateSunPosition', () => {
  it('returns bounded polar angle and numeric azimuth for a fixed datetime', () => {
    const date = new Date(Date.UTC(2024, 5, 15, 12, 0, 0));
    const pos = calculateSunPosition(-23.55, -46.63, date);

    expect(pos.azimuthal).toBeGreaterThanOrEqual(0);
    expect(pos.azimuthal).toBeLessThan(360);
    expect(pos.polar).toBeGreaterThanOrEqual(0);
    expect(pos.polar).toBeLessThanOrEqual(90);
    expect(typeof pos.altitude).toBe('number');
    expect(pos.isDaytime).toBe(pos.altitude > 0);
  });

  it('defaults date to current time when omitted', () => {
    const pos = calculateSunPosition(0, 0);
    expect(pos).toHaveProperty('azimuthal');
    expect(pos).toHaveProperty('polar');
  });
});

describe('getCurrentSunPosition', () => {
  it('returns a sun position object', () => {
    const pos = getCurrentSunPosition(-23.55, -46.63);
    expect(pos).toMatchObject({
      azimuthal: expect.any(Number),
      polar: expect.any(Number),
      altitude: expect.any(Number),
      isDaytime: expect.any(Boolean),
    });
  });
});

describe('isCurrentlyDaytime', () => {
  it('matches isDaytime from getCurrentSunPosition', () => {
    const lat = -23.55;
    const lng = -46.63;
    expect(isCurrentlyDaytime(lat, lng)).toBe(getCurrentSunPosition(lat, lng).isDaytime);
  });
});
