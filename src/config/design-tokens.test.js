/**
 * Token regression tests: assert that design tokens are defined and have expected shape.
 * Run with the rest of the suite (e.g. yarn test) so token changes are caught in CI.
 */
import {
  getCssCustomProperties,
  colors,
  ROUTE_COLORS,
  MAP_COLORS,
  typography,
  motion,
} from './design-tokens.js';

describe('design tokens', () => {
  describe('getCssCustomProperties', () => {
    it('returns an object with --kebab-case keys and non-empty values', () => {
      const props = getCssCustomProperties();
      expect(typeof props).toBe('object');
      expect(Object.keys(props).length).toBeGreaterThan(0);
      Object.entries(props).forEach(([key, value]) => {
        expect(key).toMatch(/^--[a-z0-9-]+$/);
        expect(value !== undefined && value !== null).toBe(true);
        if (typeof value === 'string') expect(value.length).toBeGreaterThan(0);
      });
    });

    it('includes required color tokens', () => {
      const props = getCssCustomProperties();
      expect(props['--color-bg-dark']).toBe(colors.bgDark);
      expect(props['--color-bg-light']).toBe(colors.bgLight);
      expect(props['--color-logo-dark']).toBe(colors.logoDark);
      expect(props['--color-logo-light']).toBe(colors.logoLight);
    });

    it('includes required spacing and layout tokens', () => {
      const props = getCssCustomProperties();
      expect(props['--spacing-topbar-height']).toMatch(/^\d+px$/);
      expect(props['--spacing-panel-width']).toMatch(/^\d+px$/);
      expect(props['--radius-md']).toMatch(/^\d+px$/);
      expect(props).toHaveProperty('--focus-ring');
    });

    it('includes typography tokens', () => {
      const props = getCssCustomProperties();
      expect(props['--font-size-base']).toBe(`${typography.fontSizeBase}px`);
      expect(props['--font-weight-normal']).toBe(typography.fontWeightNormal);
      expect(props['--line-height-normal']).toBe(typography.lineHeightNormal);
    });

    it('includes motion tokens', () => {
      const props = getCssCustomProperties();
      expect(props['--motion-duration-fast']).toBe(`${motion.durationFast}ms`);
      expect(props['--motion-duration-normal']).toBe(`${motion.durationNormal}ms`);
    });
  });

  describe('ROUTE_COLORS', () => {
    it('has DARK and LIGHT with SELECTED and UNSELECTED', () => {
      expect(ROUTE_COLORS.DARK.SELECTED).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(ROUTE_COLORS.DARK.UNSELECTED).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(ROUTE_COLORS.LIGHT.SELECTED).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(ROUTE_COLORS.LIGHT.UNSELECTED).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  describe('MAP_COLORS', () => {
    it('has DARK and LIGHT theme keys and CYCLEPATH_FALLBACK', () => {
      expect(MAP_COLORS.DARK.STROKE).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(MAP_COLORS.DARK.HALO).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(MAP_COLORS.LIGHT.STROKE).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(MAP_COLORS.LIGHT.HALO).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(MAP_COLORS.CYCLEPATH_FALLBACK).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(MAP_COLORS.LIGHT_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });
});
