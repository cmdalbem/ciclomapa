export type LngLat = [lng: number, lat: number];

export interface DirectionsGeometry {
  type: 'LineString';
  coordinates: LngLat[];
}

export interface DirectionsRoute {
  geometry?: DirectionsGeometry;
  distance?: number;
  duration?: number;
  weight?: number;

  // Enriched by CicloMapa scoring/coverage logic
  provider?: string;
  score?: number | null;
  scoreClass?: string;
  coverage?: number;
  coverageBreakdown?: unknown;
  coverageBreakdownSimple?: unknown;

  legs?: unknown[];

  // Allow providers/enrichers to attach extra metadata without blocking progress.
  [key: string]: unknown;
}

export interface DirectionsData {
  routes: DirectionsRoute[];
  waypoints?: unknown;
  bbox?: [minLng: number, minLat: number, maxLng: number, maxLat: number] | null;

  [key: string]: unknown;
}
