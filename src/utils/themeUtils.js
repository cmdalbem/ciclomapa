/**
 * Theme detection utilities (system preference, etc.).
 * Used by App for initial theme state.
 */
export function getSystemThemePreference() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark;
  }
  return false; // Light mode as fallback
}
