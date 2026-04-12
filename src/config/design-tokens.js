/**
 * Design tokens
 *
 * Exposed as CSS custom properties in index.js for use in stylesheets.
 * Layout/theme values used by JS (e.g. Map, TopBar) are imported from here or constants.
 *
 * Note: some “semantic” map/UI colors are intentionally kept consistent with layer styling
 * defined in `src/config/layers.json` and related map constants.
 */

export const colors = {
  // Backgrounds
  bgDark: '#1a1a1a',
  bgLight: '#EDEEED',
  // Route line (map)
  routeSelectedDark: '#C8681E',
  routeUnselectedDark: '#999999',
  routeSelectedLight: '#EA9010',
  routeUnselectedLight: '#cac7c4',
  // Loader / progress
  loader1: '#059669',
  loader2: '#b4fad0',
  loader3: '#f8c9ae',
  loader4: '#FFA500',
  // Logo (TopBar)
  logoDark: '#B6F9D1',
  logoLight: '#39583C',
  /** Favorites: hearts, active “Favoritar” on light surfaces; map `poi-favorite--light` should stay aligned. */
  favoriteAccent: '#F63737',
  /** Favorites on dark surfaces (`theme-dark`); slightly lighter for contrast — align `poi-favorite.png` if needed. */
  favoriteAccentDark: '#FF6B6B',
};

/** Map-specific colors for Mapbox paint (Map.js). Theme-based stroke, halo, route padding line, fallback. */
export const mapColors = {
  // Circle stroke: black in dark theme, white in light
  strokeDark: '#000000',
  strokeLight: '#ffffff',
  // Route border (outline): white in dark theme, black in light
  routeBorderDark: '#ffffff',
  routeBorderLight: '#000000',
  // Text/icon halo (readability on map)
  haloDark: '#1c1a17',
  haloLight: '#ffffff',
  iconHaloLight: '#dcdad8',
  // Route padding layer (line under main route)
  routePaddingLineDark: '#2d2e30',
  routePaddingLineLight: '#FFFFFF',
  // Cyclepath layer fallback when type is unknown
  cyclepathFallback: '#00ff00',
  // Map 3D light (setLight)
  lightColor: '#ffffff',
};

export const spacing = {
  topbarHeight: 64,
  panelPadding: 24,
  panelWidth: 440,
};

export const radius = {
  md: 8,
};

/** Typography scale (font sizes in px, weights, line heights). */
export const typography = {
  fontSizeXs: 12,
  fontSizeSm: 14,
  fontSizeBase: 16,
  fontSizeLg: 18,
  fontSizeXl: 20,
  fontWeightNormal: 400,
  fontWeightMedium: 500,
  fontWeightSemibold: 600,
  fontWeightBold: 700,
  lineHeightTight: 1.25,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.75,
};

/** Motion/duration for transitions (ms). Use with prefers-reduced-motion. */
export const motion = {
  durationFast: 150,
  durationNormal: 300,
  durationSlow: 500,
};

/** Focus ring for keyboard navigation / a11y */
// export const focusRing = '2px solid #0ea5e9';
export const focusRing = 'none';

export const layout = {
  spinnerSize: 60,
  progressBarHeight: 4,
};

/** For JS consumers that need route colors by theme (e.g. Map.js, InfrastructureBadge.js) */
export const ROUTE_COLORS = {
  DARK: {
    SELECTED: colors.routeSelectedDark,
    UNSELECTED: colors.routeUnselectedDark,
  },
  LIGHT: {
    SELECTED: colors.routeSelectedLight,
    UNSELECTED: colors.routeUnselectedLight,
  },
};

/** Favorites UI (import from JS when you need hex/RGB, e.g. charts or inline styles). */
export const FAVORITE_COLORS = {
  ACCENT: colors.favoriteAccent,
  ACCENT_DARK: colors.favoriteAccentDark,
};

/** For JS consumers that need map paint colors (Map.js). */
export const MAP_COLORS = {
  DARK: {
    STROKE: mapColors.strokeDark,
    ROUTE_BORDER: mapColors.routeBorderDark,
    HALO: mapColors.haloDark,
    ROUTE_PADDING_LINE: mapColors.routePaddingLineDark,
  },
  LIGHT: {
    STROKE: mapColors.strokeLight,
    ROUTE_BORDER: mapColors.routeBorderLight,
    HALO: mapColors.haloLight,
    ICON_HALO: mapColors.iconHaloLight,
    ROUTE_PADDING_LINE: mapColors.routePaddingLineLight,
  },
  CYCLEPATH_FALLBACK: mapColors.cyclepathFallback,
  LIGHT_COLOR: mapColors.lightColor,
};

export const TOPBAR_HEIGHT = spacing.topbarHeight;

/**
 * Returns CSS custom properties to set on :root (e.g. in index.js).
 * Keys are --kebab-case for CSS.
 */
export function getCssCustomProperties() {
  return {
    '--color-bg-dark': colors.bgDark,
    '--color-bg-light': colors.bgLight,
    '--color-route-selected-dark': colors.routeSelectedDark,
    '--color-route-unselected-dark': colors.routeUnselectedDark,
    '--color-route-selected-light': colors.routeSelectedLight,
    '--color-route-unselected-light': colors.routeUnselectedLight,
    '--color-loader-1': colors.loader1,
    '--color-loader-2': colors.loader2,
    '--color-loader-3': colors.loader3,
    '--color-loader-4': colors.loader4,
    '--color-logo-dark': colors.logoDark,
    '--color-logo-light': colors.logoLight,
    '--color-favorite-accent': colors.favoriteAccent,
    '--color-favorite-accent-dark': colors.favoriteAccentDark,
    /* Legacy names used by loader keyframes */
    '--color1': colors.loader1,
    '--color2': colors.loader2,
    '--color3': colors.loader3,
    '--color4': colors.loader4,
    '--spacing-topbar-height': `${spacing.topbarHeight}px`,
    '--spacing-panel': `${spacing.panelPadding}px`,
    '--spacing-panel-width': `${spacing.panelWidth}px`,
    '--radius-md': `${radius.md}px`,
    '--focus-ring': focusRing,
    '--layout-spinner-size': `${layout.spinnerSize}px`,
    '--layout-progress-bar-height': `${layout.progressBarHeight}px`,
    '--spinner-size': `${layout.spinnerSize}px`,
    '--progress-bar-height': `${layout.progressBarHeight}px`,
    /* Typography */
    '--font-size-xs': `${typography.fontSizeXs}px`,
    '--font-size-sm': `${typography.fontSizeSm}px`,
    '--font-size-base': `${typography.fontSizeBase}px`,
    '--font-size-lg': `${typography.fontSizeLg}px`,
    '--font-size-xl': `${typography.fontSizeXl}px`,
    '--font-weight-normal': typography.fontWeightNormal,
    '--font-weight-medium': typography.fontWeightMedium,
    '--font-weight-semibold': typography.fontWeightSemibold,
    '--font-weight-bold': typography.fontWeightBold,
    '--line-height-tight': typography.lineHeightTight,
    '--line-height-normal': typography.lineHeightNormal,
    '--line-height-relaxed': typography.lineHeightRelaxed,
    /* Motion */
    '--motion-duration-fast': `${motion.durationFast}ms`,
    '--motion-duration-normal': `${motion.durationNormal}ms`,
    '--motion-duration-slow': `${motion.durationSlow}ms`,
  };
}
