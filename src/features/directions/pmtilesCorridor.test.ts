import {
  chooseZoomForRoutes,
  collectTilesForRoutes,
  lngLatToTile,
  tileBbox,
} from './pmtilesCorridor';

jest.mock('pmtiles', () => ({ PMTiles: class {} }));
jest.mock('@mapbox/vector-tile', () => ({ VectorTile: class {} }));
jest.mock('pbf', () => ({ PbfReader: jest.fn() }));
jest.mock('@turf/bbox-clip', () => ({ __esModule: true, default: jest.fn() }));
jest.mock('../../utils/geojsonUtils.js', () => ({
  computeTypologies: (data: unknown) => data,
}));

describe('lngLatToTile', () => {
  it('maps a known lon/lat to the expected mercator tile', () => {
    // Porto Alegre roughly; z=10 tile should be stable.
    const tile = lngLatToTile(-51.2177, -30.0346, 10);
    expect(tile).toEqual({ z: 10, x: 366, y: 601 });
  });
});

describe('tileBbox', () => {
  it('returns a west < east, south < north bbox', () => {
    const [west, south, east, north] = tileBbox(10, 366, 601);
    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
    expect(west).toBeLessThan(-51.2177);
    expect(east).toBeGreaterThan(-51.2177);
    expect(south).toBeLessThan(-30.0346);
    expect(north).toBeGreaterThan(-30.0346);
  });
});

describe('collectTilesForRoutes', () => {
  it('covers densified segments and includes a neighbor ring', () => {
    const routes = [
      {
        geometry: {
          type: 'LineString',
          coordinates: [
            [-51.22, -30.03],
            [-51.2, -30.05],
          ] as [number, number][],
        },
      },
    ];

    const tiles = collectTilesForRoutes(routes, 12);
    expect(tiles.length).toBeGreaterThan(1);
    // Neighbor ring means at least a 3x3 block around each hit.
    expect(tiles.length).toBeGreaterThanOrEqual(9);
    tiles.forEach((t) => expect(t.z).toBe(12));
  });
});

describe('chooseZoomForRoutes', () => {
  it('drops zoom when the corridor would exceed the tile cap', () => {
    // Long east-west line across Brazil at high zoom → many tiles.
    const routes = [
      {
        geometry: {
          type: 'LineString',
          coordinates: [
            [-60, -15],
            [-40, -15],
          ] as [number, number][],
        },
      },
    ];

    const { zoom, tiles } = chooseZoomForRoutes(routes, 14);
    expect(zoom).toBeLessThan(14);
    expect(tiles.length).toBeLessThanOrEqual(150);
  });
});
