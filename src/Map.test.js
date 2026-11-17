import React from 'react';
import { render } from '@testing-library/react';
import { DirectionsProvider } from './contexts/DirectionsContext';
import MapWrapper, {
  flyMapToCityFocus,
  curvedLineBetween,
  parseRoutePointCenter,
  routeCalculatingLineColor,
} from './Map.js';
import { DEFAULT_ZOOM, PMTILES_SOURCE_ID } from './config/constants.js';

const mockFlyMapTo = jest.fn();
jest.mock('./features/map/mapCamera.js', () => ({
  flyMapTo: (...args) => mockFlyMapTo(...args),
}));
jest.mock('mapbox-gl', () => ({
  default: {
    Map: jest.fn(),
    NavigationControl: jest.fn(),
    GeolocateControl: jest.fn(),
    Marker: jest.fn(),
    Popup: jest.fn(),
    accessToken: '',
  },
}));
jest.mock('./AirtableDatabase.js', () =>
  jest.fn().mockImplementation(() => ({ getComments: jest.fn() }))
);
jest.mock('./MapPopups.js', () => jest.fn().mockImplementation(() => ({})));
jest.mock('./CommentModal.js', () => () => null);
jest.mock('./NewCommentCursor.js', () => () => null);
jest.mock('./Analytics.js', () => ({ event: jest.fn() }));
jest.mock('./dev/dataLoadTracker.js', () => ({
  startDataLoad: jest.fn(() => 1),
  finishDataLoad: jest.fn(),
}));
jest.mock('./features/geolocation/userLocationCache.js', () => ({
  __esModule: true,
  default: { warmUpIfAlreadyGranted: jest.fn() },
}));
jest.mock('@turf/circle', () => ({
  __esModule: true,
  default: () => ({
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [[[0, 0]]] },
  }),
}));

beforeEach(() => {
  window.history.replaceState({}, '', '/?e2e=1');
});

const defaultProps = {
  data: null,
  layers: [],
  style: 'mapbox://styles/mapbox/dark-v11',
  zoom: 12,
  lat: -30,
  lng: -51,
  showSatellite: false,
  location: 'Porto Alegre',
  onMapMoved: jest.fn(),
  onMapPositionChange: jest.fn(),
  needsCityGeoJsonContext: () => false,
  updateLengths: jest.fn(),
  embedMode: false,
  debugMode: false,
  isDarkMode: true,
  setMapRef: jest.fn(),
  directionsPanelRef: { current: null },
  toPoint: null,
  isTrackingUserLocation: false,
  onTrackingUserLocationChange: jest.fn(),
  globalSearchPin: null,
  onGlobalSearchPinDismiss: jest.fn(),
  favorites: [],
  onFavoritesChanged: jest.fn(),
  cleanMode: false,
};

function fakeMapbox(extra = {}) {
  const base = {
    off: jest.fn(),
    on: jest.fn(),
    once: jest.fn(),
    remove: jest.fn(),
    removeLayer: jest.fn(),
    removeSource: jest.fn(),
    getStyle: () => ({ layers: [] }),
    getLayer: () => false,
    getSource: () => null,
    addSource: jest.fn(),
    setLayoutProperty: jest.fn(),
    setFilter: jest.fn(),
    getCenter: () => ({ lat: 1, lng: 2 }),
    getZoom: () => 11,
    getCanvas: () => ({ style: {} }),
    loaded: () => true,
    ...extra,
  };
  return new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'symbol') return undefined;
      const fn = jest.fn();
      target[prop] = fn;
      return fn;
    },
  });
}
function mountMap(props = {}) {
  const ref = React.createRef();
  render(
    <DirectionsProvider>
      <MapWrapper ref={ref} {...defaultProps} {...props} />
    </DirectionsProvider>
  );
  const inst = ref.current;
  inst.map = inst.map || fakeMapbox();
  return inst;
}

describe('flyMapToCityFocus', () => {
  beforeEach(() => mockFlyMapTo.mockClear());

  it('no-ops on bad input', () => {
    flyMapToCityFocus(null, [-51, -30]);
    flyMapToCityFocus({}, null);
    flyMapToCityFocus({}, [NaN, 1]);
    expect(mockFlyMapTo).not.toHaveBeenCalled();
  });

  it('flies to the given center, with a Vitória override', () => {
    const map = {};
    flyMapToCityFocus(map, [-51.2, -30.0], 'Porto Alegre');
    expect(mockFlyMapTo).toHaveBeenCalledWith(map, { center: [-51.2, -30.0], zoom: DEFAULT_ZOOM });
    mockFlyMapTo.mockClear();
    flyMapToCityFocus(map, [0, 0], 'Vitória, Espírito Santo, Brasil');
    expect(mockFlyMapTo.mock.calls[0][1].center).toEqual([-40.3144, -20.2944]);
  });
});

describe('Map helpers', () => {
  it('renders the e2e container without creating a Mapbox map', () => {
    const { getByTestId } = render(
      <DirectionsProvider>
        <MapWrapper {...defaultProps} />
      </DirectionsProvider>
    );
    expect(getByTestId('map-container')).toBeInTheDocument();
  });

  it('convertFilterToMapboxFilter expands single and compound OSM filters', () => {
    const map = mountMap();
    expect(
      map.convertFilterToMapboxFilter({
        filters: [
          ['highway', 'cycleway'],
          [
            ['highway', 'track'],
            ['bicycle', 'yes'],
          ],
        ],
      })
    ).toEqual([
      'any',
      ['==', ['get', 'highway'], 'cycleway'],
      ['all', ['==', ['get', 'highway'], 'track'], ['==', ['get', 'bicycle'], 'yes']],
    ]);
  });

  it('getLayerUnderneathName prefers road-label-small', () => {
    const map = mountMap();
    expect(map.getLayerUnderneathName({ getLayer: () => false })).toBe('');
    expect(map.getLayerUnderneathName({ getLayer: (id) => id === 'road-label' })).toBe(
      'road-label'
    );
    expect(map.getLayerUnderneathName({ getLayer: () => true })).toBe('road-label-small');
  });

  it('applyCleanModeBasemapLabels hides basemap text and leaves CicloMapa sources alone', () => {
    const map = mountMap({ cleanMode: true });
    const setLayoutProperty = jest.fn();
    map.map = fakeMapbox({
      getStyle: () => ({
        layers: [
          {
            id: 'place-label',
            type: 'symbol',
            source: 'composite',
            layout: { 'text-field': '{name}', visibility: 'visible' },
          },
          {
            id: 'poi-label',
            type: 'symbol',
            source: PMTILES_SOURCE_ID,
            layout: { 'text-field': '{name}' },
          },
          { id: 'roads', type: 'line', source: 'composite', layout: {} },
        ],
      }),
      getLayer: (id) => id === 'place-label',
      setLayoutProperty,
    });
    map.applyCleanModeBasemapLabels();
    expect(setLayoutProperty).toHaveBeenCalledWith('place-label', 'visibility', 'none');
    expect(setLayoutProperty).not.toHaveBeenCalledWith(
      'poi-label',
      expect.anything(),
      expect.anything()
    );

    map.props = { ...map.props, cleanMode: false };
    map.applyCleanModeBasemapLabels();
    expect(setLayoutProperty).toHaveBeenCalledWith('place-label', 'visibility', 'visible');
  });

  it('updateRouteEndpointPoiFilters applies a within filter and restores it when routes clear', () => {
    const poiLayer = {
      id: 'estacoes',
      type: 'poi',
      icon: 'poi-rental',
      filters: [['amenity', 'bicycle_rental']],
    };
    const map = mountMap({ layers: [poiLayer] });
    const setFilter = jest.fn();
    const setData = jest.fn();
    const sources = {};
    map.map = fakeMapbox({
      getSource: (id) => sources[id],
      addSource: (id, spec) => {
        sources[id] = { ...spec, setData };
      },
      getLayer: () => true,
      setFilter,
    });

    map.updateRouteEndpointPoiFilters(true, [-51, -30], [-51.1, -30.1]);
    expect(setFilter).toHaveBeenCalled();
    const applied = setFilter.mock.calls[0][1];
    expect(applied[0]).toBe('all');
    expect(applied[2][0]).toBe('any');

    setFilter.mockClear();
    map.updateRouteEndpointPoiFilters(false);
    expect(setFilter).toHaveBeenCalled();
    expect(setFilter.mock.calls[0][1][0]).toBe('any');
  });

  it('curvedLineBetween starts at A, ends at B, and bulges north', () => {
    const from = [2.18, 41.4];
    const to = [2.15, 41.4];
    const coords = curvedLineBetween(from, to);
    expect(coords[0]).toEqual(from);
    expect(coords[coords.length - 1]).toEqual(to);
    expect(coords.length).toBeGreaterThan(8);
    expect(coords[Math.floor(coords.length / 2)][1]).toBeGreaterThan(41.4);
  });

  it('parseRoutePointCenter accepts [lng, lat] and {lng, lat}', () => {
    expect(parseRoutePointCenter([-46.63, -23.55])).toEqual([-46.63, -23.55]);
    expect(parseRoutePointCenter({ lng: -46.63, lat: -23.55 })).toEqual([-46.63, -23.55]);
    expect(parseRoutePointCenter(null)).toBeNull();
    expect(parseRoutePointCenter([NaN, 1])).toBeNull();
  });

  it('routeCalculatingLineColor contrasts with the basemap', () => {
    expect(routeCalculatingLineColor(true)).toMatch(/255,\s*255,\s*255/);
    expect(routeCalculatingLineColor(false)).toMatch(/28,\s*28,\s*28/);
  });

  it('applyRouteCalculatingOverlay draws a curve while loading and clears it after', () => {
    const setData = jest.fn();
    const setLayoutProperty = jest.fn();
    const setPaintProperty = jest.fn();
    const map = mountMap();
    map.map = fakeMapbox({
      getSource: (id) => (id === 'route-calculating' ? { setData } : null),
      getLayer: (id) => id === 'route-calculating-line',
      setLayoutProperty,
      setPaintProperty,
      moveLayer: jest.fn(),
    });
    map.props = {
      ...map.props,
      directionsLoading: true,
      isDarkMode: true,
      fromPoint: { result: { center: [-46.63, -23.55] } },
      toPoint: { result: { center: [-46.64, -23.56] } },
    };

    map.applyRouteCalculatingOverlay();
    expect(setLayoutProperty).toHaveBeenCalledWith(
      'route-calculating-line',
      'visibility',
      'visible'
    );
    const drawn = setData.mock.calls[0][0];
    expect(drawn.features[0].geometry.type).toBe('LineString');
    expect(drawn.features[0].geometry.coordinates[0]).toEqual([-46.63, -23.55]);

    map.props = { ...map.props, directionsLoading: false };
    map.applyRouteCalculatingOverlay();
    map.stopRouteCalculatingPulse();
    expect(setLayoutProperty).toHaveBeenCalledWith('route-calculating-line', 'visibility', 'none');
    expect(setData.mock.calls.at(-1)[0].features).toEqual([]);
  });

  it('puts unselected route casings under fills', () => {
    const added = [];
    const map = mountMap();
    map.map = fakeMapbox({
      addLayer: (layer) => added.push(layer.id),
      getLayer: () => false,
    });
    map.createRouteLayerSet(map.map, 'routes-unselected', 'bottom');
    expect(added).toEqual([
      'routes-unselected--interactive',
      'route-paddings-unselected',
      'route--borders-unselected',
      'routes-unselected',
    ]);

    added.length = 0;
    map.createRouteLayerSet(map.map, 'route-selected', 'top');
    expect(added).toEqual(['route-padding-selected', 'route-selected', 'route--border-selected']);
  });

  it('paints unselected routes with a hover feature-state', () => {
    const layers = [];
    const map = mountMap();
    map.map = fakeMapbox({
      addLayer: (layer) => layers.push(layer),
      getLayer: () => false,
    });
    map.createRouteLayerSet(map.map, 'routes-unselected', 'bottom');
    const fill = layers.find((layer) => layer.id === 'routes-unselected');
    const border = layers.find((layer) => layer.id === 'route--borders-unselected');
    const hit = layers.find((layer) => layer.id === 'routes-unselected--interactive');
    expect(JSON.stringify(fill.paint['line-color'])).toContain('feature-state');
    expect(fill.paint['line-width']).toBe(8);
    expect(JSON.stringify(border.paint)).not.toContain('feature-state');
    expect(hit.paint['line-width']).toBe(40);
    expect(hit.paint['line-opacity']).toBe(0);
  });

  it('syncMapState prefers onMapPositionChange', () => {
    const onMapPositionChange = jest.fn();
    const onMapMoved = jest.fn();
    const map = mountMap({ onMapPositionChange, onMapMoved });
    map.map = fakeMapbox({
      getCenter: () => ({ lat: 1, lng: 2 }),
      getZoom: () => 11,
    });
    map.syncMapState();
    expect(onMapPositionChange).toHaveBeenCalledWith({ lat: 1, lng: 2, zoom: 11 });
    expect(onMapMoved).not.toHaveBeenCalled();
  });
});
