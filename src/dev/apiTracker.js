/**
 * Lightweight singleton for tracking external API calls across the app.
 * Feeds the ApiDebugOverlay component.
 */

const MAX_ENTRIES = 80;

export const API_TYPES = {
  GOOGLE_GEOCODING: 'google-geocoding',
  GOOGLE_PREDICTIONS: 'google-predictions',
  GOOGLE_PLACE_DETAILS: 'google-place-details',
  MAPBOX_GEOCODING: 'mapbox-geocoding',
};

export const API_LABELS = {
  [API_TYPES.GOOGLE_GEOCODING]: 'Reverse Geocode',
  [API_TYPES.GOOGLE_PREDICTIONS]: 'Predictions',
  [API_TYPES.GOOGLE_PLACE_DETAILS]: 'Place Details',
  [API_TYPES.MAPBOX_GEOCODING]: 'Reverse Geocode',
};

export const API_COLORS = {
  [API_TYPES.GOOGLE_GEOCODING]: '#ef4444',
  [API_TYPES.GOOGLE_PREDICTIONS]: '#f97316',
  [API_TYPES.GOOGLE_PLACE_DETAILS]: '#eab308',
  [API_TYPES.MAPBOX_GEOCODING]: '#22c55e',
};

/**
 * Known brand logos (favicon-sized PNGs from official CDNs).
 * Only add a brand here if its logo renders clearly at ~12px.
 */
export const BRAND_LOGOS = {
  google: 'https://www.gstatic.com/images/branding/googleg/1x/googleg_standard_color_16dp.png',
};

/** Billing groups: each billed API with its constituent call types. */
export const API_GROUPS = [
  {
    id: 'geocoding-api',
    label: 'Geocoding API',
    brand: 'google',
    color: '#ef4444',
    types: [API_TYPES.GOOGLE_GEOCODING],
  },
  {
    id: 'places-api',
    label: 'Places API',
    brand: 'google',
    color: '#f97316',
    types: [API_TYPES.GOOGLE_PREDICTIONS, API_TYPES.GOOGLE_PLACE_DETAILS],
  },
  {
    id: 'mapbox-geocoding',
    label: 'Mapbox Geocoding',
    color: '#22c55e',
    types: [API_TYPES.MAPBOX_GEOCODING],
  },
];

let _entries = [];
let _counts = Object.fromEntries(Object.values(API_TYPES).map((t) => [t, 0]));
let _listeners = new Set();

let _idCounter = 0;

function _notify() {
  const snapshot = { entries: _entries, counts: { ..._counts } };
  _listeners.forEach((fn) => fn(snapshot));
}

/**
 * Record an API call.
 * @param {{ api: string, details: string }} opts
 */
export function trackCall({ api, details = '' }) {
  _idCounter += 1;
  const entry = {
    id: _idCounter,
    timestamp: Date.now(),
    api,
    details,
  };
  _counts[api] = (_counts[api] || 0) + 1;
  _entries = [entry, ..._entries].slice(0, MAX_ENTRIES);
  _notify();
}

/**
 * Subscribe to tracker updates. Returns an unsubscribe function.
 * The callback is called immediately with the current state.
 * @param {(snapshot: { entries: object[], counts: object }) => void} fn
 */
export function subscribe(fn) {
  _listeners.add(fn);
  fn({ entries: _entries, counts: { ..._counts } });
  return () => _listeners.delete(fn);
}

export function getSnapshot() {
  return { entries: _entries, counts: { ..._counts } };
}

export function reset() {
  _entries = [];
  _counts = Object.fromEntries(Object.values(API_TYPES).map((t) => [t, 0]));
  _notify();
}
