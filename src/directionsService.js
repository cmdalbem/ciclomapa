import { BROUTER_BASE_URL, BROUTER_ALT_MAX_SHARE_DEFAULT } from './config/constants.js';
import { API_TYPES, trackCall } from './dev/apiTracker.js';

class DirectionsProvider {
  async getDirections() {
    throw new Error('getDirections method must be implemented by subclass');
  }

  normalizeCoordinates(coords) {
    if (!coords || !Array.isArray(coords) || coords.length < 2) {
      throw new Error('Invalid coordinates provided');
    }
    return [coords[0], coords[1]];
  }

  calculateBbox(routes) {
    if (!routes || routes.length === 0) return null;

    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;

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

// BRouter has no share_factor. Cheap stand-in: ~100m cells, drop an alt if
// most of its cells already sit on a kept route.
const BROUTER_ALT_CELL_DECIMALS = 3;

function brouterRouteCells(coords) {
  const cells = new Set();
  for (let i = 0; i < coords.length; i++) {
    const c = coords[i];
    cells.add(
      `${c[0].toFixed(BROUTER_ALT_CELL_DECIMALS)},${c[1].toFixed(BROUTER_ALT_CELL_DECIMALS)}`
    );
  }
  return cells;
}

function brouterCellShare(a, b) {
  if (!a.size || !b.size) return 0;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let n = 0;
  for (const cell of small) {
    if (big.has(cell)) n++;
  }
  return n / small.size;
}

function dropSimilarBrouterRoutes(routes, maxShare = BROUTER_ALT_MAX_SHARE_DEFAULT) {
  const cap = typeof maxShare === 'number' && Number.isFinite(maxShare) ? maxShare : 1;
  if (!(cap < 1)) return routes;
  const kept = [];
  const grids = [];
  for (let i = 0; i < routes.length; i++) {
    const grid = brouterRouteCells(routes[i].geometry.coordinates);
    if (grids.some((g) => brouterCellShare(grid, g) >= cap)) continue;
    kept.push(routes[i]);
    grids.push(grid);
  }
  return kept.length ? kept : routes.slice(0, 1);
}

class BRouterDirectionsProvider extends DirectionsProvider {
  constructor({ baseUrl = BROUTER_BASE_URL } = {}) {
    super();
    this.baseUrl = baseUrl;
  }

  async getDirections(from, to, options = {}) {
    const fromCoords = this.normalizeCoordinates(from);
    const toCoords = this.normalizeCoordinates(to);
    const lonlats = `${fromCoords[0]},${fromCoords[1]}|${toCoords[0]},${toCoords[1]}`;

    trackCall({
      api: API_TYPES.BROUTER,
      details: `${fromCoords[1].toFixed(4)},${fromCoords[0].toFixed(4)} → ${toCoords[1].toFixed(4)},${toCoords[0].toFixed(4)}`,
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
        const objective =
          typeof br.routingObjective === 'number' && Number.isFinite(br.routingObjective)
            ? br.routingObjective
            : 0;
        params.set('profile:routingObjective', String(objective));
        try {
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
        } catch (err) {
          if (err?.name === 'AbortError') throw err;
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
      const z0 = Number(raw[0][2]);
      const z1 = Number(raw[last][2]);
      const netElev = Number.isFinite(z0) && Number.isFinite(z1) ? z1 - z0 : null;
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
        netElev,
        elevationProfile: profile.length >= 2 ? profile : null,
      });
    });

    if (routes.length === 0) {
      throw new Error('Não foram encontradas rotas');
    }

    const distinct = dropSimilarBrouterRoutes(routes);

    return {
      routes: distinct,
      waypoints: [{ coordinates: fromCoords }, { coordinates: toCoords }],
      bbox: this.calculateBbox(distinct),
    };
  }
}

class DirectionsService {
  constructor() {
    this.provider = new BRouterDirectionsProvider();
  }

  async getDirections(from, to, options = {}) {
    return await this.provider.getDirections(from, to, options);
  }

  async getCyclingDirections(from, to, options = {}) {
    return await this.getDirections(from, to, options);
  }
}

const directionsService = new DirectionsService();

export default directionsService;
export { DirectionsService, BRouterDirectionsProvider };

export const getCyclingDirections = (from, to, options) =>
  directionsService.getCyclingDirections(from, to, options);
