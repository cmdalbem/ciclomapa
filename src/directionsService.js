// Generalized directions service supporting multiple providers
import mbxDirections from '@mapbox/mapbox-sdk/services/directions';
import { MAPBOX_ACCESS_TOKEN, OPENROUTESERVICE_API_KEY, GRAPHHOPPER_API_KEY } from './constants';

// Abstract base class for directions providers
class DirectionsProvider {
    constructor(config = {}) {
        this.config = config;
    }

    async getDirections(from, to, options = {}) {
        throw new Error('getDirections method must be implemented by subclass');
    }

    // Normalize coordinates to [longitude, latitude] format
    normalizeCoordinates(coords) {
        if (!coords || !Array.isArray(coords) || coords.length < 2) {
            throw new Error('Invalid coordinates provided');
        }
        return [coords[0], coords[1]]; // Ensure [lng, lat] format
    }

    // Calculate bounding box from route coordinates
    calculateBbox(routes) {
        if (!routes || routes.length === 0) return null;

        let minLng = Infinity, minLat = Infinity;
        let maxLng = -Infinity, maxLat = -Infinity;

        routes.forEach(route => {
            if (route.geometry && route.geometry.coordinates) {
                route.geometry.coordinates.forEach(coord => {
                    const [lng, lat] = coord;
                    minLng = Math.min(minLng, lng);
                    minLat = Math.min(minLat, lat);
                    maxLng = Math.max(maxLng, lng);
                    maxLat = Math.max(maxLat, lat);
                });
            }
        });

        return [minLng, minLat, maxLng, maxLat];
    }
}

// Mapbox Directions API provider
class MapboxDirectionsProvider extends DirectionsProvider {
    constructor(config = {}) {
        super(config);
        this.client = mbxDirections({ accessToken: MAPBOX_ACCESS_TOKEN });
    }

    async getDirections(from, to, options = {}) {
        const fromCoords = this.normalizeCoordinates(from);
        const toCoords = this.normalizeCoordinates(to);

        try {
            const response = await this.client.getDirections({
                profile: options.profile || 'cycling',
                waypoints: [
                    { coordinates: fromCoords },
                    { coordinates: toCoords }
                ],
                geometries: options.geometries || 'geojson',
                overview: options.overview || 'full',
                alternatives: options.alternatives !== false,
                steps: options.steps || false,
                ...options.mapboxOptions // Allow custom Mapbox-specific options
            }).send();
            
            // Add bbox if not present in response
            const data = response.body;
            if (!data.bbox && data.routes) {
                data.bbox = this.calculateBbox(data.routes);
            }
            
            return data;
        } catch (err) {
            console.error('Mapbox Directions API error:', err);
            throw new Error(`Erro ao calcular rota: ${err.message}`);
        }
    }
}

// OpenRouteService provider (example of another provider)
class OpenRouteServiceProvider extends DirectionsProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = OPENROUTESERVICE_API_KEY;
        this.baseUrl = config.baseUrl || 'https://api.openrouteservice.org/v2/directions';
    }

    async getDirections(from, to, options = {}) {
        const fromCoords = this.normalizeCoordinates(from);
        const toCoords = this.normalizeCoordinates(to);

        try {
            const response = await fetch(`${this.baseUrl}/cycling-regular`, {
                method: 'POST',
                headers: {
                    'Authorization': this.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    coordinates: [fromCoords, toCoords],
                    format: 'geojson',
                    options: {
                        avoid_features: options.avoidFeatures || [],
                        profile_params: options.profileParams || {}
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Erro ao calcular rota: ${response.statusText}`);
            }

            const data = await response.json();
            return this.normalizeOpenRouteServiceResponse(data);
        } catch (err) {
            console.error('OpenRouteService API error:', err);
            throw new Error(`Erro ao calcular rota: ${err.message}`);
        }
    }

    // Convert OpenRouteService response to Mapbox-compatible format
    normalizeOpenRouteServiceResponse(data) {
        return {
            routes: data.features.map(feature => ({
                geometry: feature.geometry,
                distance: feature.properties.summary.distance,
                duration: feature.properties.summary.duration,
                weight: feature.properties.summary.duration
            })),
            waypoints: data.features[0]?.properties.way_points || [],
            bbox: data.bbox
        };
    }
}

// GraphHopper Directions API provider
class GraphHopperDirectionsProvider extends DirectionsProvider {
    constructor(config = {}) {
        super(config);
        this.apiKey = GRAPHHOPPER_API_KEY;
        this.baseUrl = config.baseUrl || 'https://graphhopper.com/api/1/route';
    }

    async getDirections(from, to, options = {}) {
        const fromCoords = this.normalizeCoordinates(from);
        const toCoords = this.normalizeCoordinates(to);

        if (!this.apiKey) {
            throw new Error('GraphHopper API key is required');
        }

        try {
            // GraphHopper uses GET requests with query parameters
            // Format: point=lat,lng (GraphHopper GET expects lat,lng)
            const params = new URLSearchParams({
                key: this.apiKey,
                vehicle: this.getGraphHopperProfile(options.profile || 'cycling'),
                type: 'json',
                instructions: 'false',
                elevation: 'false',
                points_encoded: 'false',
                calc_points: 'true',
                algorithm: 'alternative_route',
                'alternative_route.max_paths': 4,
                // Sets the factor by which the alternatives routes can be longer than the optimal route. Increasing can lead to worse alternatives. Default: 1.4
                'alternative_route.max_weight_factor': 2,
                // If algorithm=alternative_route, this parameter specifies how similar an alternative route can be to the optimal route. Increasing can lead to worse alternatives. Default:0.6
                'alternative_route.max_share_factor': 0.8,
            });
            
            // Add multiple points using append (GraphHopper expects multiple 'point' parameters)
            params.append('point', `${fromCoords[1]},${fromCoords[0]}`); // lat,lng format for GET
            params.append('point', `${toCoords[1]},${toCoords[0]}`);

            // Add optional parameters
            // if (options.avoidFeatures && options.avoidFeatures.length > 0) {
            //     const avoidList = options.avoidFeatures
            //         .map(feature => this.mapAvoidFeature(feature))
            //         .filter(Boolean);
            //     if (avoidList.length > 0) {
            //         params.append('avoid', avoidList.join(','));
            //     }
            // }

            const response = await fetch(`${this.baseUrl}?${params}`, {
                method: 'GET'
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erro ao calcular rota: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            return this.normalizeGraphHopperResponse(data);
        } catch (err) {
            console.error('GraphHopper API error:', err);
            throw new Error(`Erro ao calcular rota: ${err.message}`);
        }
    }

    // Map cycling profiles to GraphHopper vehicle types
    getGraphHopperProfile(profile) {
        const profileMap = {
            'cycling': 'bike',
            'cycling-road': 'bike',
            'cycling-mountain': 'mtb',
            'cycling-electric': 'bike',
            'walking': 'foot',
            'driving': 'car'
        };
        return profileMap[profile] || 'bike';
    }

    // Map avoid features to GraphHopper format
    mapAvoidFeature(feature) {
        const avoidMap = {
            'highways': 'highway',
            'tolls': 'toll',
            'ferries': 'ferry'
        };
        return avoidMap[feature];
    }

    // Convert GraphHopper response to Mapbox-compatible format
    normalizeGraphHopperResponse(data) {
        if (!data.paths || data.paths.length === 0) {
            throw new Error('Não foram encontradas rotas');
        }

        const routes = data.paths.map(path => ({
            geometry: {
                type: 'LineString',
                coordinates: path.points.coordinates // Already in [lng, lat] format from GraphHopper
            },
            distance: path.distance,
            duration: path.time / 1000, // Convert from milliseconds to seconds
            weight: path.time / 1000
        }));

        // Calculate bounding box from all route coordinates
        const bbox = this.calculateBbox(routes);

        return {
            routes,
            waypoints: data.paths[0]?.snapped_waypoints?.coordinates?.map(coord => ({
                coordinates: coord
            })) || [],
            bbox
        };
    }
}

// Main Directions Service
class DirectionsService {
    constructor(provider = 'mapbox', config = {}) {
        this.providers = {
            mapbox: new MapboxDirectionsProvider(config.mapbox || {}),
            openrouteservice: new OpenRouteServiceProvider(config.openrouteservice || {}),
            graphhopper: new GraphHopperDirectionsProvider(config.graphhopper || {})
        };
        
        this.currentProvider = this.providers[provider];
        if (!this.currentProvider) {
            throw new Error(`Unknown directions provider: ${provider}`);
        }
    }

    // Set the active provider
    setProvider(providerName) {
        if (!this.providers[providerName]) {
            throw new Error(`Unknown directions provider: ${providerName}`);
        }
        this.currentProvider = this.providers[providerName];
    }

    // Get available providers
    getAvailableProviders() {
        return Object.keys(this.providers);
    }

    // Main method to get directions
    async getDirections(from, to, options = {}) {
        return await this.currentProvider.getDirections(from, to, options);
    }

    // Convenience method for cycling directions (maintains backward compatibility)
    async getCyclingDirections(from, to, options = {}) {
        return await this.getDirections(from, to, { 
            profile: 'cycling', 
            ...options 
        });
    }
}

// Create default service instance
const directionsService = new DirectionsService('mapbox');

// Export both the service instance and the classes for advanced usage
export default directionsService;
export { DirectionsService, MapboxDirectionsProvider, OpenRouteServiceProvider, GraphHopperDirectionsProvider };

// Backward compatibility exports
export const getCyclingDirections = (from, to, options) => 
    directionsService.getCyclingDirections(from, to, options);
