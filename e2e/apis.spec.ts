/**
 * HTTP checks for backends the app depends on. Uses Playwright's `request` context only
 * (no browser, no `yarn start`). Run: `yarn e2e e2e/apis.spec.ts`
 *
 * Optional env (same names as CRA): when unset, Mapbox / ORS / GraphHopper / Google tests skip.
 * Keys restricted to browser referrers may fail here; use a server-friendly token or run locally.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const NOMINATIM_UA =
  'CicloMapa-E2E/1.0 (https://ciclomapa.app; contact: contato@ciclomapa.org.br)';

/**
 * Curated mirrors for smoke tests (TLS + reachability). The app uses a longer list in
 * src/config/constants.js including instances that block automation or have cert issues.
 */
const OVERPASS_SERVERS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const OVERPASS_SMOKE_QUERY = '[out:json][timeout:45];node(1);out;';
const OVERPASS_TRY_MS = 35_000;

const VALHALLA_ROUTE = 'https://valhalla1.openstreetmap.de/route';

const mapboxToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
const orsKey = process.env.REACT_APP_OPENROUTESERVICE_API_KEY;
const graphHopperKey = process.env.REACT_APP_GRAPHHOPPER_API_KEY;
const googlePlacesKey = process.env.REACT_APP_GOOGLE_PLACES_API_KEY;

async function fetchOverpassJson(request: APIRequestContext) {
  const dataParam = encodeURIComponent(OVERPASS_SMOKE_QUERY);
  const errors: string[] = [];
  for (const base of OVERPASS_SERVERS) {
    try {
      const res = await request.get(`${base}?data=${dataParam}`, {
        timeout: OVERPASS_TRY_MS,
      });
      const text = await res.text();
      if (!res.ok()) {
        errors.push(`${base}: HTTP ${res.status()}`);
        continue;
      }
      try {
        const body = JSON.parse(text) as { elements?: unknown[] };
        if (Array.isArray(body.elements) && body.elements.length > 0) {
          return body;
        }
        errors.push(`${base}: no elements`);
      } catch {
        errors.push(`${base}: non-JSON or parse error`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${base}: ${msg}`);
    }
  }
  throw new Error(`All Overpass mirrors failed:\n${errors.join('\n')}`);
}

test.describe('Public APIs (OSM / shared routing)', () => {
  test.describe.configure({ timeout: 180_000 });

  test('Overpass interpreter returns JSON elements (any mirror)', async ({ request }) => {
    let lastErr: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const body = await fetchOverpassJson(request);
        expect(body.elements).toBeDefined();
        expect(body.elements!.length).toBeGreaterThan(0);
        return;
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
    throw lastErr;
  });

  test('Nominatim search returns coordinates', async ({ request }) => {
    const res = await request.get(
      'https://nominatim.openstreetmap.org/search?q=Porto+Alegre+Brazil&format=json&limit=1',
      { headers: { 'User-Agent': NOMINATIM_UA } }
    );
    expect(res.ok(), await res.text()).toBeTruthy();
    const data = await res.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0]).toMatchObject({
      lat: expect.any(String),
      lon: expect.any(String),
    });
  });

  test('Valhalla (openstreetmap.de) returns bicycle routes', async ({ request }) => {
    const body = {
      locations: [
        { lat: -30.0346, lon: -51.2177 },
        { lat: -30.05, lon: -51.23 },
      ],
      costing: 'bicycle',
      format: 'osrm',
      shape_format: 'geojson',
      alternates: 2,
    };
    const res = await request.post(VALHALLA_ROUTE, {
      headers: { 'Content-Type': 'application/json' },
      data: body,
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const data = await res.json();
    expect(data.routes).toBeDefined();
    expect(Array.isArray(data.routes)).toBe(true);
    expect(data.routes.length).toBeGreaterThan(0);
  });
});

test.describe('Mapbox (requires REACT_APP_MAPBOX_ACCESS_TOKEN)', () => {
  test.beforeEach(() => {
    test.skip(!mapboxToken, 'Set REACT_APP_MAPBOX_ACCESS_TOKEN to run Mapbox API checks');
  });

  test('Geocoding API returns features', async ({ request }) => {
    const url = new URL('https://api.mapbox.com/geocoding/v5/mapbox.places/Porto+Alegre.json');
    url.searchParams.set('access_token', mapboxToken!);
    url.searchParams.set('limit', '1');
    const res = await request.get(url.toString());
    expect(res.ok(), await res.text()).toBeTruthy();
    const data = await res.json();
    expect(data.type).toBe('FeatureCollection');
    expect(Array.isArray(data.features)).toBe(true);
    expect(data.features.length).toBeGreaterThan(0);
  });

  test('Directions API returns routes for cycling', async ({ request }) => {
    const path =
      'https://api.mapbox.com/directions/v5/mapbox/cycling/-51.2177,-30.0346;-51.23,-30.05';
    const url = new URL(path);
    url.searchParams.set('access_token', mapboxToken!);
    url.searchParams.set('geometries', 'geojson');
    const res = await request.get(url.toString());
    expect(res.ok(), await res.text()).toBeTruthy();
    const data = await res.json();
    expect(data.routes).toBeDefined();
    expect(Array.isArray(data.routes)).toBe(true);
    expect(data.routes.length).toBeGreaterThan(0);
  });
});

test.describe('OpenRouteService (requires REACT_APP_OPENROUTESERVICE_API_KEY)', () => {
  test.beforeEach(() => {
    test.skip(!orsKey, 'Set REACT_APP_OPENROUTESERVICE_API_KEY to run ORS checks');
  });

  test('Directions cycling-regular returns GeoJSON routes', async ({ request }) => {
    const url = `https://api.openrouteservice.org/v2/directions/cycling-regular/geojson?api_key=${orsKey}`;
    const body = {
      coordinates: [
        [-51.2177, -30.0346],
        [-51.23, -30.05],
      ],
      format: 'geojson',
    };
    const res = await request.post(url, {
      headers: { 'Content-Type': 'application/json' },
      data: body,
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const data = await res.json();
    expect(data.features).toBeDefined();
    expect(Array.isArray(data.features)).toBe(true);
    expect(data.features.length).toBeGreaterThan(0);
  });
});

test.describe('GraphHopper (requires REACT_APP_GRAPHHOPPER_API_KEY)', () => {
  test.beforeEach(() => {
    test.skip(!graphHopperKey, 'Set REACT_APP_GRAPHHOPPER_API_KEY to run GraphHopper checks');
  });

  test('Route API returns paths', async ({ request }) => {
    const params = new URLSearchParams({
      key: graphHopperKey!,
      profile: 'bike',
      type: 'json',
      instructions: 'false',
      points_encoded: 'false',
      calc_points: 'true',
    });
    params.append('point', '-30.0346,-51.2177');
    params.append('point', '-30.05,-51.23');
    const res = await request.get(`https://graphhopper.com/api/1/route?${params}`);
    expect(res.ok(), await res.text()).toBeTruthy();
    const data = await res.json();
    expect(data.paths).toBeDefined();
    expect(Array.isArray(data.paths)).toBe(true);
    expect(data.paths.length).toBeGreaterThan(0);
  });
});

test.describe('Google Maps JS bootstrap (requires REACT_APP_GOOGLE_PLACES_API_KEY)', () => {
  test.beforeEach(() => {
    test.skip(
      !googlePlacesKey,
      'Set REACT_APP_GOOGLE_PLACES_API_KEY to run Google bootstrap check'
    );
  });

  test('Maps JavaScript API script loads (Places library)', async ({ request }) => {
    const url = new URL('https://maps.googleapis.com/maps/api/js');
    url.searchParams.set('key', googlePlacesKey!);
    url.searchParams.set('libraries', 'places');
    const res = await request.get(url.toString());
    expect(res.ok(), await res.text()).toBeTruthy();
    const text = await res.text();
    expect(text).toContain('google.maps');
  });
});
