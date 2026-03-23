import { getSystemThemePreference } from './themeUtils';

describe('getSystemThemePreference', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('returns true when prefers-color-scheme is dark', () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    expect(getSystemThemePreference()).toBe(true);
  });

  it('returns false when prefers-color-scheme is light', () => {
    window.matchMedia = jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      addListener: jest.fn(),
      removeListener: jest.fn(),
      dispatchEvent: jest.fn(),
    }));

    expect(getSystemThemePreference()).toBe(false);
  });

  it('returns false when matchMedia is unavailable', () => {
    const saved = window.matchMedia;
    // @ts-expect-error simulate environments without matchMedia
    window.matchMedia = undefined;

    expect(getSystemThemePreference()).toBe(false);

    window.matchMedia = saved;
  });
});
