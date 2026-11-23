import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import App from './App.js';
import OSMController from './OSMController.js';
import { AREA_ID_OVERRIDES, PMTILES_FALLBACK_MISSING_LAYER_NAMES } from './config/constants.js';
import { mapperLayerNeedsCityGeoJson } from './config/layersCatalog.js';
import { guessPlaceFromViewport, reverseGeocodePlace } from './features/map/mapboxGeocoding.js';
import { appNotification } from './antdNotification';
import Analytics from './Analytics.js';

jest.mock('./AppLayout.js', () => (props) => <div data-testid="layout">{props.seoPageTitle}</div>);
jest.mock('./PwaUpdateBanner.jsx', () => () => null);
jest.mock('./Analytics.js', () => ({ event: jest.fn() }));
jest.mock('./Storage.js', () => {
  class Storage {
    load() {
      return Promise.resolve(null);
    }
    save() {
      return Promise.resolve();
    }
    getStoredUpdatedAt() {
      return Promise.resolve(null);
    }
  }
  return { __esModule: true, default: Storage };
});
jest.mock('./AirtableDatabase.js', () => {
  class AirtableDatabase {
    getMetadata() {
      return Promise.resolve([]);
    }
    matchCityMetadataFields() {
      return null;
    }
  }
  return { __esModule: true, default: AirtableDatabase };
});
jest.mock('./features/map/mapboxGeocoding.js', () => ({
  guessPlaceFromViewport: jest.fn(),
  reverseGeocodePlace: jest.fn(),
}));
jest.mock('./features/geolocation/userLocationCache.js', () => ({
  __esModule: true,
  default: { warmUpIfAlreadyGranted: jest.fn() },
}));
jest.mock(
  './components/AntdAppShell.jsx',
  () =>
    ({ children }) =>
      children
);
jest.mock('./antdNotification', () => ({
  appNotification: {
    info: jest.fn(),
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    destroy: jest.fn(),
  },
  bindAntdNotification: jest.fn(),
}));
jest.mock('./utils/documentMeta.js', () => ({ updateDocumentMeta: jest.fn() }));
jest.mock('./utils/utils.js', () => {
  const actual = jest.requireActual('./utils/utils.js');
  return { ...actual, downloadObjectAsJson: jest.fn() };
});

const mockGetMetadata = jest.fn();
jest.mock('pmtiles', () => ({
  PMTiles: jest.fn().mockImplementation(() => ({ getMetadata: mockGetMetadata })),
}));

const CUIABA_AREA = 'Cuiabá, Mato Grosso, Brasil';
const SALVADOR_AREA = 'Salvador, Bahia, Brasil';
const RIO_AREA = 'Rio de Janeiro, Rio de Janeiro, Brasil';

function mountApp(entry = '/sao-paulo') {
  const ref = React.createRef();
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/:city" element={<App ref={ref} />} />
        <Route path="/" element={<App ref={ref} />} />
      </Routes>
    </MemoryRouter>
  );
  return ref;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ciclomapa_welcomeSeen:v3', '1');
  process.env.REACT_APP_PMTILES_URL = 'https://tiles.example/';
  mockGetMetadata.mockReset();
  guessPlaceFromViewport.mockReset();
  reverseGeocodePlace.mockReset();
  appNotification.info.mockClear();
  Analytics.event.mockClear();
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('App city / slug helpers', () => {
  it('slugifies labels and only treats catalog cities as canonical', () => {
    const app = mountApp().current;
    expect(app.slugifyCityLabel('São Paulo')).toBe('sao-paulo');
    expect(app.slugifyCityLabel('')).toBeNull();

    expect(app.getCitySlugFromArea('São Paulo, São Paulo, Brasil')).toBe('sao-paulo');
    expect(app.getCitySlugFromArea('Pelotas, Rio Grande do Sul, Brasil')).toBe('pelotas');
    expect(app.getCitySlugFromArea(null)).toBeNull();

    expect(app.getCatalogCanonicalSlugFromArea('São Paulo, São Paulo, Brasil')).toBe('sao-paulo');
    expect(app.getCatalogCanonicalSlugFromArea('Pelotas, RS')).toBeNull();

    expect(app.getCanonicalCityIdentity('São Paulo')).toEqual({
      canonicalSlug: 'sao-paulo',
      canonicalAreaLabel: 'São Paulo, São Paulo, Brasil',
    });
    expect(app.getCanonicalCityIdentity('Pelotas')).toBeNull();

    expect(app.getStorageKeyForArea('São Paulo')).toBe('São Paulo, São Paulo, Brasil');
    expect(app.getStorageKeyForArea('Pelotas, RS')).toBe('Pelotas, RS');
    expect(app.normalizeAreaLabelForDisplay('São Paulo')).toBe('São Paulo, São Paulo, Brasil');
    expect(app.normalizeAreaLabelForDisplay('Pelotas, RS')).toBe('Pelotas, RS');
    expect(app.normalizeAreaLabelForDisplay(null)).toBeNull();
  });

  it('reads the route slug and canonicalizes aliases', () => {
    const app = mountApp('/sao-paulo').current;
    expect(app.getCitySlugFromRoute()).toBe('sao-paulo');
    expect(app.getCanonicalRouteCitySlug()).toBe('sao-paulo');
    expect(app.getSrOnlyDocumentTitle()).toBe('São Paulo — CicloMapa');
    expect(app.getPreferredCanonicalSlugForMeta('Pelotas')).toBe('sao-paulo');
  });

  it('ignores a URL camera that belongs to another city than the slug', () => {
    const app = mountApp('/salvador?lat=-25.4469028&lng=-49.2580746&z=12.27').current;
    expect(app.state.area).toBe(SALVADOR_AREA);
    expect(app.urlViewportFitsRouteCity()).toBe(false);
    expect(app.state.lat).toBeCloseTo(-12.9822499);
    expect(app.state.lng).toBeCloseTo(-38.4812772);
  });

  it('keeps a URL camera that is still in the slug city', () => {
    const app = mountApp('/salvador?lat=-13.0100000&lng=-38.5100000&z=14').current;
    expect(app.hasExplicitViewportInURL()).toBe(true);
    expect(app.state.lat).toBeCloseTo(-13.01);
    expect(app.state.lng).toBeCloseTo(-38.51);
  });

  it('picker city change resolves the new city instead of keeping the old camera', () => {
    const app = mountApp('/curitiba?lat=-25.4295963&lng=-49.2712724&z=12').current;
    const spy = jest.spyOn(app, 'resolveCitySlugToAreaAndViewport').mockImplementation(() => {});
    act(() => app.setArea(SALVADOR_AREA, { source: 'picker' }));
    expect(spy).toHaveBeenCalledWith('salvador');
  });
});

describe('App GeoJSON gate and area sync', () => {
  it('needsCityGeoJsonContext is true for desktop analytics or an open route panel', () => {
    const app = mountApp().current;
    app._isDirectionsPanelOpen = false;
    act(() => app.setState({ isSidebarOpen: false }));
    expect(app.needsCityGeoJsonContext()).toBe(false);
    act(() => app.setState({ isSidebarOpen: true }));
    expect(app.needsCityGeoJsonContext()).toBe(true);
    act(() => app.setState({ isSidebarOpen: false }));
    app._isDirectionsPanelOpen = true;
    expect(app.needsCityGeoJsonContext()).toBe(true);
  });

  it('loads city GeoJSON for the Cuiabá overlay without opening analytics', () => {
    const app = mountApp().current;
    act(() =>
      app.setState({
        isSidebarOpen: false,
        mapperMode: true,
        area: 'Cuiabá, Mato Grosso, Brasil',
        layers: app.initLayers({}, false, false, undefined, true, false, CUIABA_AREA),
      })
    );
    expect(app.needsCityGeoJsonContext()).toBe(false);
    expect(app.shouldLoadCityGeoJson()).toBe(true);

    act(() =>
      app.setState({
        layers: app.state.layers.map((l) =>
          l.mapperGroup === 'cuiaba-hall' ? { ...l, isActive: false } : l
        ),
      })
    );
    expect(app.shouldLoadCityGeoJson()).toBe(false);
  });

  it('loads city GeoJSON for the Salvador overlay without opening analytics', () => {
    const app = mountApp().current;
    act(() =>
      app.setState({
        isSidebarOpen: false,
        mapperMode: true,
        area: SALVADOR_AREA,
        layers: app.initLayers({}, false, false, undefined, true, false, SALVADOR_AREA),
      })
    );
    expect(app.needsCityGeoJsonContext()).toBe(false);
    expect(app.shouldLoadCityGeoJson()).toBe(true);
    expect(app.state.layers.find((l) => l.name === 'Lista Transalvador').isAvailable).toBe(true);
    expect(app.state.layers.find((l) => l.name === 'Prefeitura 2024').isAvailable).toBe(true);
  });

  it('loads city GeoJSON for Rio GIS diffs without opening analytics', () => {
    const app = mountApp().current;
    act(() =>
      app.setState({
        isSidebarOpen: false,
        mapperMode: true,
        area: RIO_AREA,
        layers: app.initLayers({}, false, false, undefined, true, false, RIO_AREA),
      })
    );
    expect(app.shouldLoadCityGeoJson()).toBe(true);
    expect(app.state.layers.find((l) => l.name === 'Só OSM (Rio)').isAvailable).toBe(true);
    expect(app.state.layers.find((l) => l.name === 'Só OSM (Rio)').isActive).toBe(true);
    expect(app.state.layers.find((l) => l.name === 'CET-Rio ciclovia').isActive).toBe(false);
    const curitibaDiff = app.state.layers.find((l) => l.name === 'Só OSM (Curitiba)');
    expect(curitibaDiff.isAvailable).toBe(true);
    expect(curitibaDiff.isActive).toBe(true);
    expect(
      mapperLayerNeedsCityGeoJson(app.state.layers.find((l) => l.name === 'CET-Rio ciclovia'))
    ).toBe(false);
    expect(
      mapperLayerNeedsCityGeoJson(app.state.layers.find((l) => l.name === 'Só OSM (Rio)'))
    ).toBe(false);
  });

  it('setArea normalizes catalog labels and tags the analytics source', () => {
    const app = mountApp('/porto-alegre').current;
    Analytics.event.mockClear();
    act(() => app.setArea('São Paulo', { source: 'viewport', keepRoutePoints: true }));
    expect(app.state.area).toBe('São Paulo, São Paulo, Brasil');
    expect(Analytics.event).toHaveBeenCalledWith('switch_city', {
      city_name: 'São Paulo, São Paulo, Brasil',
      source: 'viewport',
    });
    expect(app._pendingAreaChangeSource).toBeNull();
    act(() => app.setArea('São Paulo, São Paulo, Brasil'));
    expect(Analytics.event).toHaveBeenCalledTimes(1);
  });

  it('ensureCityDataLoaded skips if already loaded/in-flight and otherwise calls updateData', () => {
    const app = mountApp().current;
    const spy = jest.spyOn(app, 'updateData').mockImplementation(() => {});
    app._geoJsonLoadedArea = app.state.area;
    app.ensureCityDataLoaded();
    expect(spy).not.toHaveBeenCalled();
    app._geoJsonLoadedArea = null;
    app._geoJsonLoadingArea = app.state.area;
    app.ensureCityDataLoaded();
    expect(spy).not.toHaveBeenCalled();
    app._geoJsonLoadingArea = null;
    app.ensureCityDataLoaded();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(app._geoJsonLoadingArea).toBe(app.state.area);
  });

  it('syncAreaWithViewportThenLoadCityData switches area when the viewport city differs', async () => {
    const app = mountApp().current;
    app._isDirectionsPanelOpen = true;
    jest.spyOn(app, 'getCurrentViewport').mockReturnValue({ lat: -30, lng: -51, zoom: 12 });
    guessPlaceFromViewport.mockResolvedValue({
      place_name: 'Porto Alegre, Rio Grande do Sul, Brasil',
    });
    await act(async () => {
      await app.syncAreaWithViewportThenLoadCityData();
    });
    expect(app.state.area).toBe('Porto Alegre, Rio Grande do Sul, Brasil');
    expect(Analytics.event).toHaveBeenCalledWith('switch_city', {
      city_name: 'Porto Alegre, Rio Grande do Sul, Brasil',
      source: 'viewport',
    });
  });

  it('keeps the current area and loads GeoJSON when geocoding fails', async () => {
    const app = mountApp().current;
    app._isDirectionsPanelOpen = true;
    const area = app.state.area;
    const spy = jest.spyOn(app, 'updateData').mockImplementation(() => {});
    guessPlaceFromViewport.mockRejectedValue(new Error('down'));
    await act(async () => {
      await app.syncAreaWithViewportThenLoadCityData();
    });
    expect(app.state.area).toBe(area);
    expect(spy).toHaveBeenCalled();
  });

  it('drops a stale viewport sync after the panel closes', async () => {
    const app = mountApp().current;
    app._isDirectionsPanelOpen = true;
    let resolve;
    guessPlaceFromViewport.mockImplementation(() => new Promise((r) => (resolve = r)));
    const p = app.syncAreaWithViewportThenLoadCityData();
    app._isDirectionsPanelOpen = false;
    resolve({ place_name: 'Porto Alegre, Rio Grande do Sul, Brasil' });
    await p;
    expect(app.state.area).not.toBe('Porto Alegre, Rio Grande do Sul, Brasil');
  });

  it('drops a stale viewport sync if the area changed while geocoding', async () => {
    const app = mountApp().current;
    app._isDirectionsPanelOpen = true;
    let resolve;
    guessPlaceFromViewport.mockImplementation(() => new Promise((r) => (resolve = r)));
    const p = app.syncAreaWithViewportThenLoadCityData();
    act(() => {
      app.setArea('Curitiba, Paraná, Brasil', { source: 'picker' });
    });
    resolve({ place_name: 'Porto Alegre, Rio Grande do Sul, Brasil' });
    await p;
    expect(app.state.area).toBe('Curitiba, Paraná, Brasil');
  });
});

describe('App updateData Overpass backfill', () => {
  const wayFeature = {
    type: 'Feature',
    id: 'way/1',
    properties: { highway: 'cycleway' },
    geometry: {
      type: 'LineString',
      coordinates: [
        [-47, -15],
        [-47.1, -15.1],
      ],
    },
  };
  const wayOnlyGeoJson = {
    type: 'FeatureCollection',
    features: [wayFeature],
  };
  const withBoundaryGeoJson = {
    type: 'FeatureCollection',
    features: [
      wayFeature,
      {
        type: 'Feature',
        id: 'relation/1',
        properties: { boundary: 'administrative', admin_level: '8' },
        geometry: { type: 'Polygon', coordinates: [] },
      },
    ],
  };

  function mockCache(app, geoJson, updatedAt) {
    jest.spyOn(app.getStorage(), 'load').mockResolvedValue({
      geoJson: JSON.parse(JSON.stringify(geoJson)),
      lengths: { ciclovia: 10 },
      updatedAt,
    });
  }

  it('fetches only the admin boundary when cached GeoJSON is fresh but has none', async () => {
    const app = mountApp().current;
    mockCache(app, wayOnlyGeoJson, new Date());
    const osm = jest.spyOn(app, 'getDataFromOSM').mockImplementation(() => {});
    await act(async () => {
      app.updateData();
    });
    await waitFor(() => {
      expect(osm).toHaveBeenCalledWith(
        expect.objectContaining({
          backgroundUpdate: true,
          boundaryOnly: true,
        })
      );
    });
    expect(osm).toHaveBeenCalledTimes(1);
  });

  it('does not hit Overpass when cached GeoJSON is fresh and already has a boundary', async () => {
    const app = mountApp().current;
    mockCache(app, withBoundaryGeoJson, new Date());
    const osm = jest.spyOn(app, 'getDataFromOSM').mockImplementation(() => {});
    await act(async () => {
      app.updateData();
    });
    await waitFor(() => {
      expect(app.state.geoJson?.features?.length).toBe(2);
    });
    expect(osm).not.toHaveBeenCalled();
  });

  it('backfills the city outline when the cache still has a pile of inner admin polygons', async () => {
    const app = mountApp().current;
    const closed = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const manyAdmins = {
      type: 'FeatureCollection',
      features: [1, 2, 3].map((n) => ({
        type: 'Feature',
        id: `relation/${n}`,
        properties: { boundary: 'administrative', admin_level: '9' },
        geometry: { type: 'Polygon', coordinates: [closed] },
      })),
    };
    mockCache(app, manyAdmins, new Date());
    const osm = jest.spyOn(app, 'getDataFromOSM').mockImplementation(() => {});
    await act(async () => {
      app.updateData();
    });
    await waitFor(() => {
      expect(osm).toHaveBeenCalledWith(expect.objectContaining({ boundaryOnly: true }));
    });
  });

  it('does a full Overpass refetch when cached GeoJSON is stale', async () => {
    const app = mountApp().current;
    const stale = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    mockCache(app, wayOnlyGeoJson, stale);
    const osm = jest.spyOn(app, 'getDataFromOSM').mockImplementation(() => {});
    await act(async () => {
      app.updateData();
    });
    await waitFor(() => {
      expect(osm).toHaveBeenCalledTimes(1);
    });
    expect(osm.mock.calls[0][0].boundaryOnly).toBeFalsy();
    expect(osm.mock.calls[0][0].backgroundUpdate).toBe(true);
  });

  it('merges admin boundary features into cached GeoJSON without replacing ways', async () => {
    const app = mountApp().current;
    const area = app.state.area;
    const boundary = {
      type: 'Feature',
      id: 'relation/1',
      properties: { boundary: 'administrative', admin_level: '8' },
      geometry: { type: 'Polygon', coordinates: [] },
    };
    act(() => {
      app.setState({
        geoJson: JSON.parse(JSON.stringify(wayOnlyGeoJson)),
        lengths: { ciclovia: 10 },
        loading: false,
      });
    });
    jest.spyOn(OSMController, 'getData').mockResolvedValue({
      geoJson: { type: 'FeatureCollection', features: [boundary] },
    });
    const save = jest.spyOn(app.getStorage(), 'save').mockResolvedValue();
    jest.spyOn(app.getStorage(), 'getStoredUpdatedAt').mockResolvedValue(null);

    await act(async () => {
      await app.getDataFromOSM({
        areaName: area,
        backgroundUpdate: true,
        boundaryOnly: true,
      });
    });

    expect(app.state.geoJson.features.map((f) => f.id)).toEqual(['way/1', 'relation/1']);
    expect(app.state.lengths).toEqual({ ciclovia: 10 });
    expect(app.state.loading).toBe(false);
    await waitFor(() => {
      expect(save).toHaveBeenCalledWith(area, app.state.geoJson, {}, expect.any(Object));
    });
  });

  it('skips the boundary save when the stored roads changed since this client loaded them', async () => {
    const app = mountApp().current;
    const area = app.state.area;
    const loadedAt = new Date('2026-11-01T10:00:00Z');
    const storedAt = new Date('2026-11-22T09:00:00Z');
    const boundary = {
      type: 'Feature',
      id: 'relation/1',
      properties: { boundary: 'administrative', admin_level: '8' },
      geometry: { type: 'Polygon', coordinates: [] },
    };
    act(() => {
      app.setState({
        geoJson: JSON.parse(JSON.stringify(wayOnlyGeoJson)),
        dataUpdatedAt: loadedAt,
        lengths: { ciclovia: 10 },
        loading: false,
      });
    });
    jest.spyOn(OSMController, 'getData').mockResolvedValue({
      geoJson: { type: 'FeatureCollection', features: [boundary] },
    });
    const save = jest.spyOn(app.getStorage(), 'save').mockResolvedValue();
    jest.spyOn(app.getStorage(), 'getStoredUpdatedAt').mockResolvedValue(storedAt);

    await act(async () => {
      await app.getDataFromOSM({
        areaName: area,
        backgroundUpdate: true,
        boundaryOnly: true,
      });
    });

    expect(app.state.geoJson.features.map((f) => f.id)).toEqual(['way/1', 'relation/1']);
    await waitFor(() => {
      expect(app.getStorage().getStoredUpdatedAt).toHaveBeenCalled();
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps the cached outline when a boundary-only Overpass repair returns nothing', async () => {
    const app = mountApp().current;
    const area = app.state.area;
    act(() => {
      app.setState({
        geoJson: JSON.parse(JSON.stringify(withBoundaryGeoJson)),
        lengths: { ciclovia: 10 },
        loading: true,
      });
    });
    jest.spyOn(OSMController, 'getData').mockResolvedValue({ geoJson: null });
    const save = jest.spyOn(app.getStorage(), 'save').mockResolvedValue();

    await act(async () => {
      await app.getDataFromOSM({
        areaName: area,
        backgroundUpdate: true,
        boundaryOnly: true,
      });
    });

    expect(app.state.geoJson.features.map((f) => f.id)).toEqual(['way/1', 'relation/1']);
    expect(app.state.loading).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('does a full Overpass refetch when the cache was built with a different query area', async () => {
    const app = mountApp().current;
    const area = Object.keys(AREA_ID_OVERRIDES)[0];
    act(() => {
      app.setState({ area });
    });
    mockCache(app, withBoundaryGeoJson, new Date());
    const osm = jest.spyOn(app, 'getDataFromOSM').mockImplementation(() => {});
    await act(async () => {
      app.updateData();
    });
    await waitFor(() => {
      expect(osm).toHaveBeenCalledTimes(1);
    });
    expect(osm.mock.calls[0][0].boundaryOnly).toBeFalsy();
    expect(osm.mock.calls[0][0].backgroundUpdate).toBe(true);
    expect(app._invalidateLengthsOnSave).toBe(area);
  });

  it('does not keep old-area km when saving after a query-area change', async () => {
    const app = mountApp().current;
    const area = Object.keys(AREA_ID_OVERRIDES)[0];
    act(() => {
      app.setState({
        area,
        geoJson: JSON.parse(JSON.stringify(wayOnlyGeoJson)),
        lengths: { ciclovia: 999 },
        loading: true,
      });
    });
    app._invalidateLengthsOnSave = area;
    jest.spyOn(OSMController, 'getData').mockResolvedValue({
      geoJson: JSON.parse(JSON.stringify(wayOnlyGeoJson)),
    });
    const save = jest.spyOn(app.getStorage(), 'save').mockResolvedValue();

    await act(async () => {
      await app.getDataFromOSM({ areaName: area, backgroundUpdate: true });
    });

    expect(app.state.lengths).not.toEqual({ ciclovia: 999 });
    expect(save).toHaveBeenCalledWith(
      area,
      expect.any(Object),
      expect.any(Object),
      expect.objectContaining({
        invalidateLengths: true,
        queryAreaId: AREA_ID_OVERRIDES[area],
      })
    );
  });

  it('still backfills only the outline when the cached query area already matches', async () => {
    const app = mountApp().current;
    const area = Object.keys(AREA_ID_OVERRIDES)[0];
    act(() => {
      app.setState({ area });
    });
    jest.spyOn(app.getStorage(), 'load').mockResolvedValue({
      geoJson: JSON.parse(JSON.stringify(wayOnlyGeoJson)),
      lengths: { ciclovia: 10 },
      updatedAt: new Date(),
      queryAreaId: AREA_ID_OVERRIDES[area],
    });
    const osm = jest.spyOn(app, 'getDataFromOSM').mockImplementation(() => {});
    await act(async () => {
      app.updateData();
    });
    await waitFor(() => {
      expect(osm).toHaveBeenCalledWith(expect.objectContaining({ boundaryOnly: true }));
    });
    expect(osm).toHaveBeenCalledTimes(1);
  });

  it('persists GeoJSON and lengths on Atualizar for the selected pairing engine', async () => {
    const app = mountApp().current;
    const area = app.state.area;
    expect(app.state.parallelDedupeEngine).toBe('geometry_first');
    act(() => {
      app.setState({
        geoJson: JSON.parse(JSON.stringify(wayOnlyGeoJson)),
        lengths: { ciclovia: 10 },
        loading: false,
      });
    });
    const nextGeoJson = JSON.parse(JSON.stringify(wayOnlyGeoJson));
    jest.spyOn(OSMController, 'getData').mockResolvedValue({
      geoJson: nextGeoJson,
    });
    const save = jest.spyOn(app.getStorage(), 'save').mockResolvedValue();

    await act(async () => {
      await app.getDataFromOSM({
        areaName: area,
        forceUpdate: true,
      });
    });

    expect(save).toHaveBeenCalledWith(
      area,
      nextGeoJson,
      expect.any(Object),
      expect.objectContaining({ storageKey: expect.any(String) })
    );
  });
});

describe('App layers and PMTiles metadata', () => {
  it('initLayers marks fallback-missing layers unavailable until metadata is known', () => {
    const app = mountApp().current;
    const layers = app.initLayers({ ciclovia: false }, false, false);
    const ciclovia = layers.find((l) => l.name === 'Ciclovia');
    expect(ciclovia.isActive).toBe(false); // saved state
    expect(ciclovia.isAvailable).toBe(true);
    const baixa = layers.find((l) => PMTILES_FALLBACK_MISSING_LAYER_NAMES.has(l.name));
    expect(baixa.isAvailable).toBe(false);
    expect(baixa.isActive).toBe(false);
    const comments = layers.find((l) => !l.filters);
    if (comments) expect(comments.isAvailable).toBeUndefined();
  });

  it('initLayers uses the archive layer set once metadata is known', () => {
    const app = mountApp().current;
    app.pmtilesAvailableLayerNames = new Set(['Ciclovia']);
    const layers = app.initLayers({}, false, false);
    expect(layers.find((l) => l.name === 'Ciclovia').isAvailable).toBe(true);
    expect(layers.find((l) => l.name === 'Ciclofaixa').isAvailable).toBe(false);
    expect(layers.find((l) => l.name === 'Ciclofaixa').isActive).toBe(false);
  });

  it('keeps the PMTiles diff overlay available even when it is not in the archive', () => {
    const app = mountApp().current;
    app.pmtilesAvailableLayerNames = new Set(['Ciclovia']);
    const layers = app.initLayers({}, false, true, undefined, true, false, CUIABA_AREA);
    const diff = layers.find((l) => l.name === 'Diff v1→v2');
    expect(diff).toBeTruthy();
    expect(diff.isAvailable).toBe(true);
    expect(mapperLayerNeedsCityGeoJson(diff)).toBe(false);
    expect(mapperLayerNeedsCityGeoJson(layers.find((l) => l.name === 'Prefeitura 2024'))).toBe(
      false
    );
    expect(mapperLayerNeedsCityGeoJson(layers.find((l) => l.name === 'Lista Transalvador'))).toBe(
      false
    );
  });

  it('hides GeoJSON pairing layers until the analytics sidebar is open', () => {
    const app = mountApp().current;
    app.pmtilesAvailableLayerNames = new Set(['Ciclovia']);
    const closed = app.initLayers({}, false, true, undefined, true, false, CUIABA_AREA);
    const pairingClosed = closed.filter(mapperLayerNeedsCityGeoJson);
    expect(pairingClosed.length).toBeGreaterThan(0);
    expect(pairingClosed.every((l) => l.isAvailable === false)).toBe(true);
    expect(closed.find((l) => l.name === 'Diff v1→v2').isAvailable).toBe(true);
    expect(closed.find((l) => l.name === 'Prefeitura 2024').isAvailable).toBe(true);

    const open = app.initLayers({}, false, true, undefined, true, true, CUIABA_AREA);
    expect(open.filter(mapperLayerNeedsCityGeoJson).every((l) => l.isAvailable)).toBe(true);
    expect(open.find((l) => l.name === 'Diff v1→v2').isAvailable).toBe(true);
    expect(open.find((l) => l.name === 'Diff v1→v2').isActive).toBe(true);
    expect(open.find((l) => l.name === 'Lado A').isActive).toBe(true);
    expect(open.find((l) => l.name === 'Lado B').isActive).toBe(true);
    expect(open.find((l) => l.name === 'Tag + ciclovia').isActive).toBe(true);
    expect(open.find((l) => l.name === 'Ciclovias sobrepostas').isActive).toBe(true);
    expect(open.find((l) => l.name === 'Não pareados').isActive).toBe(true);
    expect(open.find((l) => l.name === 'Pareados').isActive).toBe(false);
  });

  it('restores mapper overlay visibility from saved layersStates', () => {
    const app = mountApp().current;
    const layers = app.initLayers(
      { 'lado-a': false, 'prefeitura-2024': false },
      false,
      true,
      undefined,
      true,
      true
    );
    expect(layers.find((l) => l.name === 'Lado A').isActive).toBe(false);
    expect(layers.find((l) => l.name === 'Prefeitura 2024').isActive).toBe(false);
    expect(layers.find((l) => l.name === 'Lado B').isActive).toBe(true);
  });

  it('initLayers includes pairing layers and the v1/v2 diff overlay in mapper mode', () => {
    const app = mountApp().current;
    const layers = app.initLayers({}, false, false, undefined, true);
    expect(layers.some((l) => l.onlyDebug)).toBe(true);
    expect(layers.some((l) => l.name === 'Diff v1→v2')).toBe(true);
    const hallLayers = layers.filter(
      (l) => l.mapperGroup && String(l.mapperGroup).endsWith('-hall')
    );
    expect(hallLayers.length).toBeGreaterThan(0);
    expect(hallLayers.every((l) => l.isAvailable)).toBe(true);
  });

  it('loadPmtilesAvailableLayers no-ops without a tiles URL', async () => {
    const prev = process.env.REACT_APP_PMTILES_URL;
    delete process.env.REACT_APP_PMTILES_URL;
    const app = mountApp().current;
    await act(async () => {
      await app.loadPmtilesAvailableLayers();
    });
    expect(app.pmtilesAvailableLayerNames).toBeNull();
    process.env.REACT_APP_PMTILES_URL = prev;
  });

  it('ignores archives without a layer list', async () => {
    mockGetMetadata.mockResolvedValue({ description: 'not json' });
    const app = mountApp().current;
    await act(async () => {
      await app.loadPmtilesAvailableLayers();
    });
    expect(app.pmtilesAvailableLayerNames).toBeNull();
  });

  it('defaults to layers v2 and can switch to v1', () => {
    const app = mountApp().current;
    expect(app.state.layersVersion).toBe('v2');
    expect(app.state.layers.find((l) => l.name === 'Ciclovia').except).toEqual([
      ['segregated', 'no'],
    ]);
    act(() => app.onLayersVersionChange('v1'));
    expect(app.state.layersVersion).toBe('v1');
    expect(app.state.layers.find((l) => l.name === 'Ciclovia').except).toBeUndefined();
    act(() => app.onLayersVersionChange('nope'));
    expect(app.state.layersVersion).toBe('v2');
  });

  it('reads layers version from the URL', () => {
    const app = mountApp('/sao-paulo?layers=v1').current;
    expect(app.state.layersVersion).toBe('v1');
    expect(app.state.layers.find((l) => l.name === 'Ciclovia').except).toBeUndefined();
  });

  it('onLayersChange updates one layer or a batch', () => {
    const app = mountApp().current;
    const id = app.state.layers.find((l) => l.name === 'Ciclovia').id;
    act(() => app.onLayersChange(id, false));
    expect(app.state.layers.find((l) => l.id === id).isActive).toBe(false);
    act(() => app.onLayersChange([{ id, isActive: true }]));
    expect(app.state.layers.find((l) => l.id === id).isActive).toBe(true);
    act(() => app.onLayersChange('no-such-layer', true));
    act(() => app.onLayersChange([{ id: 'missing', isActive: true }]));
  });
});

describe('App UI handlers', () => {
  it('toggles theme, sidebar, about, legend and privacy', () => {
    const app = mountApp().current;
    act(() => app.toggleTheme(true));
    expect(app.state.isDarkMode).toBe(true);
    act(() => app.toggleTheme(true)); // no-op
    act(() => app.toggleTheme());
    expect(app.state.isDarkMode).toBe(false);

    act(() => app.openAboutModal());
    expect(app.state.aboutModal).toBe(true);
    act(() => app.closeAboutModal());
    expect(app.state.aboutModal).toBe(false);

    act(() => app.openLayersLegendModal('vias-ciclaveis-section'));
    expect(app.state.layersLegendModal).toBe(true);
    expect(app.state.layersLegendScrollToSection).toBe('vias-ciclaveis-section');
    act(() => app.closeLayersLegendModal());
    expect(app.state.layersLegendModal).toBe(false);

    act(() => app.openPrivacyPolicyModal());
    act(() => app.closePrivacyPolicyModal());
  });

  it('toggles mapper mode into localStorage without a URL param', () => {
    const app = mountApp().current;
    expect(app.state.mapperMode).toBe(false);
    expect(app.state.layers.some((l) => l.onlyDebug)).toBe(false);
    expect(app.state.lengthCalculationStrategy).toBe('pessimistic');
    expect(app.state.parallelDedupeEngine).toBe('geometry_first');

    act(() => app.toggleMapperMode());
    expect(app.state.mapperMode).toBe(true);
    expect(app.state.layers.some((l) => l.onlyDebug)).toBe(true);
    expect(app.state.lengthCalculationStrategy).toBe('pessimistic');
    expect(app.state.parallelDedupeEngine).toBe('geometry_first');
    expect(JSON.parse(localStorage.getItem('appstate')).mapperMode).toBe(true);
    expect(window.location.search).not.toMatch(/mapper/);

    act(() => app.toggleMapperMode());
    expect(app.state.mapperMode).toBe(false);
    expect(app.state.lengthCalculationStrategy).toBe('pessimistic');
    expect(app.state.parallelDedupeEngine).toBe('geometry_first');
    expect(JSON.parse(localStorage.getItem('appstate')).mapperMode).toBe(false);
  });

  it('opens the analytics sidebar when mapper mode is turned on', () => {
    const app = mountApp().current;
    expect(app.state.isSidebarOpen).toBe(false);

    act(() => app.toggleMapperMode());
    expect(app.state.mapperMode).toBe(true);
    expect(app.state.isSidebarOpen).toBe(true);

    act(() => app.toggleMapperMode());
    expect(app.state.mapperMode).toBe(false);
    expect(app.state.isSidebarOpen).toBe(true);
  });

  it('boots mapper and debug with pessimistic + geometry_first', () => {
    localStorage.setItem('appstate', JSON.stringify({ mapperMode: true }));
    const mapperApp = mountApp().current;
    expect(mapperApp.state.mapperMode).toBe(true);
    expect(mapperApp.state.lengthCalculationStrategy).toBe('pessimistic');
    expect(mapperApp.state.parallelDedupeEngine).toBe('geometry_first');

    localStorage.setItem('ciclomapa_welcomeSeen:v3', '1');
    localStorage.removeItem('appstate');
    const debugApp = mountApp('/sao-paulo?debug=true').current;
    expect(debugApp.state.debugMode).toBeTruthy();
    expect(debugApp.state.lengthCalculationStrategy).toBe('pessimistic');
    expect(debugApp.state.parallelDedupeEngine).toBe('geometry_first');
  });

  it('downloadData notifies when GeoJSON is not ready, otherwise tracks a purchase', () => {
    const app = mountApp().current;
    jest.spyOn(app, 'updateData').mockImplementation(() => {});
    app.downloadData();
    expect(appNotification.info).toHaveBeenCalled();
    expect(Analytics.event).not.toHaveBeenCalled();

    act(() =>
      app.setState({
        geoJson: { type: 'FeatureCollection', features: [] },
        layers: [{ type: 'way', isActive: true, id: 'ciclovia' }],
      })
    );
    app.downloadData();
    expect(Analytics.event).toHaveBeenCalledWith('purchase', expect.any(Object));
  });

  it('getCurrentViewport prefers the live map', () => {
    const app = mountApp().current;
    expect(app.getMapViewport()).toEqual(
      expect.objectContaining({ lat: expect.any(Number), lng: expect.any(Number) })
    );
    act(() =>
      app.setState({
        map: {
          getCenter: () => ({ lat: 1, lng: 2 }),
          getZoom: () => 9,
        },
      })
    );
    expect(app.getCurrentViewport()).toEqual({ lat: 1, lng: 2, zoom: 9 });
  });

  it('followViewportCity is off by default, persists, and syncs when turned on with analytics open', async () => {
    const app = mountApp().current;
    expect(app.state.followViewportCity).toBe(false);
    const spy = jest.spyOn(app, 'syncAreaWithViewportThenLoadCityData').mockResolvedValue();
    app.mapComponent = { initBoundaryLayer: jest.fn() };

    await act(async () => {
      app.setFollowViewportCity(true);
    });
    expect(app.state.followViewportCity).toBe(true);
    expect(JSON.parse(localStorage.getItem('appstate')).followViewportCity).toBe(true);
    expect(spy).not.toHaveBeenCalled();

    await act(async () => {
      app.toggleSidebar(true);
    });
    spy.mockClear();

    await act(async () => {
      app.setState({ mapperMode: true });
    });
    await act(async () => {
      app.setFollowViewportCity(true);
    });
    expect(spy).toHaveBeenCalledTimes(1);

    await act(async () => {
      app.setFollowViewportCity(false);
    });
    expect(app.state.followViewportCity).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('boots followViewportCity from localStorage', () => {
    localStorage.setItem('appstate', JSON.stringify({ followViewportCity: true }));
    const app = mountApp().current;
    expect(app.state.followViewportCity).toBe(true);
  });

  it('onMapPositionChange schedules a viewport follow only when the option is on', () => {
    const app = mountApp().current;
    app.debouncedFollowViewportCity = Object.assign(jest.fn(), { cancel: jest.fn() });

    act(() => app.onMapPositionChange());
    expect(app.debouncedFollowViewportCity).not.toHaveBeenCalled();

    act(() => app.setState({ followViewportCity: true, mapperMode: true }));
    act(() => app.onMapPositionChange());
    expect(app.debouncedFollowViewportCity).toHaveBeenCalledTimes(1);
  });

  it('maybeFollowViewportCity skips when analytics is closed, zoomed out, or the option is off', () => {
    const app = mountApp().current;
    const spy = jest.spyOn(app, 'syncAreaWithViewportThenLoadCityData').mockResolvedValue();
    jest.spyOn(app, 'getCurrentViewport').mockReturnValue({ lat: -15, lng: -56, zoom: 12 });

    act(() => app.setState({ followViewportCity: false, isSidebarOpen: true }));
    app.maybeFollowViewportCity();
    expect(spy).not.toHaveBeenCalled();

    act(() => app.setState({ followViewportCity: true, isSidebarOpen: false }));
    app.maybeFollowViewportCity();
    expect(spy).not.toHaveBeenCalled();

    act(() => app.setState({ followViewportCity: true, isSidebarOpen: true }));
    app.maybeFollowViewportCity();
    expect(spy).not.toHaveBeenCalled();

    act(() => app.setState({ followViewportCity: true, isSidebarOpen: true, mapperMode: true }));
    app.getCurrentViewport.mockReturnValue({ lat: -15, lng: -56, zoom: 4 });
    app.maybeFollowViewportCity();
    expect(spy).not.toHaveBeenCalled();

    app.getCurrentViewport.mockReturnValue({ lat: -15, lng: -56, zoom: 12 });
    app.maybeFollowViewportCity();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('onDirectionsPanelToggle and toggleSidebar kick off viewport city sync', async () => {
    const app = mountApp().current;
    const spy = jest.spyOn(app, 'syncAreaWithViewportThenLoadCityData').mockResolvedValue();
    app.mapComponent = { initBoundaryLayer: jest.fn() };
    app.onDirectionsPanelToggle(true);
    expect(app._isDirectionsPanelOpen).toBe(true);
    expect(spy).toHaveBeenCalled();
    expect(app.mapComponent.initBoundaryLayer).toHaveBeenCalled();

    await act(async () => {
      app.toggleSidebar(true);
    });
    expect(app.state.isSidebarOpen).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('toggleSidebar hides pairing layers without clearing their visibility', async () => {
    const app = mountApp().current;
    jest.spyOn(app, 'syncAreaWithViewportThenLoadCityData').mockResolvedValue();
    await act(async () => {
      app.setState({
        mapperMode: true,
        isSidebarOpen: true,
        layers: app.initLayers({}, false, false, undefined, true, true, CUIABA_AREA),
      });
    });
    expect(app.state.layers.find((l) => l.name === 'Lado A').isAvailable).toBe(true);
    expect(app.state.layers.find((l) => l.name === 'Lado A').isActive).toBe(true);
    expect(app.state.layers.find((l) => l.name === 'Tag + ciclovia').isActive).toBe(true);

    await act(async () => {
      app.toggleSidebar(false);
    });
    const closed = app.state.layers.find((l) => l.name === 'Lado A');
    expect(closed.isAvailable).toBe(false);
    expect(closed.isActive).toBe(true);
    expect(app.state.layers.find((l) => l.name === 'Diff v1→v2').isAvailable).toBe(true);
    expect(app.state.layers.find((l) => l.name === 'Prefeitura 2024').isAvailable).toBe(true);

    await act(async () => {
      app.toggleSidebar(true);
    });
    const reopened = app.state.layers.find((l) => l.name === 'Lado A');
    expect(reopened.isAvailable).toBe(true);
    expect(reopened.isActive).toBe(true);
  });

  it('ignores the engine shortcut outside mapper/debug and with modifiers', () => {
    const app = mountApp().current;
    const spy = jest.spyOn(app, 'togglePreviousParallelDedupeEngine');
    act(() => app.onGlobalKeyDown({ key: 'm', preventDefault: jest.fn(), target: document.body }));
    expect(spy).not.toHaveBeenCalled();

    act(() => app.toggleMapperMode());
    act(() =>
      app.onGlobalKeyDown({
        key: 'm',
        ctrlKey: true,
        preventDefault: jest.fn(),
        target: document.body,
      })
    );
    expect(spy).not.toHaveBeenCalled();

    act(() => app.onGlobalKeyDown({ key: 'm', preventDefault: jest.fn(), target: document.body }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not apply a follow geocode after following is turned off', async () => {
    let resolveGuess;
    guessPlaceFromViewport.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGuess = resolve;
        })
    );
    const app = mountApp().current;
    jest.spyOn(app, 'getCurrentViewport').mockReturnValue({ lng: -46.6, lat: -23.5, zoom: 14 });
    const setArea = jest.spyOn(app, 'setArea');

    await act(async () => {
      app.setState({
        mapperMode: true,
        isSidebarOpen: true,
        followViewportCity: true,
        area: 'Porto Alegre, Rio Grande do Sul, Brasil',
      });
    });

    let pending;
    await act(async () => {
      pending = app.syncAreaWithViewportThenLoadCityData({ fromFollow: true });
    });
    act(() => app.setFollowViewportCity(false));
    resolveGuess({ place_name: 'São Paulo, São Paulo, Brasil' });
    await act(async () => {
      await pending;
    });
    expect(setArea).not.toHaveBeenCalled();
  });

  it('does not abort a full OSM refresh for a boundary-only backfill', () => {
    const app = mountApp().current;
    const abort = jest.fn();
    app.currentOSMRequest = { abort };
    app._currentOSMRequestIsFull = true;
    const result = app.getDataFromOSM({ boundaryOnly: true, areaName: app.state.area });
    expect(abort).not.toHaveBeenCalled();
    expect(app.currentOSMRequest).toEqual({ abort });
    return expect(result).resolves.toBeUndefined();
  });
});
