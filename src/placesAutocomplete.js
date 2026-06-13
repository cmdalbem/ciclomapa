import { SUPPORTED_COUNTRY_CODES } from './config/constants.js';
import {
  ensureGooglePlacesReady,
  applyDirectionsInputLabelToResult,
  getDirectionsInputLabelFromResultLike,
  getGooglePlacesGeocoder,
} from './googlePlacesClient.js';

/** Same threshold as DirectionsPanel origin/destination search. */
export const PLACES_AUTOCOMPLETE_MIN_QUERY_LENGTH = 3;

/**
 * Default result cap: responsive (desktop 5, mobile 3), shared with hybrid routing settings.
 * DirectionsPanel previously used a fixed 5; city modal already used HYBRID_MAX_RESULTS.
 */
export const PLACES_AUTOCOMPLETE_DEFAULT_LIMIT = 5;

/**
 * Run a Places autocomplete query (predictions). Returns [] if the query is too short.
 *
 * @param {string} query
 * @param {object} [options]
 * @param {[number, number] | null} [options.proximity] — [lng, lat]
 * @param {string[]} [options.countryCodes]
 * @param {number} [options.limit]
 * @param {string[]} [options.types] — single-type requests only if including `establishment` (Google forbids mixing it)
 * @param {object} [options.exclude]
 * @param {boolean|string[]|null} [options.exclude.adminRegions] — country/state/continent rows; default on; `false`/`null` off; array = custom Places `types`
 * @param {boolean} [options.exclude.bareCity] — drop city-only rows (e.g. route endpoints)
 * @param {number} [options.radius]
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
    types,
    exclude,
    language,
    region,
    radius,
  } = options;

  await ensureGooglePlacesReady();
  const results = await getGooglePlacesGeocoder().search(trimmed, {
    proximity,
    countryCodes,
    limit,
    types,
    exclude,
    language,
    region,
    radius,
  });
  return Array.isArray(results) ? results : [];
}

/**
 * Resolve a prediction from {@link searchPlacesForAutocomplete} to coordinates + merged properties.
 * Matches DirectionsPanel {@code handleSelect} / city modal POI pick behavior.
 *
 * @param {object} suggestion — item from {@link getGooglePlacesGeocoder().search}
 * @returns {Promise<{ result: object }>} — {@code result} is suitable for {@code handleGeocoderResult} / area helpers
 */
/**
 * Options object for {@link searchPlacesForAutocomplete} — directions origin/destination field.
 * Keeps result density and city-only exclusion aligned across call sites.
 *
 * @param {{ getCenter: () => { lng: number; lat: number } } | null | undefined} map
 * @returns {object}
 */
export function getDirectionsPanelPlacesSearchOptions(map) {
  return {
    proximity: map ? [map.getCenter().lng, map.getCenter().lat] : null,
    exclude: { bareCity: true },
  };
}

/**
 * Maps a persisted favorite to an autocomplete suggestion for DirectionsPanel.
 * Coordinates are included so selection skips the Place Details API call.
 *
 * @param {import('./favoritesStore').FavoriteItem} favorite
 * @param {{ area?: string }} [options]
 */
export function favoriteToDirectionsSuggestion(favorite, { area } = {}) {
  const cityLabel = favorite.areaContext?.split(',')[0]?.trim();
  const addressComponents = cityLabel
    ? [{ long_name: cityLabel, short_name: cityLabel, types: ['locality', 'political'] }]
    : undefined;

  const suggestion = {
    id: `favorite:${favorite.id}`,
    isFavorite: true,
    place_name: favorite.title,
    center: [favorite.lng, favorite.lat],
    geometry: {
      type: 'Point',
      coordinates: [favorite.lng, favorite.lat],
    },
    properties: {
      place_id: favorite.placeId,
      types: favorite.placeTypes || [],
      name: favorite.title,
      formatted_address: favorite.subtitle,
      structured_formatting: {
        main_text: favorite.title,
        secondary_text: favorite.subtitle,
      },
      address_components: addressComponents,
      favoriteId: favorite.id,
    },
  };

  const commitLabel = getDirectionsInputLabelFromResultLike(suggestion, { area }) || favorite.title;

  return { ...suggestion, commitLabel };
}

/**
 * Options for CitySwitcherModal global search: cities stay visible unless caller overrides `exclude`.
 *
 * @param {{ lat: number; lng: number } | null | undefined} mapCenter
 * @param {object | undefined} placesAutocompleteOptions — forwarded modal prop (types, exclude, countryCodes, etc.)
 */
export function getCitySwitcherPlacesSearchOptions(mapCenter, placesAutocompleteOptions) {
  /** @type {[number, number] | null} */
  const proximity =
    mapCenter && Number.isFinite(mapCenter.lat) && Number.isFinite(mapCenter.lng)
      ? [mapCenter.lng, mapCenter.lat]
      : null;

  const { exclude: pasExclude, ...pasRest } = placesAutocompleteOptions ?? {};

  return {
    proximity: proximity ?? undefined,
    ...pasRest,
    exclude: { bareCity: false, ...pasExclude },
  };
}

export async function geocodePlacesSuggestionToResult(suggestion, { area } = {}) {
  if (!suggestion) {
    throw new Error('geocodePlacesSuggestionToResult: missing suggestion');
  }

  if (suggestion.properties?.place_id && !suggestion.center) {
    await ensureGooglePlacesReady();
    const details = await getGooglePlacesGeocoder().getPlaceDetails(suggestion.properties.place_id);
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
    return { result: applyDirectionsInputLabelToResult(completeResult, { area }) };
  }

  return { result: applyDirectionsInputLabelToResult(suggestion, { area }) };
}
