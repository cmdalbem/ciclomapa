import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

import App from './App.js';
import { PMTILES_FALLBACK_MISSING_LAYER_NAMES } from './config/constants.js';
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
  appNotification: { info: jest.fn(), error: jest.fn(), success: jest.fn(), warning: jest.fn() },
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
});
