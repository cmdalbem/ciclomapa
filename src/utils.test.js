import {
  slugify,
  hexToRgba,
  adjustColorBrightness,
  sizeOf,
  removeAccents,
  getOsmUrl,
  formatTimeAgo,
} from './utils/utils.js';

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });
  it('removes non-word characters', () => {
    expect(slugify('Hello & World')).toBe('hello-and-world');
  });
  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });
});

describe('hexToRgba', () => {
  it('converts hex to rgba with default alpha 1', () => {
    expect(hexToRgba('#ffffff')).toBe('rgba(255, 255, 255, 1)');
  });
  it('converts hex to rgba with custom alpha', () => {
    expect(hexToRgba('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
  });
});

describe('adjustColorBrightness', () => {
  it('returns same color when percentage is 0', () => {
    expect(adjustColorBrightness('#ff0000', 0)).toBe('#ff0000');
  });
  it('brightens when percentage is positive', () => {
    const result = adjustColorBrightness('#808080', 0.2);
    expect(result).toMatch(/^#[0-9a-f]{6}$/i);
    expect(result).not.toBe('#808080');
  });
});

describe('sizeOf', () => {
  it('returns 0 for undefined', () => {
    expect(sizeOf(undefined)).toBe(0);
  });
  it('returns 8 for number', () => {
    expect(sizeOf(42)).toBe(8);
  });
  it('returns 2 * length for string', () => {
    expect(sizeOf('abc')).toBe(6);
  });
});

describe('removeAccents', () => {
  it('strips combining marks from accented characters', () => {
    expect(removeAccents('São Paulo')).toBe('Sao Paulo');
  });
  it('returns empty string for null or undefined', () => {
    expect(removeAccents(null)).toBe('');
    expect(removeAccents(undefined)).toBe('');
  });
});

describe('getOsmUrl', () => {
  it('builds OSM edit URL with zoom offset', () => {
    expect(getOsmUrl(-23.5, -46.6, 14)).toBe(
      'https://www.openstreetmap.org/edit#map=15/-23.5/-46.6'
    );
  });
});

describe('formatTimeAgo', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['Intl'] });
    jest.setSystemTime(new Date('2024-01-15T12:00:00.000Z'));
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('returns empty string for invalid date', () => {
    expect(formatTimeAgo('not-a-date')).toBe('');
  });

  it('formats relative time for a recent past date', () => {
    const past = new Date('2024-01-15T11:59:30.000Z');
    const out = formatTimeAgo(past, { locale: 'en-US' });
    expect(out.length).toBeGreaterThan(0);
  });

  it('capitalizes first letter when requested', () => {
    const past = new Date('2024-01-15T11:59:30.000Z');
    const out = formatTimeAgo(past, { locale: 'en-US', capitalizeFirstLetter: true });
    expect(out.charAt(0)).toBe(out.charAt(0).toUpperCase());
  });
});
