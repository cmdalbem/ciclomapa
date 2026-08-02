/**
 * Lightweight singleton for tracking generic app data-loading state (GeoJSON, PMTiles, etc.),
 * as opposed to apiTracker.js which counts individual external API calls.
 * Feeds the "Data Sources" section of ApiDebugOverlay.
 */

export const DATA_SOURCE_STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  EMPTY: 'empty',
  ABORTED: 'aborted',
  ERROR: 'error',
};

/** Known data sources, in the order they should be displayed. Rows are shown even before
 * any load has happened, so the panel is useful the moment the app boots. */
export const DATA_SOURCE_DEFS = [
  { key: 'geojson-cache', label: 'GeoJSON (cache)' },
  { key: 'geojson-osm', label: 'GeoJSON (Overpass)' },
  { key: 'pmtiles', label: 'PMTiles' },
];

let _sources = Object.fromEntries(
  DATA_SOURCE_DEFS.map((def) => [def.key, { ...def, status: DATA_SOURCE_STATUS.IDLE, meta: {} }])
);
let _tokens = {};
let _tokenCounter = 0;
let _listeners = new Set();

function _notify() {
  const snapshot = { sources: { ..._sources } };
  _listeners.forEach((fn) => fn(snapshot));
}

/**
 * Mark a data source as starting to load.
 * @param {string} key stable id, e.g. 'geojson-osm'
 * @param {string} label human-readable name shown in the panel
 * @param {object} [meta] extra info to display right away (e.g. { area })
 * @returns {number} monotonic token; pass it to finishDataLoad so stale finishes are ignored
 */
export function startDataLoad(key, label, meta = {}) {
  const token = ++_tokenCounter;
  _tokens[key] = token;
  _sources[key] = {
    key,
    label,
    status: DATA_SOURCE_STATUS.LOADING,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    meta,
  };
  _notify();
  return token;
}

/**
 * Mark a previously started data source as finished.
 * @param {string} key
 * @param {{ meta?: object, error?: Error|string, status?: string, token?: number }} [opts] `status` overrides
 * the default success/error inference (e.g. DATA_SOURCE_STATUS.ABORTED or .EMPTY).
 * Pass the token from startDataLoad; finishes with a mismatched token are ignored.
 */
export function finishDataLoad(key, { meta = {}, error, status, token } = {}) {
  if (_tokens[key] != null && token !== _tokens[key]) return;

  const existing = _sources[key] || { key, label: key, startedAt: Date.now() };
  const durationMs = Date.now() - (existing.startedAt || Date.now());
  _sources[key] = {
    ...existing,
    status: status || (error ? DATA_SOURCE_STATUS.ERROR : DATA_SOURCE_STATUS.SUCCESS),
    updatedAt: Date.now(),
    durationMs,
    meta: { ...existing.meta, ...meta },
    error: error ? String(error.message || error) : undefined,
  };
  _notify();
}

/**
 * Subscribe to data-load updates. Returns an unsubscribe function.
 * The callback is called immediately with the current state.
 * @param {(snapshot: { sources: object }) => void} fn
 */
export function subscribeDataLoads(fn) {
  _listeners.add(fn);
  fn({ sources: { ..._sources } });
  return () => _listeners.delete(fn);
}

export function getDataLoadsSnapshot() {
  return { sources: { ..._sources } };
}
