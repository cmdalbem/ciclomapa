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
  // Bicing (Preview)
  BICING_GBFS: 'bicing-gbfs',
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
  [API_TYPES.BICING_GBFS]: 'GBFS',
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
  [API_TYPES.BICING_GBFS]: '#E56119',
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
    id: 'bicing',
    label: 'Bicing',
    color: '#E56119',
    types: [API_TYPES.BICING_GBFS],
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
