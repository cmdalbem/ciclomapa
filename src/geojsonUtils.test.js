import {
  angleBetweenPoints,
  angleToEmojiDirection,
  calculateCyclepathCoverage,
  calculateCyclepathCoverageByOverlap,
  calculateCyclepathCoverageFromPathDetails,
  calculateCyclepathCoverageFromBrouterMessages,
  calculateLayersLengths,
  COVERAGE_MAX_LATERAL_KM,
} from './utils/geojsonUtils.js';

jest.mock('./config/constants.js', () => ({
  ...jest.requireActual('./config/constants.js'),
  IS_MOBILE: true,
}));

const COVERAGE_LAYERS = [
  { id: 'ciclovia', name: 'Ciclovia' },
  { id: 'ciclofaixa', name: 'Ciclofaixa' },
];

/** ~meters → degrees of latitude (good enough near the equator for unit tests). */
function metersToLatDeg(m) {
  return m / 111_320;
}

describe('angleBetweenPoints', () => {
  it('returns angle in degrees between two points', () => {
    const p1 = [0, 0];
    const p2 = [1, 0];
    expect(angleBetweenPoints(p1, p2)).toBe(0);
  });
});

describe('angleToEmojiDirection', () => {
  it('returns right arrow for small positive angle', () => {
    expect(angleToEmojiDirection(10)).toBe('➡️');
  });
  it('returns up arrow for ~90 degrees', () => {
    expect(angleToEmojiDirection(90)).toBe('⬆️');
  });
});

describe('calculateLayersLengths on mobile', () => {
  it('classifies typologies but skips length math', () => {
    const geoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { id: 1, highway: 'cycleway', cycleway: 'track' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, 0],
              [0.01, 0],
            ],
          },
        },
      ],
    };
    const layers = [
      {
        id: 'ciclovia',
        name: 'Ciclovia',
        type: 'way',
        filters: [
          ['highway', 'cycleway'],
          ['cycleway', 'track'],
        ],
      },
    ];

    const lengths = calculateLayersLengths(geoJson, layers, 'average');

    expect(lengths).toEqual({});
    expect(geoJson.features[0].properties.type).toBe('Ciclovia');
  });
});

describe('calculateCyclepathCoverage (nearest-only)', () => {
  it('counts parallel dual lanes once, picking the nearer side', () => {
    // Route along equator ~1.1 km. Two parallel ciclovias at ~4 m and ~9 m north.
    const route = {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [0.01, 0],
      ],
    };
    const nearOffset = metersToLatDeg(4);
    const farOffset = metersToLatDeg(9);
    const geoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { type: 'Ciclovia', name: 'near' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, nearOffset],
              [0.01, nearOffset],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { type: 'Ciclovia', name: 'far' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, farOffset],
              [0.01, farOffset],
            ],
          },
        },
      ],
    };

    const result = calculateCyclepathCoverage(route, geoJson, COVERAGE_LAYERS);

    expect(result.coverage).toBeGreaterThan(95);
    expect(result.coverage).toBeLessThanOrEqual(100);
    expect(result.coverageByType.Ciclovia).toBeGreaterThan(95);
    // Debug segments should only attribute the nearer feature
    const names = new Set(
      result.overlappingCyclepaths.map((s) => s.properties.debug_cyclepath_name)
    );
    expect(names.has('near')).toBe(true);
    expect(names.has('far')).toBe(false);
  });

  it('ignores a nearby cyclepath with a perpendicular heading', () => {
    const route = {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [0.01, 0],
      ],
    };
    const offset = metersToLatDeg(5);
    const geoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { type: 'Ciclovia', name: 'cross' },
          geometry: {
            type: 'LineString',
            // Vertical line crossing the route corridor
            coordinates: [
              [0.005, offset - metersToLatDeg(20)],
              [0.005, offset + metersToLatDeg(20)],
            ],
          },
        },
      ],
    };

    const result = calculateCyclepathCoverage(route, geoJson, COVERAGE_LAYERS);

    expect(result.coverage).toBeLessThan(15);
  });

  it('rejects cyclepaths beyond the lateral radius', () => {
    const route = {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [0.01, 0],
      ],
    };
    const offset = metersToLatDeg(COVERAGE_MAX_LATERAL_KM * 1000 + 5);
    const geoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { type: 'Ciclovia', name: 'too-far' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, offset],
              [0.01, offset],
            ],
          },
        },
      ],
    };

    const result = calculateCyclepathCoverage(route, geoJson, COVERAGE_LAYERS);
    expect(result.coverage).toBe(0);
  });
});

describe('calculateCyclepathCoverageByOverlap (original)', () => {
  it('with ~1 m tolerance misses laterally offset lanes that nearest still catches', () => {
    const route = {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [0.01, 0],
      ],
    };
    const offset = metersToLatDeg(4);
    const geoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { type: 'Ciclovia', name: 'offset' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, offset],
              [0.01, offset],
            ],
          },
        },
      ],
    };

    const nearest = calculateCyclepathCoverage(route, geoJson, COVERAGE_LAYERS);
    const overlap = calculateCyclepathCoverageByOverlap(route, geoJson, COVERAGE_LAYERS);

    expect(nearest.coverage).toBeGreaterThan(95);
    expect(overlap.coverage).toBeLessThan(5);
  });

  it('under a wide tolerance, overlap segments include both parallel lanes', () => {
    const route = {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [0.01, 0],
      ],
    };
    const nearOffset = metersToLatDeg(4);
    const farOffset = metersToLatDeg(9);
    const geoJson = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { type: 'Ciclovia', name: 'near' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, nearOffset],
              [0.01, nearOffset],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { type: 'Ciclovia', name: 'far' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [0, farOffset],
              [0.01, farOffset],
            ],
          },
        },
      ],
    };

    const overlap = calculateCyclepathCoverageByOverlap(route, geoJson, COVERAGE_LAYERS, {
      tolerance: 0.02,
    });
    const names = new Set(
      overlap.overlappingCyclepaths.map((s) => s.properties.debug_cyclepath_name)
    );
    expect(names.has('near')).toBe(true);
    expect(names.has('far')).toBe(true);
  });
});

describe('calculateCyclepathCoverageFromPathDetails', () => {
  it('counts cycleway intervals as Ciclovia without snapping', () => {
    const route = {
      type: 'LineString',
      coordinates: [
        [0, 0],
        [0.005, 0],
        [0.01, 0],
      ],
    };
    const pathDetails = {
      road_class: [
        [0, 1, 'residential'],
        [1, 2, 'cycleway'],
      ],
      bike_network: [[0, 2, 'missing']],
    };

    const result = calculateCyclepathCoverageFromPathDetails(route, pathDetails, COVERAGE_LAYERS);
    expect(result.coverage).toBeGreaterThan(40);
    expect(result.coverage).toBeLessThan(60);
    expect(result.coverageByType.Ciclovia).toBeGreaterThan(40);
  });
});

describe('calculateCyclepathCoverageFromBrouterMessages', () => {
  it('classifies cycleway:left=lane as Ciclofaixa using layers.json rules', () => {
    const layers = [
      { id: 'ciclovia', name: 'Ciclovia', filters: [['highway', 'cycleway']] },
      {
        id: 'ciclofaixa',
        name: 'Ciclofaixa',
        filters: [
          ['cycleway', 'lane'],
          ['cycleway:left', 'lane'],
        ],
      },
    ];
    const messages = [
      ['Longitude', 'Latitude', 'Elevation', 'Distance', 'WayTags'],
      ['-46600000', '-23500000', '0', '500', 'highway=primary cycleway:left=lane'],
      ['-46601000', '-23500000', '0', '500', 'highway=residential'],
    ];
    // Dense route geometry with a bend; highlight must follow it, not chord the messages.
    const routeGeometry = {
      type: 'LineString',
      coordinates: [
        [-46.6, -23.5],
        [-46.598, -23.5],
        [-46.596, -23.501],
        [-46.594, -23.501],
        [-46.592, -23.5],
        [-46.59, -23.5],
      ],
    };
    const result = calculateCyclepathCoverageFromBrouterMessages(messages, layers, routeGeometry);
    expect(result.coverage).toBeGreaterThan(45);
    expect(result.coverage).toBeLessThan(55);
    expect(result.coverageByType.Ciclofaixa).toBeGreaterThan(45);
    expect(result.overlappingCyclepaths.length).toBeGreaterThan(0);
    const highlight = result.overlappingCyclepaths[0].geometry.coordinates;
    expect(highlight.length).toBeGreaterThan(2);
    expect(result.routePaintSegments.length).toBeGreaterThan(result.overlappingCyclepaths.length);
    expect(
      result.routePaintSegments.some((f) => f.properties.debug_cyclepath_type === 'street')
    ).toBe(true);
  });
});
