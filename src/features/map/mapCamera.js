/**
 * Central camera helpers for Mapbox GL.
 *
 * Routine moves use `maxDuration` so Mapbox snaps on long flights instead of
 * swooping across the screen. Cinematic moves (e.g. `?flyto=` URL param) are uncapped.
 *
 * Do not pass `duration` to `flyMapTo` — a fixed duration bypasses the snap behavior.
 */

export const ROUTINE_FLY_MAX_DURATION_MS = 3000;

/** City picker, search, geocoder — snap when the computed flight would exceed the cap. */
export function flyMapTo(map, options = {}) {
  if (!map) return;
  const { duration: _duration, speed: _speed, minZoom: _minZoom, ...rest } = options;
  map.flyTo({
    speed: 1.5,
    ...rest,
    maxDuration: ROUTINE_FLY_MAX_DURATION_MS,
  });
}

/** Intentional showcase animations — no duration cap. */
export function flyMapToCinematic(map, options = {}) {
  if (!map) return;
  map.flyTo({
    ...options,
    essential: true,
  });
}
