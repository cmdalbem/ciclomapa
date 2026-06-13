import GooglePlacesGeocoder from './GooglePlacesGeocoder.js';
import { GOOGLE_PLACES_API_KEY, GOOGLE_PLACES_DEFAULT_REGION } from './config/constants.js';

let googlePlacesGeocoder = null;
let geocoderInitialized = false;

export function getGooglePlacesGeocoder() {
  return googlePlacesGeocoder;
}

export async function ensureGooglePlacesReady() {
  if (!geocoderInitialized) {
    try {
      googlePlacesGeocoder = new GooglePlacesGeocoder({
        apiKey: GOOGLE_PLACES_API_KEY,
        language: 'pt-BR',
        region: GOOGLE_PLACES_DEFAULT_REGION,
      });
      await googlePlacesGeocoder.loadGoogleMapsAPI();
      geocoderInitialized = true;
    } catch (error) {
      console.error('Failed to initialize Google Places Geocoder:', error);
    }
  }
  return googlePlacesGeocoder;
}

function unwrapResultLike(resultLike) {
  const result = resultLike?.result || resultLike;
  const props = result?.properties || resultLike?.properties || {};
  return { result, props, addressComponents: props.address_components };
}

function findAddressComponent(addressComponents, type) {
  return Array.isArray(addressComponents)
    ? addressComponents.find((component) => (component.types || []).includes(type))
    : null;
}

/** City / area strings from Google Places result shapes (DirectionsPanel + city search). */
export function getCityFromResultLike(resultLike) {
  const { addressComponents } = unwrapResultLike(resultLike);
  const locality = findAddressComponent(addressComponents, 'locality');
  const admin2 = findAddressComponent(addressComponents, 'administrative_area_level_2');
  const sublocality = findAddressComponent(addressComponents, 'sublocality');
  return locality?.long_name || admin2?.long_name || sublocality?.long_name || null;
}

/**
 * Builds a short, "street-only" label from a reverse-geocode result.
 *
 * Used for the "fill origin with my current location" flow, where the full
 * formatted address (street, number, neighborhood, city, state, CEP, country)
 * is noisy. Returns e.g. "Rua das Flores, 123" or, when there is no street
 * number, just "Rua das Flores". Falls back to the first comma-separated
 * segment of the formatted address when no `route` is available.
 */
export function getShortAddressFromResultLike(resultLike) {
  const { result, addressComponents } = unwrapResultLike(resultLike);
  const route = findAddressComponent(addressComponents, 'route');
  const streetNumber = findAddressComponent(addressComponents, 'street_number');
  const premise = findAddressComponent(addressComponents, 'premise');

  if (route?.long_name) {
    return streetNumber?.long_name
      ? `${route.long_name}, ${streetNumber.long_name}`
      : route.long_name;
  }
  if (premise?.long_name) return premise.long_name;

  const fallbackSource =
    result?.place_name || resultLike?.place_name || resultLike?.formatted_address || '';
  return fallbackSource.split(',')[0].trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseAreaHint(area) {
  if (!area) return { city: null, state: null };
  const parts = area
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return {
    city: parts[0] || null,
    state: parts[1] || null,
  };
}

function getLocationHintsFromResultLike(resultLike, area) {
  const { addressComponents } = unwrapResultLike(resultLike);
  const stateComp = findAddressComponent(addressComponents, 'administrative_area_level_1');
  const areaHint = parseAreaHint(area);

  return {
    city: getCityFromResultLike(resultLike) || areaHint.city,
    state: stateComp?.long_name || areaHint.state,
    stateShort: stateComp?.short_name || (areaHint.state?.length <= 3 ? areaHint.state : null),
  };
}

function stripCityStateSuffix(text, hints = {}) {
  if (!text) return '';

  let trimmed = String(text).trim();
  const { city, state, stateShort } = hints;

  if (city && stateShort) {
    const cityStateShort = new RegExp(
      `,\\s*${escapeRegExp(city)}\\s*-\\s*${escapeRegExp(stateShort)}(?:\\s*,.*)?$`,
      'i'
    );
    trimmed = trimmed.replace(cityStateShort, '');
  }

  if (city && state) {
    const cityStateLong = new RegExp(
      `,\\s*${escapeRegExp(city)}\\s*,\\s*${escapeRegExp(state)}(?:\\s*,.*)?$`,
      'i'
    );
    trimmed = trimmed.replace(cityStateLong, '');
  }

  if (city) {
    const cityOnly = new RegExp(`,\\s*${escapeRegExp(city)}\\s*$`, 'i');
    trimmed = trimmed.replace(cityOnly, '');
  }

  // Fallback for Google BR formatting when hints are incomplete.
  trimmed = trimmed.replace(/,\s*[^,]+?\s*-\s*[A-Z]{2}\s*$/i, '');

  return trimmed.trim();
}

function combineStructuredLabel(mainText, secondaryText, hints) {
  const localSecondary = stripCityStateSuffix(secondaryText, hints);
  if (!localSecondary) return mainText;
  if (localSecondary.startsWith(mainText)) return localSecondary;
  return `${mainText} - ${localSecondary}`;
}

/**
 * Human-friendly label for directions inputs: keeps local place detail but
 * drops city, state, and country (redundant while routing within the map area).
 */
export function getDirectionsInputLabelFromResultLike(resultLike, { area } = {}) {
  const { result, props } = unwrapResultLike(resultLike);
  if (!result) return '';

  const hints = getLocationHintsFromResultLike(resultLike, area);
  const { main_text: mainText, secondary_text: secondaryText } = props.structured_formatting || {};

  if (mainText) {
    return combineStructuredLabel(mainText, secondaryText, hints);
  }

  const fallbackSource = result.place_name || props.formatted_address || result.text || '';
  return stripCityStateSuffix(fallbackSource, hints) || fallbackSource;
}

/**
 * Applies {@link getDirectionsInputLabelFromResultLike} to a geocoder result and
 * writes the short label back onto `place_name` so route points and inputs stay
 * consistent (favorites, Places search, reverse geocode).
 */
export function applyDirectionsInputLabelToResult(resultLike, { area } = {}) {
  const isWrapped = Boolean(resultLike?.result);
  const result = isWrapped ? resultLike.result : resultLike;
  if (!result) return resultLike;

  const displayLabel =
    getDirectionsInputLabelFromResultLike(resultLike, { area }) || result.place_name || '';

  const normalized = {
    ...result,
    place_name: displayLabel,
    text: displayLabel,
    properties: {
      ...(result.properties || {}),
      structured_formatting: {
        main_text: displayLabel,
        secondary_text: '',
      },
    },
  };

  return isWrapped ? { ...resultLike, result: normalized } : normalized;
}

export function getAreaStringFromResultLike(resultLike) {
  const { addressComponents } = unwrapResultLike(resultLike);
  const city = getCityFromResultLike(resultLike);
  const stateComp = findAddressComponent(addressComponents, 'administrative_area_level_1');
  const countryComp = findAddressComponent(addressComponents, 'country');
  const state = stateComp?.long_name || stateComp?.short_name || null;
  const country = countryComp?.long_name || countryComp?.short_name || null;
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
  const result = await getGooglePlacesGeocoder().reverseGeocode(coords);

  const place_name = getAreaStringFromResultLike(result) || result.place_name;

  return { place_name };
}
