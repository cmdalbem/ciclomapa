import { slugify, hexToRgba, adjustColorBrightness, sizeOf } from './utils/utils.js';

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
