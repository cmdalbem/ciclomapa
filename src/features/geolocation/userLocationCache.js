/**
 * App-wide singleton cache of the user's current geolocation.
 *
 * The directions panel's "fill origin with my location" feature used to call
 * `navigator.geolocation.getCurrentPosition` from scratch every time the panel
 * was opened, with `enableHighAccuracy: true`. That can take 5-10 seconds (or
 * time out) indoors. This module keeps the most recent known position in
 * memory and lets any caller:
 *
 *   1. Read it synchronously if it's fresh enough (`get`).
 *   2. Push a position into it from anywhere else in the app (`set`) -- for
 *      example, the Mapbox GeolocateControl already gets a fix when the user
 *      taps the map's location button, so we reuse that for free.
 *   3. Kick off a fresh request (`requestUpdate`) with sensible defaults
 *      tuned for "fill an address field", not for navigation.
 *
 * The cache is intentionally module-scoped (singleton) -- it represents
 * device state, not React state.
 */

const DEFAULT_REQUEST_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 6000,
  maximumAge: 60000,
};

const HIGH_ACCURACY_REQUEST_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000,
};

let cached = null;
let inFlightRequest = null;
const subscribers = new Set();

function notifySubscribers() {
  subscribers.forEach((fn) => {
    try {
      fn(cached);
    } catch (err) {
      console.error('userLocationCache subscriber threw:', err);
    }
  });
}

/**
 * Returns the cached position if it is fresher than `maxAgeMs`, otherwise null.
 */
export function get(maxAgeMs = 120_000) {
  if (!cached) return null;
  if (Date.now() - cached.timestamp > maxAgeMs) return null;
  return cached;
}

/**
 * Stores a position in the cache. `source` is a free-form string for logging
 * (e.g. 'mapbox-geolocate', 'navigator', 'warmup').
 */
export function set(coords, { accuracy, source } = {}) {
  if (!coords || typeof coords.lng !== 'number' || typeof coords.lat !== 'number') {
    return;
  }
  cached = {
    coords: { lng: coords.lng, lat: coords.lat },
    accuracy: accuracy ?? null,
    timestamp: Date.now(),
    source: source || 'unknown',
  };
  console.debug('userLocationCache updated from', cached.source, cached.coords);
  notifySubscribers();
}

/**
 * Subscribes to cache updates. Returns an unsubscribe function.
 */
export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

/**
 * Asks the browser for the current position and stores it in the cache.
 * Coalesces concurrent callers so a panel-open + warm-up race doesn't fire
 * two prompts. Resolves with the cached entry on success, null on failure.
 */
export function requestUpdate({ highAccuracy = false } = {}) {
  if (inFlightRequest) return inFlightRequest;

  if (!('geolocation' in navigator)) {
    return Promise.resolve(null);
  }

  const options = highAccuracy ? HIGH_ACCURACY_REQUEST_OPTIONS : DEFAULT_REQUEST_OPTIONS;

  inFlightRequest = new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        set(
          { lng: position.coords.longitude, lat: position.coords.latitude },
          {
            accuracy: position.coords.accuracy,
            source: highAccuracy ? 'navigator-high' : 'navigator',
          }
        );
        inFlightRequest = null;
        resolve(cached);
      },
      (error) => {
        console.debug('userLocationCache requestUpdate failed:', error.code, error.message);
        inFlightRequest = null;
        resolve(null);
      },
      options
    );
  });

  return inFlightRequest;
}

/**
 * Checks the Permissions API (if available) and only warms up the cache when
 * the user has already granted geolocation -- avoids surprising them with an
 * early permission prompt before they've tapped anything that needs it.
 */
export async function warmUpIfAlreadyGranted() {
  try {
    if (!navigator.permissions || !navigator.permissions.query) {
      // Browser doesn't support Permissions API for geolocation; skip the
      // warm-up rather than risk a surprise prompt.
      return null;
    }
    const status = await navigator.permissions.query({ name: 'geolocation' });
    if (status.state !== 'granted') {
      return null;
    }
    return requestUpdate({ highAccuracy: false });
  } catch (err) {
    console.debug('userLocationCache warmUp skipped:', err);
    return null;
  }
}

const userLocationCache = {
  get,
  set,
  subscribe,
  requestUpdate,
  warmUpIfAlreadyGranted,
};

export default userLocationCache;
