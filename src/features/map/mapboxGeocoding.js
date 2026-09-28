/**
 * Reverse geocoding via Mapbox — used when a global search pick doesn't already
 * carry an area label (App.handleGlobalSearchPlaceSelect), and to guess the city
 * under the viewport when a panel needs per-city data (guessPlaceFromViewport).
 *
 * This replaces the Google Geocoding API path that was introduced in the city-switcher-v2
 * refactor (commit 6bccc22). Mapbox handles this use case at a much lower cost since we
 * only need a city/place name string, not Google's richer address components.
 *
 * To swap back to Google:
 *   - App.js:  change import from `./features/map/mapboxGeocoding.js` to `./googlePlacesClient.js`
 * The Google implementation (reverseGeocodePlace) is preserved there and ready to use.
 */
import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';
import { MAPBOX_ACCESS_TOKEN } from '../../config/constants.js';
import { API_TYPES, trackCall } from '../../dev/apiTracker.js';

const geocodingClient = mbxGeocoding({ accessToken: MAPBOX_ACCESS_TOKEN });

/**
 * Returns { place_name } — same shape as the Google reverseGeocodePlace in googlePlacesClient.js.
 * @param {[number, number] | { lng: number, lat: number }} lngLat
 */
export async function reverseGeocodePlace(lngLat) {
  let query = lngLat;

  if (lngLat && lngLat.lat !== undefined && lngLat.lng !== undefined) {
    query = [lngLat.lng, lngLat.lat];
  }

  if (!query || query[0] === undefined || query[1] === undefined) {
    throw new Error('Invalid coordinates');
  }

  trackCall({
    api: API_TYPES.MAPBOX_GEOCODING,
    details: `${query[1].toFixed(4)}, ${query[0].toFixed(4)}`,
  });

  const response = await geocodingClient
    .reverseGeocode({
      query,
      types: ['place'],
      limit: 1,
      language: ['pt-br'],
    })
    .send();

  const features = response.body.features;

  if (features && features[0]) {
    return {
      place_name: features[0].place_name,
      bbox: features[0].bbox,
    };
  }

  throw new Error('No geocoding results found');
}

/**
 * The points `guessPlaceFromViewport` samples: center first, then the four
 * offsets towards each corner at `VIEWPORT_SAMPLE_RADIUS`. Exported so the debug
 * overlay can draw exactly the same points the guess is using.
 *
 * @param {{ lng: number, lat: number }} center
 * @param {import('mapbox-gl').LngLatBounds | null} [bounds]
 * @returns {{ lng: number, lat: number }[]}
 */
// Fraction of the viewport span from center toward each corner. 0.25 sits halfway
// to the edge; 0.5 would be the corners; smaller keeps samples tighter around center.
export const VIEWPORT_SAMPLE_RADIUS = 0.2;

export function getViewportSamplePoints(center, bounds = null) {
  const points = [center];
  if (bounds && typeof bounds.getWest === 'function') {
    const dx = (bounds.getEast() - bounds.getWest()) * VIEWPORT_SAMPLE_RADIUS;
    const dy = (bounds.getNorth() - bounds.getSouth()) * VIEWPORT_SAMPLE_RADIUS;
    points.push(
      { lng: center.lng - dx, lat: center.lat + dy },
      { lng: center.lng + dx, lat: center.lat + dy },
      { lng: center.lng - dx, lat: center.lat - dy },
      { lng: center.lng + dx, lat: center.lat - dy }
    );
  }
  return points;
}

/**
 * Guess which city the user is looking at. Like a camera's multi-point metering: the
 * exact center can land on a lake / neighbouring municipality (Porto Alegre and its
 * Guaíba is the classic case), so we reverse-geocode the center plus four points
 * offset towards each corner (`VIEWPORT_SAMPLE_RADIUS`) and take the majority. Ties
 * go to the current area (keeps the user's context), then to the center sample.
 *
 * Any city is a valid answer here. Do NOT bias this towards cities in
 * `citySlugCatalog.js`: that catalog is a pre-seeded sample for SEO slugs / static
 * locations, not the set of cities CicloMapa supports (see docs/cities.md).
 *
 * Real numbers for the Guaíba case at z12.5: center = the lake itself, NW = Eldorado
 * do Sul, SW = Guaíba, NE + SE = Porto Alegre. Three samples all disagreed; five
 * give Porto Alegre a clear majority.
 *
 * @param {{ lng: number, lat: number }} center
 * @param {import('mapbox-gl').LngLatBounds | null} [bounds] current viewport; without
 *   it only the center is geocoded.
 * @param {{ currentArea?: string }} [prefs]
 * @returns {Promise<{ place_name: string }>}
 */
export async function guessPlaceFromViewport(center, bounds = null, prefs = {}) {
  const points = getViewportSamplePoints(center, bounds);
  const results = await Promise.allSettled(points.map((p) => reverseGeocodePlace(p)));
  const votes = new Map(); // place_name -> { count, firstIndex }
  results.forEach((r, i) => {
    if (r.status !== 'fulfilled' || !r.value?.place_name) return;
    const v = votes.get(r.value.place_name) || { count: 0, firstIndex: i };
    v.count += 1;
    votes.set(r.value.place_name, v);
  });

  if (votes.size === 0) {
    throw new Error('No geocoding results found for any viewport sample');
  }

  const score = (name, v) =>
    v.count * 100 + (prefs.currentArea && name === prefs.currentArea ? 10 : 0) - v.firstIndex;
  const [winner] = [...votes.entries()].sort(([na, a], [nb, b]) => score(nb, b) - score(na, a));
  if (votes.size > 1) {
    console.debug('[viewport-city] samples disagree:', Object.fromEntries(votes), '->', winner[0]);
  }
  return { place_name: winner[0] };
}
