/**
 * Load cyclepath GeoJSON for a route corridor from a CicloMapa PMTiles archive.
 * Used to score routes without waiting on (or being limited to) one city's Overpass dump.
 */
import bboxClip from '@turf/bbox-clip';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { PMTiles } from 'pmtiles';

import {
  PMTILES_FILENAME,
  PMTILES_ANALYSIS_FILENAME,
  PMTILES_SOURCE_LAYER,
} from '../../config/constants.js';
import { computeTypologies } from '../../utils/geojsonUtils.js';

type LngLat = [number, number];

type RouteLike = {
  geometry?: {
    type?: string;
    coordinates?: LngLat[];
  };
};

type LayerLike = {
  name?: string;
  filters?: unknown;
  [key: string]: unknown;
};

type TileCoord = { z: number; x: number; y: number };

const MAX_TILES = 150;
/** Extra ring of tiles around the route so nearby cyclepaths still enter the sample. */
const NEIGHBOR_RING = 1;

type ArchiveState = {
  client: PMTiles;
  maxZoom: number;
  decodedTileCache: Map<string, GeoJSON.Feature[]>;
};

const archives = new Map<string, ArchiveState>();

function getArchiveUrl(filename: string): string | null {
  const baseUrl = process.env.REACT_APP_PMTILES_URL;
  if (!baseUrl || !filename) return null;
  return baseUrl + filename;
}

async function getPmtiles(filename: string): Promise<ArchiveState | null> {
  const url = getArchiveUrl(filename);
  if (!url) {
    console.debug('pmtilesCorridor: REACT_APP_PMTILES_URL unset or empty filename');
    return null;
  }

  let state = archives.get(filename);
  if (!state) {
    const client = new PMTiles(url);
    const header = await client.getHeader();
    state = {
      client,
      maxZoom: header.maxZoom,
      decodedTileCache: new Map(),
    };
    archives.set(filename, state);
    console.debug(`pmtilesCorridor: opened ${filename} maxZoom=${header.maxZoom}`);
  }

  return state;
}

/** Web Mercator tile index for a lon/lat at zoom z. */
export function lngLatToTile(lng: number, lat: number, z: number): TileCoord {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return {
    z,
    x: Math.min(n - 1, Math.max(0, x)),
    y: Math.min(n - 1, Math.max(0, y)),
  };
}

/** Geographic bbox of a tile: [west, south, east, north]. */
export function tileBbox(z: number, x: number, y: number): [number, number, number, number] {
  const n = 2 ** z;
  const west = (x / n) * 360 - 180;
  const east = ((x + 1) / n) * 360 - 180;
  const north = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI;
  const south = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + 1)) / n))) * 180) / Math.PI;
  return [west, south, east, north];
}

function tileKey({ z, x, y }: TileCoord): string {
  return `${z}/${x}/${y}`;
}

/**
 * Sample points along each segment so long jumps between vertices still hit every
 * tile the line crosses. Step size is roughly half a tile width in degrees.
 */
function densifyCoordinates(coords: LngLat[], z: number): LngLat[] {
  if (coords.length < 2) return coords.slice();

  const tileDeg = 360 / 2 ** z;
  const step = tileDeg / 2;
  const out: LngLat[] = [coords[0]];

  for (let i = 1; i < coords.length; i++) {
    const [lng0, lat0] = coords[i - 1];
    const [lng1, lat1] = coords[i];
    const dist = Math.hypot(lng1 - lng0, lat1 - lat0);
    const nSteps = Math.max(1, Math.ceil(dist / step));
    for (let s = 1; s <= nSteps; s++) {
      const t = s / nSteps;
      out.push([lng0 + (lng1 - lng0) * t, lat0 + (lat1 - lat0) * t]);
    }
  }

  return out;
}

function addNeighbors(tiles: Map<string, TileCoord>, z: number, x: number, y: number) {
  const n = 2 ** z;
  for (let dx = -NEIGHBOR_RING; dx <= NEIGHBOR_RING; dx++) {
    for (let dy = -NEIGHBOR_RING; dy <= NEIGHBOR_RING; dy++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= n || ny >= n) continue;
      const tile = { z, x: nx, y: ny };
      tiles.set(tileKey(tile), tile);
    }
  }
}

/** Collect tiles covering the routes at zoom z, including a neighbor ring. */
export function collectTilesForRoutes(routes: RouteLike[], z: number): TileCoord[] {
  const tiles = new Map<string, TileCoord>();

  routes.forEach((route) => {
    const coords = route.geometry?.coordinates;
    if (!coords || coords.length === 0) return;

    densifyCoordinates(coords, z).forEach(([lng, lat]) => {
      const { x, y } = lngLatToTile(lng, lat, z);
      addNeighbors(tiles, z, x, y);
    });
  });

  return [...tiles.values()];
}

/**
 * Pick a zoom that keeps the tile set under MAX_TILES. Prefer archive maxZoom;
 * drop one level at a time when the corridor is too long.
 */
export function chooseZoomForRoutes(
  routes: RouteLike[],
  maxZoom: number
): { zoom: number; tiles: TileCoord[] } {
  let zoom = maxZoom;
  let tiles = collectTilesForRoutes(routes, zoom);

  while (tiles.length > MAX_TILES && zoom > 0) {
    zoom -= 1;
    tiles = collectTilesForRoutes(routes, zoom);
  }

  return { zoom, tiles };
}

function asLineStringFeatures(feature: GeoJSON.Feature): GeoJSON.Feature[] {
  const geom = feature.geometry;
  if (!geom) return [];

  if (geom.type === 'LineString') {
    return [feature];
  }

  if (geom.type === 'MultiLineString') {
    return geom.coordinates.map((coordinates) => ({
      type: 'Feature' as const,
      properties: { ...(feature.properties || {}) },
      geometry: { type: 'LineString' as const, coordinates },
    }));
  }

  return [];
}

function decodeTileFeatures(data: ArrayBuffer, tile: TileCoord): GeoJSON.Feature[] {
  const layer = new VectorTile(new PbfReader(new Uint8Array(data))).layers[PMTILES_SOURCE_LAYER];
  if (!layer) return [];

  const bbox = tileBbox(tile.z, tile.x, tile.y);
  const features: GeoJSON.Feature[] = [];

  for (let i = 0; i < layer.length; i++) {
    const vtFeature = layer.feature(i);
    // Points (POIs) are irrelevant for line coverage matching.
    if (vtFeature.type === 1) continue;

    const geojson = vtFeature.toGeoJSON(tile.x, tile.y, tile.z);
    asLineStringFeatures(geojson).forEach((lineFeature) => {
      try {
        const clipped = bboxClip(lineFeature as GeoJSON.Feature<GeoJSON.LineString>, bbox);
        if (clipped?.geometry?.type === 'LineString' && clipped.geometry.coordinates.length >= 2) {
          features.push(clipped as GeoJSON.Feature);
        } else if (clipped?.geometry?.type === 'MultiLineString') {
          asLineStringFeatures(clipped as GeoJSON.Feature).forEach((part) => {
            if (part.geometry && (part.geometry as GeoJSON.LineString).coordinates.length >= 2) {
              features.push(part);
            }
          });
        }
      } catch (err) {
        console.debug('pmtilesCorridor: bbox clip failed', err);
      }
    });
  }

  return features;
}

async function loadTileFeatures(
  state: ArchiveState,
  tile: TileCoord,
  signal?: AbortSignal
): Promise<GeoJSON.Feature[]> {
  const key = tileKey(tile);
  if (state.decodedTileCache.has(key)) {
    return state.decodedTileCache.get(key)!;
  }

  const response = await state.client.getZxy(tile.z, tile.x, tile.y, signal);
  if (!response?.data) {
    state.decodedTileCache.set(key, []);
    return [];
  }

  const features = decodeTileFeatures(response.data, tile);
  state.decodedTileCache.set(key, features);
  return features;
}

export type CorridorArchiveKind = 'display' | 'analysis';

export function filenameForArchiveKind(kind: CorridorArchiveKind): string {
  return kind === 'analysis' ? PMTILES_ANALYSIS_FILENAME : PMTILES_FILENAME;
}

/**
 * Build a FeatureCollection of typed cyclepaths covering the route corridor.
 * Returns null when the archive URL is missing or no features were found.
 */
export async function loadCorridorCyclepaths(
  routes: RouteLike[],
  layers: LayerLike[],
  {
    signal,
    archive = 'display',
    filename,
  }: { signal?: AbortSignal; archive?: CorridorArchiveKind; filename?: string } = {}
): Promise<GeoJSON.FeatureCollection | null> {
  signal?.throwIfAborted?.();

  const archiveFilename = filename || filenameForArchiveKind(archive);
  const state = await getPmtiles(archiveFilename);
  if (!state) return null;

  const lineRoutes = (routes || []).filter(
    (r) => r.geometry?.type === 'LineString' && r.geometry.coordinates?.length
  );
  if (lineRoutes.length === 0) return null;

  const { zoom, tiles } = chooseZoomForRoutes(lineRoutes, state.maxZoom);
  console.debug(
    `pmtilesCorridor[${archiveFilename}]: fetching ${tiles.length} tiles at z${zoom} (archive maxZoom=${state.maxZoom})`
  );

  const featureLists = await Promise.all(
    tiles.map((tile) => loadTileFeatures(state, tile, signal))
  );
  signal?.throwIfAborted?.();
  const features = featureLists.flat();

  if (features.length === 0) {
    console.debug(`pmtilesCorridor[${archiveFilename}]: no cyclepath features in corridor`);
    return null;
  }

  const collection: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features,
  };

  // Same typology stamping the city GeoJSON path uses (tiles still have raw OSM tags).
  computeTypologies(collection, layers);

  console.debug(
    `pmtilesCorridor[${archiveFilename}]: ${features.length} features after decode/clip/typology`
  );
  return collection;
}

/** Test helper: drop the in-memory tile cache (and clients) between runs. */
export function resetPmtilesCorridorCacheForTests() {
  archives.clear();
}
