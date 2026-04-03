import React from 'react';
import {
  HiLocationMarker,
  HiHome,
  HiShoppingBag,
  HiShoppingCart,
  HiCreditCard,
  HiAcademicCap,
  HiBookOpen,
  HiBeaker,
  HiSparkles,
  HiScissors,
  HiFilm,
} from 'react-icons/hi';
import {
  HiBuildingLibrary,
  HiBuildingOffice2,
  HiBuildingStorefront,
  HiCamera,
  HiCpuChip,
  HiCube,
  HiHomeModern,
  HiMapPin,
  HiTicket,
  HiBuildingOffice,
  HiTruck,
  HiWrenchScrewdriver,
} from 'react-icons/hi2';
import {
  FaBeer,
  FaBicycle,
  FaBowlingBall,
  FaBus,
  FaCampground,
  FaCar,
  FaCaravan,
  FaCoffee,
  FaDice,
  FaGasPump,
  FaHospital,
  FaHotel,
  FaLandmark,
  FaParking,
  FaPaw,
  FaPlaceOfWorship,
  FaSubway,
  FaTrain,
  FaTree,
  FaGem,
} from 'react-icons/fa';
import {
  MdAirplanemodeActive,
  MdFitnessCenter,
  MdLocalCarWash,
  MdLocalDining,
  MdRestaurant,
  MdSpa,
} from 'react-icons/md';

/**
 * Ordered most-specific → least-specific. `getPlaceTypeIconElement` picks the first
 * rule whose type appears in a Places/Geocoder `types` array (Google's order is ignored).
 */
const PLACE_TYPE_ICON_RULES = [
  // Food & drink
  ['meal_delivery', HiTruck],
  ['meal_takeaway', HiShoppingBag],
  ['restaurant', MdRestaurant],
  ['food', MdLocalDining],
  ['cafe', FaCoffee],
  ['bar', FaBeer],
  ['night_club', FaBeer],

  // Lodging & shopping
  ['lodging', HiHomeModern],
  ['hotel', FaHotel],
  ['shopping_mall', HiBuildingStorefront],
  ['store', HiBuildingStorefront],
  ['supermarket', HiShoppingCart],

  // Money & auto services
  ['gas_station', FaGasPump],
  ['bank', HiBuildingOffice2],
  ['atm', HiCreditCard],
  ['car_wash', MdLocalCarWash],
  ['car_repair', HiWrenchScrewdriver],
  ['car_dealer', FaCar],
  ['bicycle_store', FaBicycle],

  // Health, education, culture
  ['hospital', FaHospital],
  ['pharmacy', HiBeaker],
  ['school', HiAcademicCap],
  ['university', HiAcademicCap],
  ['library', HiBuildingLibrary],
  ['museum', FaLandmark],
  ['church', FaPlaceOfWorship],
  ['mosque', FaPlaceOfWorship],
  ['synagogue', FaPlaceOfWorship],
  ['hindu_temple', FaPlaceOfWorship],

  // Recreation & wellness
  ['amusement_park', HiTicket],
  ['zoo', FaPaw],
  ['park', FaTree],
  ['campground', FaCampground],
  ['rv_park', FaCaravan],
  ['tourist_attraction', HiCamera],
  ['casino', FaDice],
  ['bowling_alley', FaBowlingBall],
  ['movie_theater', HiFilm],
  ['movie_rental', HiFilm],
  ['gym', MdFitnessCenter],
  ['spa', MdSpa],
  ['beauty_salon', HiSparkles],
  ['hair_care', HiScissors],

  // Specialty retail
  ['book_store', HiBookOpen],
  ['electronics_store', HiCpuChip],
  ['furniture_store', HiCube],
  ['jewelry_store', FaGem],
  ['clothing_store', HiShoppingBag],
  ['shoe_store', HiShoppingBag],

  // Transit
  ['airport', MdAirplanemodeActive],
  ['train_station', FaTrain],
  ['subway_station', FaSubway],
  ['bus_station', FaBus],
  ['transit_station', HiMapPin],
  ['parking', FaParking],

  // Broad POI / business (prefer specific categories above)
  ['point_of_interest', FaLandmark],
  ['establishment', HiMapPin],

  // Street & parcel (finer address kinds before coarse geography)
  ['premise', HiBuildingOffice],
  ['subpremise', HiBuildingOffice],
  ['street_address', HiLocationMarker],
  ['intersection', HiLocationMarker],
  ['route', HiLocationMarker],
  ['natural_feature', HiLocationMarker],
  ['postal_code', HiLocationMarker],

  // Administrative (smaller → larger)
  ['neighborhood', HiLocationMarker],
  ['sublocality', HiLocationMarker],
  ['locality', HiLocationMarker],
  ['administrative_area_level_5', HiLocationMarker],
  ['administrative_area_level_4', HiLocationMarker],
  ['administrative_area_level_3', HiLocationMarker],
  ['administrative_area_level_2', HiLocationMarker],
  ['administrative_area_level_1', HiLocationMarker],
  ['country', HiLocationMarker],
  ['political', HiLocationMarker],
];

/** Country / state / continent-style Places `types`; used when {@link GooglePlacesGeocoder.search} `exclude.adminRegions` is on. */
export const DEFAULT_EXCLUDE_ADMIN_REGION_TYPES = [
  'country',
  'administrative_area_level_1',
  'continent',
];

const FINER_THAN_CITY_FOR_ADDRESS_SEARCH = new Set([
  'street_address',
  'route',
  'intersection',
  'establishment',
  'point_of_interest',
  'premise',
  'subpremise',
  'airport',
  'subway_station',
  'train_station',
  'bus_station',
  'transit_station',
  'park',
  'sublocality',
  'sublocality_level_1',
  'sublocality_level_2',
  'sublocality_level_3',
  'sublocality_level_4',
  'sublocality_level_5',
  'neighborhood',
  'postal_code',
  'floor',
  'room',
]);

/**
 * @param {object} [exclude]
 * @param {boolean|string[]|null} [exclude.adminRegions] — `true`/omit: default list; `false`/`null`: off; array: custom Places `types` to drop
 */
function resolveAdminRegionExcludeFromBlock(exclude) {
  const opt = exclude?.adminRegions;
  if (opt === false || opt === null) {
    return null;
  }
  if (Array.isArray(opt)) {
    return opt;
  }
  return [...DEFAULT_EXCLUDE_ADMIN_REGION_TYPES];
}

function predictionMatchesExcludedAdminRegionTypes(types, excludedList) {
  if (!excludedList?.length) return false;
  const t = types || [];
  return t.some((x) => excludedList.includes(x));
}

/** True when this is a bare city / admin_level_3 result (no street, POI, bairro, CEP, etc.). */
function isLocalityOnlyCityPrediction(types) {
  const t = types || [];
  const set = new Set(t);
  const inCityBucket = set.has('locality') || set.has('administrative_area_level_3');
  if (!inCityBucket) return false;
  for (const finer of FINER_THAN_CITY_FOR_ADDRESS_SEARCH) {
    if (set.has(finer)) return false;
  }
  return true;
}

/**
 * @param {string[]} [types] — Google Places `types` array
 * @param {object} [iconProps] — passed to the underlying react-icon (className defaults differ for matched vs fallback)
 */
export function getPlaceTypeIconElement(types, iconProps = {}) {
  const { className = 'text-gray-400', matchedClassName = 'text-gray-500', ...rest } = iconProps;

  if (!types || types.length === 0) {
    return React.createElement(HiLocationMarker, { className, ...rest });
  }
  const typeSet = new Set(types);
  for (const [type, Icon] of PLACE_TYPE_ICON_RULES) {
    if (typeSet.has(type)) {
      return React.createElement(Icon, { className: matchedClassName, ...rest });
    }
  }
  return React.createElement(HiLocationMarker, { className, ...rest });
}

/**
 * Single suggestion row for Ant Design AutoComplete (DirectionsPanel + city switcher).
 * Defaults match DirectionsPanel / LocationSearchInput.
 */
export function PlacesAutocompleteOptionLabel({
  suggestion,
  rowClassName = 'flex min-w-0 items-center gap-3 py-1',
  iconWrapperClassName = 'flex-shrink-0 text-lg opacity-70',
  primaryClassName = 'text-sm font-medium truncate',
  secondaryClassName = 'text-xs text-gray-400 truncate',
  iconClassName = 'text-gray-400',
  iconMatchedClassName = 'text-gray-500',
}) {
  const mainText =
    suggestion?.properties?.structured_formatting?.main_text || suggestion?.place_name || '';
  const secondaryText = suggestion?.properties?.structured_formatting?.secondary_text;

  return (
    <div className={rowClassName}>
      <span className={iconWrapperClassName}>
        {getPlaceTypeIconElement(suggestion?.properties?.types, {
          className: iconClassName,
          matchedClassName: iconMatchedClassName,
        })}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={primaryClassName}>{mainText}</span>
        {secondaryText ? <span className={secondaryClassName}>{secondaryText}</span> : null}
      </div>
    </div>
  );
}

/** One shared inject so HMR / concurrent callers do not append multiple script tags. */
let googleMapsScriptReadyPromise = null;

function ensureGoogleMapsScriptLoaded(apiKey, language, region) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps API not available (SSR)'));
  }
  if (window.google?.maps) {
    return Promise.resolve();
  }
  if (!googleMapsScriptReadyPromise) {
    googleMapsScriptReadyPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({
        key: apiKey,
        libraries: 'places',
        language,
        region,
      }).toString()}`;
      script.onload = () => resolve();
      script.onerror = () => {
        googleMapsScriptReadyPromise = null;
        reject(new Error('Failed to load Google Maps API'));
      };
      document.head.appendChild(script);
    });
  }
  return googleMapsScriptReadyPromise;
}

class GooglePlacesGeocoder {
  constructor(options = {}) {
    this.apiKey = options.apiKey;
    this.language = options.language || 'pt-BR';
    this.region = options.region || 'br';
    this.geocoder = null;
    this.autocompleteService = null;
    this.placesService = null;

    if (this.apiKey && window.google && window.google.maps) {
      this.initializeServices().catch((error) => {
        console.error('Failed to initialize services in constructor:', error);
      });
    } else if (this.apiKey) {
      this.loadGoogleMapsAPI().catch((error) => {
        console.error('Failed to load Google Maps API:', error);
      });
    }
  }

  async loadGoogleMapsAPI() {
    if (!this.apiKey) {
      throw new Error('Google Maps API key is missing');
    }
    await ensureGoogleMapsScriptLoaded(this.apiKey, this.language, this.region);
    await this.initializeServices();
  }

  async initializeServices() {
    if (!window.google?.maps) {
      throw new Error('Google Maps API not loaded');
    }

    const maps = window.google.maps;

    try {
      // Classic script URL (no loading=async): onload means Geocoder + libraries=places are ready.
      this.geocoder = new maps.Geocoder();

      if (maps.places?.AutocompleteService) {
        this.autocompleteService = new maps.places.AutocompleteService();
      }
      if (maps.places?.PlacesService) {
        const dummyDiv = document.createElement('div');
        this.placesService = new maps.places.PlacesService(dummyDiv);
      }
    } catch (error) {
      console.error('Failed to initialize Google Maps services:', error);
      throw error;
    }
  }

  async search(query, options = {}) {
    if (!this.autocompleteService) {
      throw new Error('Google Places API not initialized');
    }

    const request = {
      input: query,
      language: options.language || this.language,
      region: options.region || this.region,
      componentRestrictions: options.countryCodes ? { country: options.countryCodes } : undefined,
    };

    if (Array.isArray(options.types) && options.types.length > 0) {
      request.types = options.types;
    }

    if (options.proximity) {
      request.location = new window.google.maps.LatLng(options.proximity[1], options.proximity[0]);
      request.radius = options.radius || 50000;
    }

    const limit = options.limit || 5;
    const adminRegionExclude = resolveAdminRegionExcludeFromBlock(options.exclude);
    const excludeCityOnly = Boolean(options.exclude?.bareCity);

    return new Promise((resolve) => {
      this.autocompleteService.getPlacePredictions(request, (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          let filtered = predictions;
          if (adminRegionExclude) {
            filtered = filtered.filter(
              (p) => !predictionMatchesExcludedAdminRegionTypes(p.types, adminRegionExclude)
            );
          }
          if (excludeCityOnly) {
            filtered = filtered.filter((p) => !isLocalityOnlyCityPrediction(p.types));
          }
          const formattedResults = filtered
            .slice(0, limit)
            .map((prediction) => this.formatPredictionResult(prediction));
          resolve(formattedResults);
        } else {
          if (
            status !== window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS &&
            status !== window.google.maps.places.PlacesServiceStatus.OK
          ) {
            console.warn('Google Places API error:', status);
          }
          resolve([]);
        }
      });
    });
  }

  formatPredictionResult(prediction) {
    return {
      id: prediction.place_id,
      text: prediction.description,
      place_name: prediction.description,
      center: null, // Will be filled when place details are fetched
      geometry: {
        coordinates: null, // Will be filled when place details are fetched
      },
      properties: {
        types: prediction.types || [],
        place_id: prediction.place_id,
        structured_formatting: prediction.structured_formatting,
        prediction: prediction,
      },
    };
  }

  async getPlaceDetails(placeId) {
    if (!this.placesService) {
      throw new Error('Google Places Service not initialized');
    }

    return new Promise((resolve, reject) => {
      const request = {
        placeId: placeId,
        fields: ['geometry', 'formatted_address', 'name', 'types', 'address_component'],
      };

      this.placesService.getDetails(request, (place, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
          resolve({
            coordinates: [place.geometry.location.lng(), place.geometry.location.lat()],
            formatted_address: place.formatted_address,
            name: place.name,
            types: place.types,
            address_components: place.address_components,
          });
        } else {
          reject(new Error('Failed to get place details'));
        }
      });
    });
  }

  async reverseGeocode(lngLat, options = {}) {
    if (!this.geocoder) {
      throw new Error('Google Geocoder not initialized');
    }

    const request = {
      location: new window.google.maps.LatLng(lngLat[1], lngLat[0]),
      language: options.language || this.language,
    };

    return new Promise((resolve, reject) => {
      this.geocoder.geocode(request, (results, status) => {
        if (status === window.google.maps.GeocoderStatus.OK && results && results[0]) {
          resolve(this.formatReverseResult(results[0]));
        } else {
          console.warn('Google reverse geocoding error:', status);
          reject(new Error('Reverse geocoding failed'));
        }
      });
    });
  }

  formatReverseResult(result) {
    return {
      id: result.place_id || `reverse_${Date.now()}`,
      text: result.formatted_address,
      place_name: result.formatted_address,
      center: [result.geometry.location.lng(), result.geometry.location.lat()],
      properties: {
        address_components: result.address_components,
        types: result.types,
      },
      geometry: {
        type: 'Point',
        coordinates: [result.geometry.location.lng(), result.geometry.location.lat()],
      },
    };
  }
}

export { PLACE_TYPE_ICON_RULES };
export default GooglePlacesGeocoder;
