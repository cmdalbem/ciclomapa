import {
  angleBetweenPoints,
  angleToEmojiDirection,
  calculateLayersLengths,
} from './utils/geojsonUtils.js';

jest.mock('./config/constants.js', () => ({
  ...jest.requireActual('./config/constants.js'),
  IS_MOBILE: true,
}));

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
