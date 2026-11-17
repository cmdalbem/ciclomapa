import { BRouterDirectionsProvider } from './directionsService.js';

jest.mock('./dev/apiTracker.js', () => ({
  API_TYPES: { BROUTER: 'brouter' },
  trackCall: jest.fn(),
}));

function geojsonRoute(coords) {
  return {
    features: [
      {
        geometry: { coordinates: coords.map((c) => [...c, 10]) },
        properties: { 'track-length': 1000, 'total-time': 120, 'filtered ascend': 8 },
      },
    ],
  };
}

function jsonResponse(body) {
  return Promise.resolve({
    ok: true,
    json: async () => body,
  });
}

describe('BRouterDirectionsProvider', () => {
  const origFetch = global.fetch;

  afterEach(() => {
    global.fetch = origFetch;
  });

  it('keeps successful alternatives when another fetch rejects', async () => {
    global.fetch = jest.fn((url) => {
      if (String(url).includes('alternativeidx=1')) {
        return Promise.reject(new Error('network down'));
      }
      return jsonResponse(
        geojsonRoute([
          [0, 0],
          [0.01, 0],
        ])
      );
    });

    const provider = new BRouterDirectionsProvider({ baseUrl: 'https://brouter.test' });
    const result = await provider.getDirections([0, 0], [0.01, 0]);
    expect(result.routes.length).toBeGreaterThan(0);
  });

  it('still throws when the request is aborted', async () => {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    global.fetch = jest.fn(() => Promise.reject(err));

    const provider = new BRouterDirectionsProvider({ baseUrl: 'https://brouter.test' });
    await expect(provider.getDirections([0, 0], [0.01, 0])).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('bboxes only the routes that were kept', async () => {
    global.fetch = jest.fn((url) => {
      const idx = Number(new URL(url).searchParams.get('alternativeidx'));
      if (idx === 0) {
        return jsonResponse(
          geojsonRoute([
            [0, 0],
            [0.01, 0],
          ])
        );
      }
      if (idx === 1) {
        return jsonResponse(
          geojsonRoute([
            [0, 0],
            [0.01, 0],
            [10, 10],
          ])
        );
      }
      return Promise.resolve({ ok: false, json: async () => ({}) });
    });

    const provider = new BRouterDirectionsProvider({ baseUrl: 'https://brouter.test' });
    const result = await provider.getDirections([0, 0], [0.01, 0]);
    expect(result.routes).toHaveLength(1);
    expect(result.bbox[2]).toBeLessThan(1);
    expect(result.bbox[3]).toBeLessThan(1);
  });
});
