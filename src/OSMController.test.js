import OSMController from './OSMController';
import { OVERPASS_SERVERS, AREA_ID_OVERRIDES } from './config/constants.js';

jest.mock('./antdNotification', () => ({
  appNotification: { error: jest.fn(), success: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));

const jsonResponse = (body, init = {}) => ({
  ok: init.ok !== undefined ? init.ok : true,
  status: init.status || 200,
  statusText: init.statusText || 'OK',
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

// One OSM way with two nodes so osmtogeojson yields a feature.
const overpassWithData = {
  elements: [
    {
      type: 'way',
      id: 1,
      tags: { highway: 'cycleway' },
      nodes: [10, 11],
      geometry: [
        { lat: -30.0, lon: -51.2 },
        { lat: -30.01, lon: -51.21 },
      ],
    },
  ],
};

describe('OSMController.getLayers', () => {
  it('assigns slug ids, defaults and hides debug layers outside debug mode', () => {
    const layers = OSMController.getLayers(false, false);
    expect(layers.length).toBeGreaterThan(0);
    layers.forEach((l) => {
      expect(l.id).toBe(l.id.toLowerCase());
      expect(l.id).not.toMatch(/\s/);
      expect(typeof l.isActive).toBe('boolean');
      expect(['way', 'poi']).toContain(l.type);
      expect(l.onlyDebug).toBeFalsy();
    });
    const ciclovia = layers.find((l) => l.name === 'Ciclovia');
    expect(ciclovia.id).toBe('ciclovia');
    expect(ciclovia.style.lineStyle).toBeDefined();
  });

  it('includes debug layers in debug mode', () => {
    const normal = OSMController.getLayers(false, false);
    const debug = OSMController.getLayers(false, true);
    expect(debug.length).toBeGreaterThan(normal.length);
    expect(debug.some((l) => l.onlyDebug)).toBe(true);
  });

  it('applies dark variants without mutating the shared layer definitions', () => {
    const light = OSMController.getLayers(false, false);
    const dark = OSMController.getLayers(true, false);
    const withDark = dark.find((l) => l.style?.lineColorDark);
    expect(withDark).toBeDefined();
    expect(withDark.style.lineColor).toBe(withDark.style.lineColorDark);
    const lightTwin = light.find((l) => l.name === withDark.name);
    expect(lightTwin.style.lineColor).not.toBe(withDark.style.lineColorDark);
    // Calling again must give the same light colors (no leak from the dark call).
    expect(
      OSMController.getLayers(false, false).find((l) => l.name === withDark.name).style.lineColor
    ).toBe(lightTwin.style.lineColor);
  });

  it('fills border defaults only when a border color is set', () => {
    const layers = OSMController.getLayers(false, false);
    layers
      .filter((l) => l.style)
      .forEach((l) => {
        if (l.style.borderColor) {
          expect(l.style.borderStyle).toBeDefined();
          expect(l.style.borderWidth).toBeGreaterThan(0);
        } else {
          expect(l.style.borderWidth).toBeUndefined();
        }
      });
  });
});

describe('OSMController.getQuery', () => {
  it('builds an area query with boundary relation and every layer filter', () => {
    const q = OSMController.getQuery({ areaId: 3600000001 });
    expect(q).toContain('[out:json][timeout:500]');
    expect(q).toContain('area(3600000001)->.a;');
    expect(q).toContain('rel(area.a)["boundary"="administrative"]');
    expect(q).toContain('way["highway"="cycleway"](area.a);');
    // POI layers are queried as nodes too.
    expect(q).toMatch(/node\["amenity"="bicycle_parking"\]\(area\.a\);/);
    expect(q).toContain('out body geom;');
  });

  it('builds a bbox query without area/boundary parts', () => {
    const q = OSMController.getQuery({ bbox: '-30.1,-51.3,-30.0,-51.1' });
    expect(q).toContain('(-30.1,-51.3,-30.0,-51.1);');
    expect(q).not.toContain('->.a;');
    expect(q).not.toContain('boundary');
  });

  it('drops the extra street layers for blacklisted areas', () => {
    const normal = OSMController.getQuery({ areaId: 3600000001 });
    const berlin = OSMController.getQuery({ areaId: 3600062422 });
    expect(normal).toContain('"maxspeed"="30"');
    expect(berlin).not.toContain('"maxspeed"="30"');
    expect(berlin.length).toBeLessThan(normal.length);
  });

  it('expands compound filters into chained tag selectors', () => {
    const q = OSMController.getQuery({ areaId: 1 });
    expect(q).toContain('way["highway"="track"]["bicycle"="designated"](area.a);');
  });
});

describe('Nominatim name normalizers', () => {
  it('trims a display name to three parts', () => {
    expect(
      OSMController.normalizeAreaNameFromNominatimDisplayName(
        'Porto Alegre, Região Metropolitana, Rio Grande do Sul, Brasil'
      )
    ).toBe('Porto Alegre, Região Metropolitana, Rio Grande do Sul');
    expect(OSMController.normalizeAreaNameFromNominatimDisplayName(' A , B ')).toBe('A, B');
    expect(OSMController.normalizeAreaNameFromNominatimDisplayName('')).toBe('');
    expect(OSMController.normalizeAreaNameFromNominatimDisplayName(null)).toBe('');
  });

  it('prefers structured address fields', () => {
    expect(
      OSMController.normalizeAreaNameFromNominatimResult({
        address: { city: 'Pelotas', state: 'Rio Grande do Sul', country: 'Brasil' },
        display_name: 'ignored',
      })
    ).toBe('Pelotas, Rio Grande do Sul, Brasil');
    expect(
      OSMController.normalizeAreaNameFromNominatimResult({
        address: { town: 'Guaíba', state_district: 'RS' },
      })
    ).toBe('Guaíba, RS');
    expect(
      OSMController.normalizeAreaNameFromNominatimResult({ name: 'Somewhere', address: {} })
    ).toBe('Somewhere');
  });

  it('falls back to display_name and handles junk input', () => {
    expect(OSMController.normalizeAreaNameFromNominatimResult({ display_name: 'X, Y, Z, W' })).toBe(
      'X, Y, Z'
    );
    expect(OSMController.normalizeAreaNameFromNominatimResult(null)).toBe('');
    expect(OSMController.normalizeAreaNameFromNominatimResult('str')).toBe('');
  });
});

describe('OSMController.searchNominatim', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });
  afterEach(() => {
    delete global.fetch;
  });

  it('builds the query string from options and does not send a User-Agent', async () => {
    fetch.mockResolvedValue(jsonResponse([{ osm_id: 1 }]));
    const result = await OSMController.searchNominatim('Porto Alegre', {
      limit: 3,
      addressdetails: 0,
      featureType: 'city',
      acceptLanguage: 'pt-BR',
      countrycodes: ['br', 'es'],
      layer: 'address',
      bounded: true,
      viewbox: [-52, -31, -50, -29],
      extra: 'x',
      skipMe: undefined,
    });
    expect(result).toEqual([{ osm_id: 1 }]);
    const [url, init] = fetch.mock.calls[0];
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://nominatim.openstreetmap.org/search');
    expect(u.searchParams.get('q')).toBe('Porto Alegre');
    expect(u.searchParams.get('limit')).toBe('3');
    expect(u.searchParams.get('addressdetails')).toBe('0');
    expect(u.searchParams.get('featureType')).toBe('city');
    expect(u.searchParams.get('accept-language')).toBe('pt-BR');
    expect(u.searchParams.get('countrycodes')).toBe('br,es');
    expect(u.searchParams.get('layer')).toBe('address');
    expect(u.searchParams.get('bounded')).toBe('1');
    expect(u.searchParams.get('viewbox')).toBe('-52,-31,-50,-29');
    expect(u.searchParams.get('extra')).toBe('x');
    expect(u.searchParams.has('skipMe')).toBe(false);
    expect(init.headers.Accept).toBe('application/json');
    expect(init.headers['User-Agent']).toBeUndefined();
  });

  it('uses defaults and accepts scalar countrycodes/layer/bounded=false', async () => {
    fetch.mockResolvedValue(jsonResponse([]));
    await OSMController.searchNominatim('x', {
      countrycodes: 'br',
      layer: 'a',
      bounded: false,
      viewbox: 'v',
    });
    const u = new URL(fetch.mock.calls[0][0]);
    expect(u.searchParams.get('limit')).toBe('10');
    expect(u.searchParams.get('addressdetails')).toBe('1');
    expect(u.searchParams.get('format')).toBe('json');
    expect(u.searchParams.get('countrycodes')).toBe('br');
    expect(u.searchParams.get('bounded')).toBe('0');
    expect(u.searchParams.get('viewbox')).toBe('v');
  });

  it('throws on non-OK responses', async () => {
    fetch.mockResolvedValue(jsonResponse('busy', { ok: false, status: 503 }));
    await expect(OSMController.searchNominatim('x')).rejects.toThrow(
      'Nominatim search failed (503)'
    );
  });
});

describe('OSMController.getAreaId', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  it('uses overrides without hitting Nominatim', async () => {
    const [name, id] = Object.entries(AREA_ID_OVERRIDES)[0];
    await expect(OSMController.getAreaId(name)).resolves.toBe(id);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('picks the first relation result and converts to an area id', async () => {
    fetch.mockResolvedValue(
      jsonResponse([
        { osm_type: 'node', osm_id: 5 },
        { osm_type: 'relation', osm_id: 242620 },
        { osm_type: 'relation', osm_id: 999 },
      ])
    );
    await expect(OSMController.getAreaId('Porto Alegre')).resolves.toBe(3600000000 + 242620);
  });

  it('falls back to the first result when there is no relation', async () => {
    fetch.mockResolvedValue(jsonResponse([{ osm_type: 'way', osm_id: 7 }]));
    await expect(OSMController.getAreaId('Somewhere')).resolves.toBe(3600000007);
  });

  it('rejects quietly when nothing is found', async () => {
    const { appNotification } = require('./antdNotification');
    fetch.mockResolvedValue(jsonResponse([]));
    await expect(OSMController.getAreaId('Nowhere')).rejects.toThrow('Area not found');
    expect(appNotification.error).not.toHaveBeenCalled();
  });

  it('rejects and shows a notification when Nominatim itself fails', async () => {
    const { appNotification } = require('./antdNotification');
    fetch.mockResolvedValue(jsonResponse('down', { ok: false, status: 500 }));
    await expect(OSMController.getAreaId('Nowhere')).rejects.toThrow(
      'Nominatim search failed (500)'
    );
    expect(appNotification.error).toHaveBeenCalledTimes(1);
  });
});

describe('OSMController.getData', () => {
  const [areaName, areaId] = Object.entries(AREA_ID_OVERRIDES)[0];

  beforeEach(() => {
    global.fetch = jest.fn();
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  it('queries every Overpass server with the area query and resolves GeoJSON from the first with data', async () => {
    fetch.mockImplementation((url) => {
      if (url.startsWith(OVERPASS_SERVERS[1]))
        return Promise.resolve(jsonResponse(overpassWithData));
      return Promise.resolve(jsonResponse({ elements: [] }));
    });

    const { geoJson } = await OSMController.getData({ area: areaName });
    expect(geoJson.type).toBe('FeatureCollection');
    expect(geoJson.features).toHaveLength(1);
    expect(geoJson.features[0].properties.highway).toBe('cycleway');

    expect(fetch).toHaveBeenCalledTimes(OVERPASS_SERVERS.length);
    const calledServers = fetch.mock.calls.map(([u]) => u.split('?')[0]);
    expect(calledServers).toEqual(OVERPASS_SERVERS);
    const query = decodeURI(fetch.mock.calls[0][0].split('?data=')[1]);
    expect(query).toContain(`area(${areaId})->.a;`);
    fetch.mock.calls.forEach(([, init]) => {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.headers['User-Agent']).toBeUndefined();
    });
  });

  it('aborts the other servers once one wins', async () => {
    const signals = [];
    fetch.mockImplementation((url, init) => {
      signals.push(init.signal);
      if (url.startsWith(OVERPASS_SERVERS[0]))
        return Promise.resolve(jsonResponse(overpassWithData));
      return new Promise(() => {}); // never settles
    });
    await OSMController.getData({ area: areaName });
    expect(signals[0].aborted).toBe(false);
    expect(signals[1].aborted).toBe(true);
    expect(signals[2].aborted).toBe(true);
  });

  it('resolves null geoJson when every server is empty', async () => {
    fetch.mockResolvedValue(jsonResponse({ elements: [] }));
    await expect(OSMController.getData({ area: areaName })).resolves.toEqual({ geoJson: null });
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('resolves null geoJson and warns once when every server fails, without console.error', async () => {
    fetch.mockImplementation((url) => {
      if (url.startsWith(OVERPASS_SERVERS[0])) return Promise.reject(new Error('network down'));
      return Promise.resolve(
        jsonResponse('<html>busy</html>', { ok: false, status: 504, statusText: 'Gateway Timeout' })
      );
    });
    await expect(OSMController.getData({ area: areaName })).resolves.toEqual({ geoJson: null });
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.warn.mock.calls[0][0]).toContain(areaName);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('mixes failures and one success into a success', async () => {
    fetch.mockImplementation((url) => {
      if (url.startsWith(OVERPASS_SERVERS[2]))
        return Promise.resolve(jsonResponse(overpassWithData));
      return Promise.reject(new Error('boom'));
    });
    const { geoJson } = await OSMController.getData({ area: areaName });
    expect(geoJson.features).toHaveLength(1);
  });

  it('rejects when the area cannot be resolved', async () => {
    fetch.mockResolvedValue(jsonResponse([]));
    await expect(OSMController.getData({ area: 'Nowhere At All' })).rejects.toThrow(
      'Area not found'
    );
  });

  it('exposes abort() that cancels in-flight server requests', async () => {
    const signals = [];
    fetch.mockImplementation((url, init) => {
      signals.push(init.signal);
      return new Promise(() => {});
    });
    const p = OSMController.getData({ area: areaName });
    // Let getAreaId resolve and the fetches start.
    await new Promise((r) => setTimeout(r, 0));
    expect(signals).toHaveLength(OVERPASS_SERVERS.length);
    p.abort();
    signals.forEach((s) => expect(s.aborted).toBe(true));
  });

  it('rejects with "Request aborted" if aborted before the area resolves', async () => {
    let resolveNominatim;
    fetch.mockImplementation(() => new Promise((r) => (resolveNominatim = r)));
    const p = OSMController.getData({ area: 'Slow City' });
    await new Promise((r) => setTimeout(r, 0));
    p.abort();
    resolveNominatim(jsonResponse([{ osm_type: 'relation', osm_id: 1 }]));
    await expect(p).rejects.toThrow('Request aborted');
  });
});
