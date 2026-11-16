// Generalized directions service supporting multiple providers
import mbxDirections from '@mapbox/mapbox-sdk/services/directions';
import {
  MAPBOX_ACCESS_TOKEN,
  OPENROUTESERVICE_API_KEY,
  OPENROUTESERVICE_BASE_URL,
  GRAPHHOPPER_API_KEY,
  GRAPHHOPPER_BASE_URL,
  BROUTER_LOCAL_BASE_URL,
  USE_BROUTER_LOCAL,
  VALHALLA_BASE_URL,
} from './config/constants.js';
import { API_TYPES, trackCall } from './dev/apiTracker.js';

// Abstract base class for directions providers
class DirectionsProvider {
  constructor() {}

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

    let minLng = Infinity,
      minLat = Infinity;
    let maxLng = -Infinity,
      maxLat = -Infinity;

    routes.forEach((route) => {
      if (route.geometry && route.geometry.coordinates) {
        route.geometry.coordinates.forEach((coord) => {
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

class MapboxDirectionsProvider extends DirectionsProvider {
  constructor() {
    super();
    this.client = mbxDirections({ accessToken: MAPBOX_ACCESS_TOKEN });
  }

  async getDirections(from, to, options = {}) {
    const fromCoords = this.normalizeCoordinates(from);
    const toCoords = this.normalizeCoordinates(to);

    trackCall({
      api: API_TYPES.MAPBOX_DIRECTIONS,
      details: `${fromCoords[1].toFixed(4)},${fromCoords[0].toFixed(4)} → ${toCoords[1].toFixed(4)},${toCoords[0].toFixed(4)}`,
    });

    try {
      const response = await this.client
        .getDirections({
          profile: options.profile || 'cycling',
          waypoints: [{ coordinates: fromCoords }, { coordinates: toCoords }],
          geometries: options.geometries || 'geojson',
          overview: options.overview || 'full',
          alternatives: options.alternatives !== false,
          steps: options.steps || false,
          ...options.mapboxOptions, // Allow custom Mapbox-specific options
        })
        .send();

      // Add bbox if not present in response
      const data = response.body;
      if (!data.bbox && data.routes) {
        data.bbox = this.calculateBbox(data.routes);
      }

      if (options.signal?.aborted) {
        const abortErr = new Error('Aborted');
        abortErr.name = 'AbortError';
        throw abortErr;
      }

      return data;
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      console.error('Mapbox Directions API error:', err);
      throw new Error(`Erro ao calcular rota: ${err.message}`);
    }
  }
}

class OpenRouteServiceProvider extends DirectionsProvider {
  constructor() {
    super();
    this.apiKey = OPENROUTESERVICE_API_KEY;
    this.baseUrl = OPENROUTESERVICE_BASE_URL;
  }

  async getDirections(from, to, options = {}) {
    const fromCoords = this.normalizeCoordinates(from);
    const toCoords = this.normalizeCoordinates(to);

    if (!this.apiKey) {
      throw new Error('OpenRouteService API key is required');
    }

    trackCall({
      api: API_TYPES.ORS,
      details: `${fromCoords[1].toFixed(4)},${fromCoords[0].toFixed(4)} → ${toCoords[1].toFixed(4)},${toCoords[0].toFixed(4)}`,
    });

    try {
      // OpenRouteService expects API key as query parameter, not in Authorization header
      const url = `${this.baseUrl}/cycling-regular/geojson?api_key=${this.apiKey}`;

      const requestBody = {
        coordinates: [fromCoords, toCoords],
        format: 'geojson',
        alternative_routes: {
          target_count: 3,
          weight_factor: 2.5,
          share_factor: 0.5,
        },
        // elevation: true,
        instructions: false,
        extra_info: ['steepness'],
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: options.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenRouteService API error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Erro ao calcular rota: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return this.normalizeOpenRouteServiceResponse(data);
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      console.error('OpenRouteService API error:', err);
      throw new Error(`Erro ao calcular rota: ${err.message}`);
    }
  }

  // Convert OpenRouteService response to Mapbox-compatible format
  normalizeOpenRouteServiceResponse(data) {
    return {
      routes: data.features.map((feature) => ({
        geometry: feature.geometry,
        distance: feature.properties.summary.distance,
        duration: feature.properties.summary.duration,
        weight: feature.properties.summary.duration,
      })),
      waypoints: data.features[0]?.properties.way_points || [],
      bbox: data.bbox,
    };
  }
}

class GraphHopperDirectionsProvider extends DirectionsProvider {
  constructor() {
    super();
    this.apiKey = GRAPHHOPPER_API_KEY;
    this.baseUrl = GRAPHHOPPER_BASE_URL;
  }

  async getDirections(from, to, options = {}) {
    const fromCoords = this.normalizeCoordinates(from);
    const toCoords = this.normalizeCoordinates(to);

    if (!this.apiKey) {
      throw new Error('GraphHopper API key is required');
    }

    trackCall({
      api: API_TYPES.GRAPHHOPPER,
      details: `${fromCoords[1].toFixed(4)},${fromCoords[0].toFixed(4)} → ${toCoords[1].toFixed(4)},${toCoords[0].toFixed(4)}`,
    });

    try {
      const params = new URLSearchParams({
        profile: 'bike',
        type: 'json',
        instructions: 'false',
        points_encoded: 'false',
        calc_points: 'true',
        algorithm: 'alternative_route',
        'alternative_route.max_paths': 5,
        'alternative_route.max_weight_factor': 4,
        'alternative_route.max_share_factor': 0.5,
      });
      params.set('key', this.apiKey);
      params.append('point', `${fromCoords[1]},${fromCoords[0]}`);
      params.append('point', `${toCoords[1]},${toCoords[0]}`);

      const response = await fetch(`${this.baseUrl}?${params}`, {
        method: 'GET',
        signal: options.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao calcular rota: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return this.normalizeGraphHopperResponse(data);
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      console.error('GraphHopper API error:', err);
      throw new Error(`Erro ao calcular rota: ${err.message}`);
    }
  }

  // Map avoid features to GraphHopper format
  mapAvoidFeature(feature) {
    const avoidMap = {
      highways: 'highway',
      tolls: 'toll',
      ferries: 'ferry',
    };
    return avoidMap[feature];
  }

  // Convert GraphHopper response to Mapbox-compatible format
  normalizeGraphHopperResponse(data) {
    if (!data.paths || data.paths.length === 0) {
      throw new Error('Não foram encontradas rotas');
    }

    const routes = data.paths.map((path) => {
      const route = {
        geometry: {
          type: 'LineString',
          coordinates: path.points.coordinates, // Already in [lng, lat] format from GraphHopper
        },
        distance: path.distance,
        duration: path.time / 1000, // Convert from milliseconds to seconds
        weight: path.time / 1000,
        pathDetails: path.details || null,
      };

      // Add elevation data if available
      if (path.ascend !== undefined && path.descend !== undefined) {
        route.ascend = path.ascend;
        route.descend = path.descend;
      }

      return route;
    });

    // Calculate bounding box from all route coordinates
    const bbox = this.calculateBbox(routes);

    return {
      routes,
      waypoints:
        data.paths[0]?.snapped_waypoints?.coordinates?.map((coord) => ({
          coordinates: coord,
        })) || [],
      bbox,
    };
  }
}

class ValhallaDirectionsProvider extends DirectionsProvider {
  constructor() {
    super();
    this.baseUrl = VALHALLA_BASE_URL;
  }

  async getDirections(from, to, options = {}) {
    const fromCoords = this.normalizeCoordinates(from);
    const toCoords = this.normalizeCoordinates(to);

    trackCall({
      api: API_TYPES.VALHALLA,
      details: `${fromCoords[1].toFixed(4)},${fromCoords[0].toFixed(4)} → ${toCoords[1].toFixed(4)},${toCoords[0].toFixed(4)}`,
    });

    try {
      const requestBody = {
        locations: [
          { lat: fromCoords[1], lon: fromCoords[0] },
          { lat: toCoords[1], lon: toCoords[0] },
        ],
        costing: 'bicycle',
        costing_options: {
          bicycle: {
            maneuver_penalty: 20,
            bicycle_type: 'City',
            use_roads: 0.1,
          },
        },
        format: 'osrm',
        shape_format: 'geojson',
        alternates: 5,
      };

      const url = this.baseUrl;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: options.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Valhalla API error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Erro ao calcular rota: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return this.normalizeValhallaResponse(data);
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      console.error('Valhalla API error:', err);
      throw new Error(`Erro ao calcular rota: ${err.message}`);
    }
  }

  // Convert Valhalla response to Mapbox-compatible format
  normalizeValhallaResponse(data) {
    if (!data.routes || data.routes.length === 0) {
      throw new Error('Não foram encontradas rotas');
    }

    const routes = data.routes.map((route) => ({
      geometry: route.geometry,
      distance: route.distance,
      duration: route.duration,
      weight: route.weight,
      legs: route.legs,
    }));

    // Calculate bounding box from route coordinates
    const bbox = this.calculateBbox(routes);

    return {
      routes,
      waypoints: data.waypoints.map((waypoint) => ({
        coordinates: waypoint.location,
      })),
      bbox,
    };
  }
}

class BRouterDirectionsProvider extends DirectionsProvider {
  constructor({ baseUrl = BROUTER_LOCAL_BASE_URL } = {}) {
    super();
    this.baseUrl = baseUrl;
  }

  async getDirections(from, to, options = {}) {
    const fromCoords = this.normalizeCoordinates(from);
    const toCoords = this.normalizeCoordinates(to);
    const lonlats = `${fromCoords[0]},${fromCoords[1]}|${toCoords[0]},${toCoords[1]}`;

    trackCall({
      api: API_TYPES.BROUTER,
      details: `${fromCoords[1].toFixed(4)},${fromCoords[0].toFixed(4)} → ${toCoords[1].toFixed(4)},${toCoords[0].toFixed(4)} (local)`,
    });

    // BRouter clamps alternativeidx to 0..3 (four routes max).
    const idxs = [0, 1, 2, 3];
    const results = await Promise.all(
      idxs.map(async (alternativeidx) => {
        const params = new URLSearchParams({
          lonlats,
          profile: 'ciclomapa',
          alternativeidx: String(alternativeidx),
          format: 'geojson',
        });
        const br = options.brouterProfile || {};
        const elevation = br.consider_elevation !== false;
        const unpaved =
          typeof br.unpavedPenalty === 'number' && Number.isFinite(br.unpavedPenalty)
            ? br.unpavedPenalty
            : 1;
        // BRouter profile booleans are 0/1; "false" makes the .brf parser throw 500.
        params.set('profile:consider_elevation', elevation ? '1' : '0');
        params.set('profile:unpavedPenalty', String(unpaved));
        params.set('profile:consider_noise', br.consider_noise ? '1' : '0');
        params.set('profile:consider_river', br.consider_river ? '1' : '0');
        params.set('profile:consider_forest', br.consider_forest ? '1' : '0');
        const response = await fetch(`${this.baseUrl}/brouter?${params}`, {
          method: 'GET',
          signal: options.signal,
        });
        if (!response.ok) return null;
        try {
          return await response.json();
        } catch {
          return null;
        }
      })
    );

    const routes = [];
    results.forEach((data) => {
      const feature = data?.features?.[0];
      if (!feature?.geometry?.coordinates?.length) return;
      const raw = feature.geometry.coordinates;
      const coords = raw.map((c) => [c[0], c[1]]);
      const props = feature.properties || {};
      const distanceM = Number(props['track-length']);
      const durationS = Number(props['total-time']);
      const filteredAscend = Number(props['filtered ascend']);
      const profile = [];
      const last = raw.length - 1;
      const sampleCount = Math.min(48, raw.length);
      for (let i = 0; i < sampleCount; i++) {
        const idx = sampleCount === 1 ? 0 : Math.round((i / (sampleCount - 1)) * last);
        const z = Number(raw[idx][2]);
        if (Number.isFinite(z)) profile.push(z);
      }
      routes.push({
        geometry: { type: 'LineString', coordinates: coords },
        distance: Number.isFinite(distanceM) ? distanceM : 0,
        duration: Number.isFinite(durationS) ? durationS : 0,
        weight: Number.isFinite(durationS) ? durationS : 0,
        brouterMessages: props.messages || null,
        ascend: Number.isFinite(filteredAscend) ? filteredAscend : null,
        elevationProfile: profile.length >= 2 ? profile : null,
      });
    });

    if (routes.length === 0) {
      throw new Error('Não foram encontradas rotas');
    }

    return {
      routes,
      waypoints: [{ coordinates: fromCoords }, { coordinates: toCoords }],
      bbox: this.calculateBbox(routes),
    };
  }
}

// Main Directions Service
class DirectionsService {
  constructor(provider = 'mapbox') {
    this.providers = {
      mapbox: new MapboxDirectionsProvider(),
      openrouteservice: new OpenRouteServiceProvider(),
      graphhopper: new GraphHopperDirectionsProvider(),
      valhalla: new ValhallaDirectionsProvider(),
    };
    if (USE_BROUTER_LOCAL && BROUTER_LOCAL_BASE_URL) {
      this.providers.brouter = new BRouterDirectionsProvider({
        baseUrl: BROUTER_LOCAL_BASE_URL,
      });
    }

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
    const provider = options.providerName
      ? this.providers[options.providerName]
      : this.currentProvider;
    if (!provider) {
      throw new Error(`Unknown directions provider: ${options.providerName}`);
    }
    return await provider.getDirections(from, to, options);
  }

  // Convenience method for cycling directions (maintains backward compatibility)
  async getCyclingDirections(from, to, options = {}) {
    return await this.getDirections(from, to, {
      profile: 'cycling',
      ...options,
    });
  }
}

// Create default service instance
const directionsService = new DirectionsService('mapbox');

// Export both the service instance and the classes for advanced usage
export default directionsService;
export {
  DirectionsService,
  MapboxDirectionsProvider,
  OpenRouteServiceProvider,
  GraphHopperDirectionsProvider,
  ValhallaDirectionsProvider,
};

// Backward compatibility exports
export const getCyclingDirections = (from, to, options) =>
  directionsService.getCyclingDirections(from, to, options);
