import React from 'react';
import { 
    HiLocationMarker, 
    HiHome, 
    HiOfficeBuilding, 
    HiShoppingBag, 
    HiShoppingCart,
    HiCurrencyDollar,
    HiCreditCard,
    HiAcademicCap,
    HiBookOpen,
    HiLibrary,
    HiCake,
    HiBeaker,
    HiSparkles,
    HiHeart,
    HiScissors,
    HiCog,
    HiDeviceMobile,
    HiFilm,
    HiStar,
    HiFire,
    HiGlobe,
    HiMap,
    HiFlag
} from 'react-icons/hi';
import { 
    HiBuildingOffice,
    HiBuildingStorefront,
    HiBuildingLibrary,
    HiBuildingOffice2
} from 'react-icons/hi2';

class GooglePlacesGeocoder {
    constructor(options = {}) {
        this.apiKey = options.apiKey;
        this.language = options.language || 'pt-BR';
        this.region = options.region || 'br';
        this.geocoder = null;
        this.autocompleteService = null;
        this.placesService = null;
        
        if (this.apiKey && window.google && window.google.maps) {
            this.initializeServices().catch(error => {
                console.error('Failed to initialize services in constructor:', error);
            });
        } else if (this.apiKey) {
            this.loadGoogleMapsAPI().catch(error => {
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
            componentRestrictions: options.countryCodes ? { country: options.countryCodes } : undefined
        };

        // Add location bias if provided
        if (options.proximity) {
            request.location = new window.google.maps.LatLng(options.proximity[1], options.proximity[0]);
            request.radius = options.radius || 50000; // 50km radius for Places API
        }

        return new Promise((resolve, reject) => {
            this.autocompleteService.getPlacePredictions(request, (predictions, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                    const formattedResults = predictions.slice(0, options.limit || 5).map(prediction => 
                        this.formatPredictionResult(prediction)
                    );
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
                coordinates: null // Will be filled when place details are fetched
            },
            properties: {
                types: prediction.types || [],
                place_id: prediction.place_id,
                structured_formatting: prediction.structured_formatting,
                prediction: prediction
            }
        };
    }

    // Helper method to get icon for place type
    getPlaceTypeIcon(types) {
        if (!types || types.length === 0) return React.createElement(HiLocationMarker, { className: "text-gray-400" });
        
        const typeIcons = {
            // Establishments
            'restaurant': HiCake,
            'food': HiCake,
            'meal_takeaway': HiCake,
            'meal_delivery': HiCake,
            'cafe': HiBeaker, // Using HiBeaker instead of HiCoffee
            'bar': HiBeaker,
            'night_club': HiBeaker,
            'lodging': HiHome,
            'hotel': HiHome,
            'shopping_mall': HiShoppingBag,
            'store': HiShoppingBag,
            'supermarket': HiShoppingCart,
            'gas_station': HiCog,
            'bank': HiBuildingOffice2,
            'atm': HiCreditCard,
            'hospital': HiBuildingStorefront,
            'pharmacy': HiHeart,
            'school': HiBuildingLibrary,
            'university': HiAcademicCap,
            'library': HiBuildingLibrary,
            'museum': HiBuildingLibrary,
            'church': HiBuildingOffice,
            'mosque': HiBuildingOffice,
            'synagogue': HiBuildingOffice,
            'hindu_temple': HiBuildingOffice,
            'park': HiLocationMarker,
            'zoo': HiStar,
            'amusement_park': HiStar,
            'gym': HiBuildingOffice,
            'spa': HiBuildingOffice,
            'beauty_salon': HiSparkles,
            'hair_care': HiScissors,
            'car_wash': HiCog,
            'car_repair': HiCog,
            'car_dealer': HiCog,
            'bicycle_store': HiCog,
            'electronics_store': HiDeviceMobile,
            'furniture_store': HiHome,
            'clothing_store': HiShoppingBag,
            'shoe_store': HiShoppingBag,
            'jewelry_store': HiSparkles,
            'book_store': HiBookOpen,
            'movie_theater': HiFilm,
            'movie_rental': HiFilm,
            'bowling_alley': HiStar,
            'casino': HiStar,
            'tourist_attraction': HiLocationMarker,
            'rv_park': HiHome,
            'campground': HiHome,
            
            // Geographic
            'locality': HiBuildingOffice,
            'sublocality': HiBuildingOffice,
            'neighborhood': HiBuildingOffice,
            'administrative_area_level_1': HiBuildingOffice,
            'administrative_area_level_2': HiBuildingOffice,
            'administrative_area_level_3': HiBuildingOffice,
            'administrative_area_level_4': HiBuildingOffice,
            'administrative_area_level_5': HiBuildingOffice,
            'country': HiGlobe,
            'postal_code': HiLocationMarker,
            'street_address': HiHome,
            'route': HiMap,
            'intersection': HiLocationMarker,
            'political': HiFlag,
            'establishment': HiBuildingOffice,
            'point_of_interest': HiLocationMarker,
            'premise': HiHome,
            'subpremise': HiHome,
            'natural_feature': HiLocationMarker,
            'airport': HiBuildingOffice,
            'bus_station': HiBuildingOffice,
            'train_station': HiBuildingOffice,
            'subway_station': HiBuildingOffice,
            'transit_station': HiBuildingOffice,
            'parking': HiBuildingOffice
        };

        // Return the first matching icon, or default
        for (const type of types) {
            if (typeIcons[type]) {
                return React.createElement(typeIcons[type], { className: "text-gray-500" });
            }
        }
        
        return React.createElement(HiLocationMarker, { className: "text-gray-400" }); // Default icon
    }

    async getPlaceDetails(placeId) {
        if (!this.placesService) {
            throw new Error('Google Places Service not initialized');
        }

        return new Promise((resolve, reject) => {
            const request = {
                placeId: placeId,
                fields: ['geometry', 'formatted_address', 'name', 'types']
            };

            this.placesService.getDetails(request, (place, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && place) {
                    resolve({
                        coordinates: [
                            place.geometry.location.lng(),
                            place.geometry.location.lat()
                        ],
                        formatted_address: place.formatted_address,
                        name: place.name,
                        types: place.types
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
            language: options.language || this.language
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
                types: result.types
            },
            geometry: {
                type: 'Point',
                coordinates: [result.geometry.location.lng(), result.geometry.location.lat()]
            }
        };
    }

}

export default GooglePlacesGeocoder;
