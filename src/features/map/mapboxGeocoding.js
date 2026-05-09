/**
 * Reverse geocoding via Mapbox — used for high-frequency map-move area detection.
 *
 * This replaces the Google Geocoding API path that was introduced in the city-switcher-v2
 * refactor (commit 6bccc22). Mapbox handles this use case at a much lower cost since we
 * only need a city/place name string, not Google's richer address components.
 *
 * To swap back to Google:
 *   - Map.js:  change import from `./features/map/mapboxGeocoding.js` to `./googlePlacesClient.js`
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
