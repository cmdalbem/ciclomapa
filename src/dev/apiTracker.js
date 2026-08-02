/**
 * Lightweight singleton for tracking external API calls across the app.
 * Feeds the ApiDebugOverlay component.
 */

const MAX_ENTRIES = 80;

export const API_TYPES = {
  // Google
  GOOGLE_GEOCODING: 'google-geocoding',
  GOOGLE_PREDICTIONS: 'google-predictions',
  GOOGLE_PLACE_DETAILS: 'google-place-details',
  // Mapbox
  MAPBOX_GEOCODING: 'mapbox-geocoding',
  MAPBOX_DIRECTIONS: 'mapbox-directions',
  // OpenStreetMap
  NOMINATIM_SEARCH: 'nominatim-search',
  NOMINATIM_REVERSE: 'nominatim-reverse',
  OVERPASS: 'overpass',
  // Routing
  GRAPHHOPPER: 'graphhopper',
  VALHALLA: 'valhalla',
  ORS: 'openrouteservice',
  // Airtable
  AIRTABLE_READ: 'airtable-read',
  AIRTABLE_WRITE: 'airtable-write',
  // Firebase
  FIREBASE_READ: 'firebase-read',
  FIREBASE_WRITE: 'firebase-write',
};

export const API_LABELS = {
  [API_TYPES.GOOGLE_GEOCODING]: 'Reverse Geocode',
  [API_TYPES.GOOGLE_PREDICTIONS]: 'Predictions',
  [API_TYPES.GOOGLE_PLACE_DETAILS]: 'Place Details',
  [API_TYPES.MAPBOX_GEOCODING]: 'Geocoding',
  [API_TYPES.MAPBOX_DIRECTIONS]: 'Directions',
  [API_TYPES.NOMINATIM_SEARCH]: 'Search',
  [API_TYPES.NOMINATIM_REVERSE]: 'Reverse',
  [API_TYPES.OVERPASS]: 'Overpass QL',
  [API_TYPES.GRAPHHOPPER]: 'GraphHopper',
  [API_TYPES.VALHALLA]: 'Valhalla',
  [API_TYPES.ORS]: 'OpenRouteService',
  [API_TYPES.AIRTABLE_READ]: 'Read',
  [API_TYPES.AIRTABLE_WRITE]: 'Write',
  [API_TYPES.FIREBASE_READ]: 'Read',
  [API_TYPES.FIREBASE_WRITE]: 'Write',
};

export const API_COLORS = {
  [API_TYPES.GOOGLE_GEOCODING]: '#ef4444',
  [API_TYPES.GOOGLE_PREDICTIONS]: '#f97316',
  [API_TYPES.GOOGLE_PLACE_DETAILS]: '#eab308',
  [API_TYPES.MAPBOX_GEOCODING]: '#60a5fa',
  [API_TYPES.MAPBOX_DIRECTIONS]: '#3b82f6',
  [API_TYPES.NOMINATIM_SEARCH]: '#4ade80',
  [API_TYPES.NOMINATIM_REVERSE]: '#22c55e',
  [API_TYPES.OVERPASS]: '#16a34a',
  [API_TYPES.GRAPHHOPPER]: '#a78bfa',
  [API_TYPES.VALHALLA]: '#8b5cf6',
  [API_TYPES.ORS]: '#7c3aed',
  [API_TYPES.AIRTABLE_READ]: '#38bdf8',
  [API_TYPES.AIRTABLE_WRITE]: '#0ea5e9',
  [API_TYPES.FIREBASE_READ]: '#fb923c',
  [API_TYPES.FIREBASE_WRITE]: '#f97316',
};

/**
 * Brands that use inline SVG instead of an img URL.
 * Preferred when the official favicon looks poor at small sizes or on dark BGs.
 */
export const BRAND_LOGO_SVG = {
  google: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 5.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.96 11.96 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a15.92 15.92 0 0 1-4.087 5.571l.003.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>`,
  mapbox: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="12" fill="#4264FB"/>
    <path fill="#fff" d="M12 5.5C8.96 5.5 6.5 7.96 6.5 11c0 4.42 5.5 9 5.5 9s5.5-4.58 5.5-9c0-3.04-2.46-5.5-5.5-5.5zm0 7.5a2 2 0 1 1 0-4 2 2 0 0 1 0 4z"/>
  </svg>`,
  osm: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="12" fill="#7EBC6F"/>
    <circle cx="10.5" cy="10" r="4.5" fill="none" stroke="#fff" stroke-width="2.5"/>
    <line x1="13.7" y1="13.2" x2="17.5" y2="17" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`,
  firebase: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="12" fill="#F5820D"/>
    <path fill="#fff" d="M7.5 17.5 9.8 7.2l3 5.5 1.7-3.2 2.5 8H7.5z"/>
  </svg>`,
  airtable: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="12" fill="#18BFFF"/>
    <path fill="#fff" d="M6.5 8.2 12 5.5l5.5 2.7v1.1L12 12.1 6.5 9.3V8.2zm0 2.6 5 2.5v5.2l-5-2.4V10.8zm11 0v5.3l-5 2.4v-5.2l5-2.5z"/>
  </svg>`,
};

/** Billing groups: each billed API with its constituent call types. */
export const API_GROUPS = [
  {
    id: 'google-geocoding',
    label: 'Geocoding API',
    brand: 'google',
    color: '#ef4444',
    types: [API_TYPES.GOOGLE_GEOCODING],
  },
  {
    id: 'google-places',
    label: 'Places API',
    brand: 'google',
    color: '#f97316',
    types: [API_TYPES.GOOGLE_PREDICTIONS, API_TYPES.GOOGLE_PLACE_DETAILS],
  },
  {
    id: 'mapbox',
    label: 'Mapbox',
    brand: 'mapbox',
    color: '#4264fb',
    types: [API_TYPES.MAPBOX_GEOCODING, API_TYPES.MAPBOX_DIRECTIONS],
  },
  {
    id: 'osm',
    label: 'OpenStreetMap',
    brand: 'osm',
    color: '#7EBC6F',
    types: [API_TYPES.NOMINATIM_SEARCH, API_TYPES.NOMINATIM_REVERSE, API_TYPES.OVERPASS],
  },
  {
    id: 'airtable',
    label: 'Airtable',
    brand: 'airtable',
    color: '#0ea5e9',
    types: [API_TYPES.AIRTABLE_READ, API_TYPES.AIRTABLE_WRITE],
  },
  {
    id: 'firebase',
    label: 'Firebase',
    brand: 'firebase',
    color: '#F5820D',
    types: [API_TYPES.FIREBASE_READ, API_TYPES.FIREBASE_WRITE],
  },
  {
    id: 'routing',
    label: 'Routing',
    color: '#8b5cf6',
    // Multiple alternate engines — show each active service by name in the slim bar
    summaryPerType: true,
    types: [API_TYPES.GRAPHHOPPER, API_TYPES.VALHALLA, API_TYPES.ORS],
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
