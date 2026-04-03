import { HYBRID_MAX_RESULTS, SUPPORTED_COUNTRY_CODES } from './config/constants.js';
import { ensureGooglePlacesReady, googlePlacesGeocoder } from './googlePlacesClient.js';

/** Same threshold as DirectionsPanel origin/destination search. */
export const PLACES_AUTOCOMPLETE_MIN_QUERY_LENGTH = 3;

/**
 * Default result cap: responsive (desktop 5, mobile 3), shared with hybrid routing settings.
 * DirectionsPanel previously used a fixed 5; city modal already used HYBRID_MAX_RESULTS.
 */
export const PLACES_AUTOCOMPLETE_DEFAULT_LIMIT = HYBRID_MAX_RESULTS;

/**
 * Run a Places autocomplete query (predictions). Returns [] if the query is too short.
 *
 * @param {string} query
 * @param {object} [options]
 * @param {[number, number] | null} [options.proximity] — [lng, lat]
 * @param {string[]} [options.countryCodes]
 * @param {number} [options.limit]
 * @returns {Promise<object[]>}
 */
export async function searchPlacesForAutocomplete(query, options = {}) {
  const trimmed = (query ?? '').trim();
  if (!trimmed || trimmed.length < PLACES_AUTOCOMPLETE_MIN_QUERY_LENGTH) {
    return [];
  }

  const {
    proximity = null,
    countryCodes = [...SUPPORTED_COUNTRY_CODES],
    limit = PLACES_AUTOCOMPLETE_DEFAULT_LIMIT,
  } = options;

  await ensureGooglePlacesReady();
  const results = await googlePlacesGeocoder.search(trimmed, {
    proximity,
    countryCodes,
    limit,
  });
  return Array.isArray(results) ? results : [];
}

/**
 * Resolve a prediction from {@link searchPlacesForAutocomplete} to coordinates + merged properties.
 * Matches DirectionsPanel {@code handleSelect} / city modal POI pick behavior.
 *
 * @param {object} suggestion — item from {@link googlePlacesGeocoder.search}
 * @returns {Promise<{ result: object }>} — {@code result} is suitable for {@code handleGeocoderResult} / area helpers
 */
export async function geocodePlacesSuggestionToResult(suggestion) {
  if (!suggestion) {
    throw new Error('geocodePlacesSuggestionToResult: missing suggestion');
  }

  if (suggestion.properties?.place_id && !suggestion.center) {
    await ensureGooglePlacesReady();
    const details = await googlePlacesGeocoder.getPlaceDetails(suggestion.properties.place_id);
    const completeResult = {
      ...suggestion,
      center: details.coordinates,
      geometry: {
        coordinates: details.coordinates,
      },
      properties: {
        ...suggestion.properties,
        formatted_address: details.formatted_address,
        name: details.name,
        types: details.types,
        address_components: details.address_components,
      },
    };
    return { result: completeResult };
  }

  return { result: suggestion };
}
