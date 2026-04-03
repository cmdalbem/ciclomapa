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
  HiGlobe,
  HiMap,
  HiFlag,
} from 'react-icons/hi';
import {
  HiBolt,
  HiBriefcase,
  HiBuildingLibrary,
  HiBuildingOffice2,
  HiBuildingStorefront,
  HiCamera,
  HiCpuChip,
  HiCube,
  HiHomeModern,
  HiMapPin,
  HiMusicalNote,
  HiSun,
  HiTicket,
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
  FaSpa,
  FaSubway,
  FaTrain,
  FaTree,
} from 'react-icons/fa';
import { MdAirplanemodeActive, MdLocalCarWash, MdLocalDining, MdRestaurant } from 'react-icons/md';

/**
 * Ordered most-specific → least-specific. `getPlaceTypeIcon` picks the first
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
  ['gym', HiBolt],
  ['spa', FaSpa],
  ['beauty_salon', HiSparkles],
  ['hair_care', HiScissors],

  // Specialty retail
  ['book_store', HiBookOpen],
  ['electronics_store', HiCpuChip],
  ['furniture_store', HiCube],
  ['jewelry_store', HiSparkles],
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
  ['point_of_interest', HiMapPin],
  ['establishment', HiMapPin],

  // Street & parcel (finer address kinds before coarse geography)
  ['premise', HiHome],
  ['subpremise', HiHome],
  ['street_address', HiLocationMarker],
  ['intersection', HiLocationMarker],
  ['route', HiLocationMarker],
  ['natural_feature', HiSun],
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
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        this.initializeServices().then(resolve).catch(reject);
        return;
      }

      const script = document.createElement('script');
      // Load the latest version without specifying a version number
      script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places&language=${this.language}&region=${this.region}&loading=async`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        // Add a small delay to ensure all services are loaded
        setTimeout(async () => {
          try {
            await this.initializeServices();
            resolve();
          } catch (error) {
            reject(error);
          }
        }, 100);
      };

      script.onerror = () => {
        reject(new Error('Failed to load Google Maps API'));
      };

      document.head.appendChild(script);
    });
  }

  async initializeServices() {
    if (!window.google || !window.google.maps) {
      throw new Error('Google Maps API not loaded');
    }

    try {
      // Initialize both services for comprehensive results
      this.geocoder = new window.google.maps.Geocoder();

      // Try to use AutocompleteService for rich place suggestions
      if (window.google.maps.places && window.google.maps.places.AutocompleteService) {
        this.autocompleteService = new window.google.maps.places.AutocompleteService();
      }

      // Also try PlacesService for place details
      if (window.google.maps.places && window.google.maps.places.PlacesService) {
        // Create a dummy div for PlacesService (it requires a DOM element)
        const dummyDiv = document.createElement('div');
        this.placesService = new window.google.maps.places.PlacesService(dummyDiv);
      }
    } catch (error) {
      console.error('Failed to initialize Google Maps services:', error);
      // Fallback to just Geocoder if other services fail
      try {
        this.geocoder = new window.google.maps.Geocoder();
      } catch (fallbackError) {
        throw fallbackError;
      }
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
      types: options.types || ['establishment', 'geocode'],
      componentRestrictions: options.countryCodes ? { country: options.countryCodes } : undefined,
    };

    // Add location bias if provided
    if (options.proximity) {
      request.location = new window.google.maps.LatLng(options.proximity[1], options.proximity[0]);
      request.radius = options.radius || 50000; // 50km radius for Places API
    }

    return new Promise((resolve, reject) => {
      this.autocompleteService.getPlacePredictions(request, (predictions, status) => {
        if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
          const formattedResults = predictions
            .slice(0, options.limit || 5)
            .map((prediction) => this.formatPredictionResult(prediction));
          resolve(formattedResults);
        } else {
          console.warn('Google Places API error:', status);
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

  // Helper method to get icon for place type
  getPlaceTypeIcon(types) {
    if (!types || types.length === 0)
      return React.createElement(HiLocationMarker, { className: 'text-gray-400' });

    const typeSet = new Set(types);
    for (const [type, Icon] of PLACE_TYPE_ICON_RULES) {
      if (typeSet.has(type)) return React.createElement(Icon, { className: 'text-gray-500' });
    }

    return React.createElement(HiLocationMarker, { className: 'text-gray-400' }); // Default icon
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

export default GooglePlacesGeocoder;
