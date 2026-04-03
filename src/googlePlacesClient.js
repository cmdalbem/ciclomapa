import GooglePlacesGeocoder from './GooglePlacesGeocoder.js';
import { GOOGLE_PLACES_API_KEY, GOOGLE_PLACES_DEFAULT_REGION } from './config/constants.js';

export const googlePlacesGeocoder = new GooglePlacesGeocoder({
  apiKey: GOOGLE_PLACES_API_KEY,
  language: 'pt-BR',
  region: GOOGLE_PLACES_DEFAULT_REGION,
});

let geocoderInitialized = false;

export async function ensureGooglePlacesReady() {
  if (!geocoderInitialized) {
    try {
      await googlePlacesGeocoder.loadGoogleMapsAPI();
      geocoderInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Google Places Geocoder:', error);
    }
  }
}

/** City / area strings from Google Places result shapes (DirectionsPanel + city search). */
export function getCityFromResultLike(resultLike) {
  const props =
    resultLike && (resultLike.properties || (resultLike.result && resultLike.result.properties));
  const addressComponents = props && props.address_components;
  if (!addressComponents || !Array.isArray(addressComponents)) return null;
  const findComp = (type) => addressComponents.find((c) => (c.types || []).includes(type));
  const locality = findComp('locality');
  const admin2 = findComp('administrative_area_level_2');
  const sublocality = findComp('sublocality');
  return (
    (locality && locality.long_name) ||
    (admin2 && admin2.long_name) ||
    (sublocality && sublocality.long_name) ||
    null
  );
}

export function getAreaStringFromResultLike(resultLike) {
  const props =
    resultLike && (resultLike.properties || (resultLike.result && resultLike.result.properties));
  const addressComponents = props && props.address_components;
  if (!addressComponents || !Array.isArray(addressComponents)) return null;
  const findComp = (type) => addressComponents.find((c) => (c.types || []).includes(type));
  const city = getCityFromResultLike(resultLike);
  const state =
    (findComp('administrative_area_level_1') &&
      (findComp('administrative_area_level_1').short_name ||
        findComp('administrative_area_level_1').long_name)) ||
    null;
  const country =
    (findComp('country') && (findComp('country').long_name || findComp('country').short_name)) ||
    null;
  const parts = [city, state, country].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

/** Reverse geocode with the same area label pipeline as forward city search. */
export async function reverseGeocodePlace(lngLat) {
  let coords = lngLat;

  if (lngLat && lngLat.lat !== undefined && lngLat.lng !== undefined) {
    coords = [lngLat.lng, lngLat.lat];
  }

  if (!coords || coords[0] === undefined || coords[1] === undefined) {
    throw new Error('Invalid coordinates');
  }

  await ensureGooglePlacesReady();
  const result = await googlePlacesGeocoder.reverseGeocode(coords);

  const place_name = getAreaStringFromResultLike(result) || result.place_name;

  return { place_name };
}
