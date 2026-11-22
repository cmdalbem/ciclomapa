import React from 'react';
import { render } from '@testing-library/react';
import { DirectionsProvider } from './contexts/DirectionsContext';
import MapWrapper, {
  applyOverlapXray,
  flyMapToCityFocus,
  pickCityBoundaryFeature,
  ringsAsPolygonHoles,
  GEOJSON_LAYER_SUFFIX,
  OSM_GEOJSON_SOURCE_ID,
} from './Map.js';
import { DEFAULT_ZOOM, PMTILES_SOURCE_ID, PMTILES_SOURCE_LAYER } from './config/constants.js';
import { layersVersionDiffMapboxFilter } from './config/layersCatalog.js';

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
  isSidebarOpen: false,
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

describe('city boundary helpers', () => {
  const closed = (coords) => [...coords, coords[0]];
  const small = closed([
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ]);
  const large = closed([
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]);

  it('picks the largest closed admin polygon among city-level features', () => {
    const features = [
      {
        properties: { boundary: 'administrative', admin_level: '9', name: 'RA' },
        geometry: { type: 'Polygon', coordinates: [large] },
      },
      {
        properties: { boundary: 'administrative', admin_level: '4', name: 'DF' },
        geometry: { type: 'Polygon', coordinates: [small] },
      },
      {
        properties: { highway: 'cycleway' },
        geometry: { type: 'Polygon', coordinates: [large] },
      },
    ];
    expect(pickCityBoundaryFeature(features).properties.name).toBe('DF');
  });

  it('reverses CCW rings so they work as polygon holes', () => {
    const ccw = closed([
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ]);
    const [hole] = ringsAsPolygonHoles([ccw]);
    expect(hole[0]).toEqual(ccw[0]);
    expect(hole[1]).toEqual(ccw[ccw.length - 2]);
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

  it('applyOsmFiltersForLayer writes filters onto cyclepath layer ids', () => {
    const map = mountMap();
    const setFilter = jest.fn();
    map.map = fakeMapbox({ getLayer: () => true, setFilter });
    map.applyOsmFiltersForLayer({
      id: 'ciclovia',
      type: 'way',
      filters: [['highway', 'cycleway']],
      except: [['segregated', 'no']],
    });
    expect(setFilter).toHaveBeenCalledWith('ciclovia--pmtiles', [
      'all',
      ['any', ['==', ['get', 'highway'], 'cycleway']],
      ['!=', ['get', 'segregated'], 'no'],
    ]);
  });

  it('convertFilterToMapboxFilter excludes layer.except tags', () => {
    const map = mountMap();
    expect(
      map.convertFilterToMapboxFilter({
        filters: [['highway', 'cycleway']],
        except: [['segregated', 'no']],
      })
    ).toEqual([
      'all',
      ['any', ['==', ['get', 'highway'], 'cycleway']],
      ['!=', ['get', 'segregated'], 'no'],
    ]);
  });

  it('convertFilterToMapboxFilter keeps a prebuilt mapboxFilter', () => {
    const map = mountMap();
    const mapboxFilter = layersVersionDiffMapboxFilter();
    expect(map.convertFilterToMapboxFilter({ mapboxFilter })).toBe(mapboxFilter);
  });

  it('applyOsmFiltersForLayer writes a prebuilt mapboxFilter', () => {
    const map = mountMap();
    const setFilter = jest.fn();
    map.map = fakeMapbox({ getLayer: () => true, setFilter });
    const mapboxFilter = ['!=', ['get', 'a'], ['get', 'b']];
    map.applyOsmFiltersForLayer({
      id: 'diff-v1v2',
      type: 'way',
      mapboxFilter,
    });
    expect(setFilter).toHaveBeenCalledWith('diff-v1v2--pmtiles', mapboxFilter);
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

  it('applyOverlapXray shows halo layers under visible cycle lines', () => {
    const paint = { 'ciclovia--pmtiles': {} };
    const layout = {
      'ciclovia--pmtiles': { visibility: 'visible' },
      'ciclovia--halo--pmtiles': { visibility: 'none' },
    };
    const map = {
      getStyle: () => ({
        layers: [
          { id: 'ciclovia--halo--pmtiles', type: 'line' },
          { id: 'ciclovia--pmtiles', type: 'line' },
          { id: 'ciclovia--interactive--pmtiles', type: 'line' },
          { id: 'boundary-layer', type: 'line' },
        ],
      }),
      getLayer: (id) => layout[id] !== undefined,
      getPaintProperty: (id, prop) => paint[id]?.[prop],
      getLayoutProperty: (id, prop) => layout[id]?.[prop],
      setPaintProperty: jest.fn((id, prop, value) => {
        paint[id] = paint[id] || {};
        paint[id][prop] = value;
      }),
      setLayoutProperty: jest.fn((id, prop, value) => {
        layout[id] = layout[id] || {};
        layout[id][prop] = value;
      }),
    };

    applyOverlapXray(map, true);
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      'ciclovia--halo--pmtiles',
      'visibility',
      'visible'
    );
    expect(map.setPaintProperty).toHaveBeenCalledWith('ciclovia--pmtiles', 'line-opacity', 0.75);

    map.setPaintProperty.mockClear();
    map.setLayoutProperty.mockClear();
    applyOverlapXray(map, false);
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      'ciclovia--halo--pmtiles',
      'visibility',
      'none'
    );
    expect(map.setPaintProperty).toHaveBeenCalledWith('ciclovia--pmtiles', 'line-opacity', 1);
  });

  it('setDedupeDebugData writes GeoJSON onto the overlay source in debug mode', () => {
    const map = mountMap({ debugMode: true });
    const setData = jest.fn();
    map.map = fakeMapbox({
      getSource: (id) => (id === 'dedupe-debug' ? { setData } : null),
    });
    const fc = { type: 'FeatureCollection', features: [{ type: 'Feature' }] };
    map.setDedupeDebugData(fc);
    expect(setData).toHaveBeenCalledWith(fc);
  });

  it('initCyclepathLayerForSource omits source-layer on the GeoJSON overlay', () => {
    const map = mountMap({ debugMode: true, layers: [] });
    const addLayer = jest.fn();
    map.map = fakeMapbox({
      getSource: () => ({}),
      getLayer: () => false,
      addLayer,
      on: jest.fn(),
    });
    map.initCyclepathLayerForSource(
      {
        id: 'lado-a',
        name: 'Lado A',
        onlyDebug: true,
        filters: [
          [
            ['ciclomapa:paired', 'true'],
            ['ciclomapa:side', 'a'],
          ],
        ],
        style: { lineColor: '#0B54FE', lineWidth: 8 },
      },
      'dedupe-debug',
      null
    );
    expect(addLayer).toHaveBeenCalled();
    const added = addLayer.mock.calls.map(([spec]) => spec);
    expect(added.every((spec) => spec.source === 'dedupe-debug')).toBe(true);
    expect(added.every((spec) => spec['source-layer'] === undefined)).toBe(true);
    const halo = added.find((spec) => spec.id === 'lado-a--halo--pmtiles');
    expect(halo).toBeTruthy();
    expect(halo.layout.visibility).toBe('none');
    expect(halo.paint['line-opacity']).toBe(0.28);
  });

  it('initCyclepathLayerForSource paints the v1/v2 diff overlay from PMTiles', () => {
    const map = mountMap({ debugMode: true, layers: [] });
    const addLayer = jest.fn();
    map.map = fakeMapbox({
      getSource: () => ({}),
      getLayer: () => false,
      addLayer,
      on: jest.fn(),
    });
    const mapboxFilter = ['==', ['get', 'highway'], 'cycleway'];
    map.initCyclepathLayerForSource(
      {
        id: 'diff-v1v2',
        name: 'Diff v1→v2',
        onlyDebug: true,
        debugSource: 'pmtiles',
        mapboxFilter,
        style: { lineColor: '#FF00AA', lineWidth: 20, lineStyle: 'dashed' },
      },
      PMTILES_SOURCE_ID
    );
    const added = addLayer.mock.calls.map(([spec]) => spec);
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((spec) => spec.source === PMTILES_SOURCE_ID)).toBe(true);
    expect(added.every((spec) => spec['source-layer'] === PMTILES_SOURCE_LAYER)).toBe(true);
    expect(added.every((spec) => spec.filter === mapboxFilter)).toBe(true);
    expect(added.some((spec) => spec.id?.endsWith('--arrows'))).toBe(false);
    const line = added.find((spec) => spec.id === 'diff-v1v2--pmtiles');
    expect(line.paint['line-dasharray']).toEqual([1, 1]);
  });

  it('initCyclepathLayerForSource paints city GeoJSON without a source-layer', () => {
    const map = mountMap({ layers: [] });
    const addLayer = jest.fn();
    map.map = fakeMapbox({
      getSource: () => ({}),
      getLayer: () => false,
      addLayer,
      on: jest.fn(),
    });
    map.initCyclepathLayerForSource(
      {
        id: 'ciclovia',
        name: 'Ciclovia',
        filters: [['highway', 'cycleway']],
        style: { lineColor: '#00aa00', lineWidth: 4 },
      },
      OSM_GEOJSON_SOURCE_ID,
      null,
      GEOJSON_LAYER_SUFFIX
    );
    const added = addLayer.mock.calls.map(([spec]) => spec);
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((spec) => spec.source === OSM_GEOJSON_SOURCE_ID)).toBe(true);
    expect(added.every((spec) => spec['source-layer'] === undefined)).toBe(true);
    expect(added.some((spec) => spec.id === `ciclovia${GEOJSON_LAYER_SUFFIX}`)).toBe(true);
    expect(added.some((spec) => spec.id === `ciclovia--interactive${GEOJSON_LAYER_SUFFIX}`)).toBe(
      true
    );
    expect(added.some((spec) => spec.id?.endsWith('--arrows'))).toBe(true);
  });

  it('updateLayerVisibility paints city GeoJSON instead of PMTiles while analytics is open', () => {
    const ciclovia = { id: 'ciclovia', type: 'way', isActive: true };
    const map = mountMap({ isSidebarOpen: true, layers: [ciclovia] });
    const setLayoutProperty = jest.fn();
    map.map = fakeMapbox({
      getLayer: () => true,
      setLayoutProperty,
    });
    map.updateLayerVisibility();
    expect(setLayoutProperty).toHaveBeenCalledWith('ciclovia--pmtiles', 'visibility', 'none');
    expect(setLayoutProperty).toHaveBeenCalledWith(
      `ciclovia${GEOJSON_LAYER_SUFFIX}`,
      'visibility',
      'visible'
    );
  });

  it('reapplies route endpoint POI filters after a layers version change', () => {
    const poi = {
      id: 'bikeparking',
      type: 'poi',
      icon: 'poi-bikeparking',
      isActive: true,
      filters: [['amenity', 'bicycle_parking']],
    };
    const routeProps = {
      layers: [poi],
      layersVersion: 'v2',
      routes: { routes: [{}] },
      fromPoint: { result: { center: [0, 0] } },
    };
    const map = mountMap(routeProps);
    map.map = fakeMapbox({
      getLayer: () => true,
      getSource: () => ({ setData: jest.fn() }),
      querySourceFeatures: () => [],
    });
    const applySpy = jest.spyOn(map, 'applyOsmFiltersForLayer');
    const visSpy = jest.spyOn(map, 'updateLayerVisibility').mockImplementation(() => {});
    map.componentDidUpdate({
      ...defaultProps,
      ...routeProps,
      layersVersion: 'v1',
    });
    expect(applySpy).toHaveBeenCalled();
    expect(visSpy).toHaveBeenCalled();
  });

  it('rebuilds the city boundary when the analytics sidebar toggles', () => {
    const map = mountMap({ isSidebarOpen: true });
    map.map = fakeMapbox();
    const spy = jest.spyOn(map, 'initBoundaryLayer');
    map.componentDidUpdate({ ...defaultProps, isSidebarOpen: false, layers: [] });
    expect(spy).toHaveBeenCalled();
  });

  it('initBoundaryLayer removes the mask when city GeoJSON context is off', () => {
    const map = mountMap({
      isSidebarOpen: false,
      needsCityGeoJsonContext: () => false,
    });
    const removeLayer = jest.fn();
    const removeSource = jest.fn();
    map.map = fakeMapbox({
      isStyleLoaded: () => true,
      getLayer: (id) =>
        id === 'boundary-mask' || id === 'boundary-layer' || id === 'boundary-layer-halo',
      getSource: () => ({}),
      removeLayer,
      removeSource,
      addSource: jest.fn(),
      addLayer: jest.fn(),
    });
    map.initBoundaryLayer();
    expect(removeLayer).toHaveBeenCalledWith('boundary-mask');
    expect(removeSource).toHaveBeenCalledWith('boundaryMaskSrc');
    expect(map.map.addLayer).not.toHaveBeenCalled();
  });

  it('initBoundaryLayer still removes the mask while the style is reloading', () => {
    const map = mountMap({
      isSidebarOpen: false,
      needsCityGeoJsonContext: () => false,
    });
    const removeLayer = jest.fn();
    const removeSource = jest.fn();
    map.map = fakeMapbox({
      isStyleLoaded: () => false,
      getLayer: (id) => id === 'boundary-mask',
      getSource: (id) => (id === 'boundaryMaskSrc' ? {} : null),
      removeLayer,
      removeSource,
      addLayer: jest.fn(),
    });
    map.initBoundaryLayer();
    expect(removeLayer).toHaveBeenCalledWith('boundary-mask');
    expect(removeSource).toHaveBeenCalledWith('boundaryMaskSrc');
    expect(map.map.addLayer).not.toHaveBeenCalled();
  });

  it('initBoundaryLayer retries adding the mask once the style is idle', () => {
    const ring = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ];
    const map = mountMap({
      isSidebarOpen: true,
      needsCityGeoJsonContext: () => true,
      data: {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { boundary: 'administrative', admin_level: '8' },
            geometry: { type: 'Polygon', coordinates: [ring] },
          },
        ],
      },
    });
    let styleLoaded = false;
    const listeners = {};
    const addSource = jest.fn();
    const addLayer = jest.fn();
    const removeLayer = jest.fn();
    map.map = fakeMapbox({
      isStyleLoaded: () => styleLoaded,
      getLayer: () => false,
      getSource: () => null,
      addSource,
      addLayer,
      removeLayer,
      once: (ev, cb) => {
        listeners[ev] = cb;
      },
      off: jest.fn(),
    });
    map.initBoundaryLayer();
    expect(addLayer).not.toHaveBeenCalled();
    expect(removeLayer).not.toHaveBeenCalled();
    expect(listeners.idle).toEqual(expect.any(Function));

    styleLoaded = true;
    listeners.idle();
    expect(addSource).toHaveBeenCalledWith('boundaryMaskSrc', expect.any(Object));
    expect(addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'boundary-mask' }),
      undefined
    );
  });

  it('updateLayerVisibility keeps PMTiles when there is no city GeoJSON copy', () => {
    const ciclovia = { id: 'ciclovia', type: 'way', isActive: true };
    const map = mountMap({ isSidebarOpen: true, layers: [ciclovia] });
    const setLayoutProperty = jest.fn();
    map.map = fakeMapbox({
      getLayer: (id) => !String(id).includes(GEOJSON_LAYER_SUFFIX),
      setLayoutProperty,
    });
    map.updateLayerVisibility();
    expect(setLayoutProperty).toHaveBeenCalledWith('ciclovia--pmtiles', 'visibility', 'visible');
    expect(setLayoutProperty).not.toHaveBeenCalledWith(
      `ciclovia${GEOJSON_LAYER_SUFFIX}`,
      'visibility',
      'visible'
    );
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
