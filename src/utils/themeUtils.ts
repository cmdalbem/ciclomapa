/**
 * Theme detection utilities (system preference, etc.).
 * Used by App for initial theme state.
 */
export function getSystemThemePreference(): boolean {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}
