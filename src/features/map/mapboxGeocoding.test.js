const mockSend = jest.fn();
const mockReverseGeocode = jest.fn(() => ({ send: mockSend }));

jest.mock('@mapbox/mapbox-sdk/services/geocoding', () =>
  jest.fn(() => ({ reverseGeocode: mockReverseGeocode }))
);

const {
  reverseGeocodePlace,
  getViewportSamplePoints,
  guessPlaceFromViewport,
  VIEWPORT_SAMPLE_RADIUS,
} = require('./mapboxGeocoding.js');

const feature = (place_name, bbox = [0, 0, 1, 1]) => ({
  body: { features: [{ place_name, bbox }] },
});

// LngLatBounds-like object for a viewport 0.2° wide and 0.1° tall around the center.
const bounds = (center) => ({
  getWest: () => center.lng - 0.1,
  getEast: () => center.lng + 0.1,
  getSouth: () => center.lat - 0.05,
  getNorth: () => center.lat + 0.05,
});

beforeEach(() => {
  // CRA runs Jest with resetMocks: true, so implementations must be (re)set here.
  mockReverseGeocode.mockImplementation(() => ({ send: mockSend }));
  jest.spyOn(console, 'debug').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('reverseGeocodePlace', () => {
  it('accepts {lng,lat} and [lng,lat], asks Mapbox for a single pt-br place', async () => {
    mockSend.mockResolvedValue(feature('Porto Alegre, RS, Brasil', [1, 2, 3, 4]));
    const a = await reverseGeocodePlace({ lng: -51.2, lat: -30.0 });
    expect(a).toEqual({ place_name: 'Porto Alegre, RS, Brasil', bbox: [1, 2, 3, 4] });
    expect(mockReverseGeocode).toHaveBeenCalledWith({
      query: [-51.2, -30.0],
      types: ['place'],
      limit: 1,
      language: ['pt-br'],
    });

    await reverseGeocodePlace([-51.2, -30.0]);
    expect(mockReverseGeocode).toHaveBeenLastCalledWith(
      expect.objectContaining({ query: [-51.2, -30.0] })
    );
  });

  it('rejects invalid coordinates before calling Mapbox', async () => {
    await expect(reverseGeocodePlace(null)).rejects.toThrow('Invalid coordinates');
    await expect(reverseGeocodePlace([undefined, 1])).rejects.toThrow('Invalid coordinates');
    await expect(reverseGeocodePlace({ lng: 1 })).rejects.toThrow('Invalid coordinates');
    expect(mockReverseGeocode).not.toHaveBeenCalled();
  });

  it('throws when Mapbox has no features', async () => {
    mockSend.mockResolvedValue({ body: { features: [] } });
    await expect(reverseGeocodePlace([0, 0])).rejects.toThrow('No geocoding results found');
  });
});

describe('getViewportSamplePoints', () => {
  const center = { lng: -51.27, lat: -30.06 };

  it('returns only the center without bounds', () => {
    expect(getViewportSamplePoints(center)).toEqual([center]);
    expect(getViewportSamplePoints(center, {})).toEqual([center]);
  });

  it('returns center + four corner offsets at VIEWPORT_SAMPLE_RADIUS of the viewport span', () => {
    const pts = getViewportSamplePoints(center, bounds(center));
    expect(pts).toHaveLength(5);
    expect(pts[0]).toBe(center);
    const dx = +(0.2 * VIEWPORT_SAMPLE_RADIUS).toFixed(6);
    const dy = +(0.1 * VIEWPORT_SAMPLE_RADIUS).toFixed(6);
    const rel = pts
      .slice(1)
      .map((p) => [+(p.lng - center.lng).toFixed(6), +(p.lat - center.lat).toFixed(6)]);
    expect(rel).toEqual([
      [-dx, dy], // NW
      [dx, dy], // NE
      [-dx, -dy], // SW
      [dx, -dy], // SE
    ]);
  });
});

describe('guessPlaceFromViewport', () => {
  const center = { lng: -51.27, lat: -30.06 };

  // Real answers for the Porto Alegre viewport with the Guaíba in the middle.
  const guaibaAnswers = [
    'Lagoa dos Patos, Rio Grande do Sul, Brasil', // center
    'Eldorado do Sul, Rio Grande do Sul, Brasil', // NW
    'Porto Alegre, Rio Grande do Sul, Brasil', // NE
    'Guaíba, Rio Grande do Sul, Brasil', // SW
    'Porto Alegre, Rio Grande do Sul, Brasil', // SE
  ];

  const answerInOrder = (answers) => {
    let i = 0;
    mockSend.mockImplementation(() => {
      const a = answers[i++];
      return a instanceof Error ? Promise.reject(a) : Promise.resolve(feature(a));
    });
  };

  it('picks the majority even when the center lands on a lake', async () => {
    answerInOrder(guaibaAnswers);
    const res = await guessPlaceFromViewport(center, bounds(center));
    expect(res).toEqual({ place_name: 'Porto Alegre, Rio Grande do Sul, Brasil' });
    expect(mockReverseGeocode).toHaveBeenCalledTimes(5);
    expect(console.debug).toHaveBeenCalledWith(
      '[viewport-city] samples disagree:',
      expect.any(Object),
      '->',
      'Porto Alegre, Rio Grande do Sul, Brasil'
    );
  });

  it('breaks a tie towards the current area', async () => {
    answerInOrder(['Lake', 'A', 'B', 'A', 'B']);
    await expect(
      guessPlaceFromViewport(center, bounds(center), { currentArea: 'B' })
    ).resolves.toEqual({
      place_name: 'B',
    });
  });

  it('breaks a tie towards the center sample when the current area is not a candidate', async () => {
    answerInOrder(['Lake', 'A', 'B', 'A', 'B']);
    await expect(
      guessPlaceFromViewport(center, bounds(center), { currentArea: 'Elsewhere' })
    ).resolves.toEqual({
      place_name: 'A',
    });
    answerInOrder(['Lake', 'A', 'B', 'A', 'B']);
    await expect(guessPlaceFromViewport(center, bounds(center))).resolves.toEqual({
      place_name: 'A',
    });
  });

  it('does not let the current area override a real majority', async () => {
    answerInOrder(['A', 'A', 'A', 'B', 'B']);
    await expect(
      guessPlaceFromViewport(center, bounds(center), { currentArea: 'B' })
    ).resolves.toEqual({
      place_name: 'A',
    });
  });

  it('ignores failed samples and stays quiet when all agree', async () => {
    answerInOrder(['A', new Error('nope'), 'A', new Error('nope'), 'A']);
    await expect(guessPlaceFromViewport(center, bounds(center))).resolves.toEqual({
      place_name: 'A',
    });
    expect(console.debug).not.toHaveBeenCalledWith(
      '[viewport-city] samples disagree:',
      expect.anything(),
      '->',
      expect.anything()
    );
  });

  it('only geocodes the center without bounds', async () => {
    answerInOrder(['Only']);
    await expect(guessPlaceFromViewport(center)).resolves.toEqual({ place_name: 'Only' });
    expect(mockReverseGeocode).toHaveBeenCalledTimes(1);
  });

  it('throws when every sample fails', async () => {
    mockSend.mockRejectedValue(new Error('down'));
    await expect(guessPlaceFromViewport(center, bounds(center))).rejects.toThrow(
      'No geocoding results found for any viewport sample'
    );
  });
});
