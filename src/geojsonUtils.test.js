import {
  angleBetweenPoints,
  angleToEmojiDirection,
  calculateLayersLengths,
  computeTypologies,
} from './utils/geojsonUtils.js';
import {
  getLayersDefinition,
  layersVersionDiffMapboxFilter,
  resolveLayersVersion,
} from './config/layersCatalog.js';
import {
  DEFAULT_PARALLEL_DEDUPE_ENGINE,
  resolveParallelDedupeEngineId,
} from './utils/parallelDedupeEngines/engineTypes.js';

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

const typologyLayers = [
  {
    name: 'Ciclovia',
    filters: [['highway', 'cycleway']],
    except: [['segregated', 'no']],
  },
  {
    name: 'Calçada compartilhada',
    filters: [
      [
        ['highway', 'cycleway'],
        ['segregated', 'no'],
      ],
    ],
  },
];

function featureWith(properties) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties,
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
}

describe('computeTypologies shared cycleways', () => {
  it('treats highway=cycleway + segregated=no as calçada', () => {
    const data = featureWith({ highway: 'cycleway', segregated: 'no' });
    computeTypologies(data, typologyLayers);
    expect(data.features[0].properties.type).toBe('Calçada compartilhada');
  });

  it('keeps a normal highway=cycleway as ciclovia', () => {
    const data = featureWith({ highway: 'cycleway' });
    computeTypologies(data, typologyLayers);
    expect(data.features[0].properties.type).toBe('Ciclovia');
  });

  it('does not reclassify cycleway=shared or foot=designated without segregated=no', () => {
    const shared = featureWith({ highway: 'cycleway', cycleway: 'shared' });
    computeTypologies(shared, typologyLayers);
    expect(shared.features[0].properties.type).toBe('Ciclovia');

    const foot = featureWith({ highway: 'cycleway', foot: 'designated' });
    computeTypologies(foot, typologyLayers);
    expect(foot.features[0].properties.type).toBe('Ciclovia');

    const split = featureWith({ highway: 'cycleway', foot: 'designated', segregated: 'yes' });
    computeTypologies(split, typologyLayers);
    expect(split.features[0].properties.type).toBe('Ciclovia');
  });

  it('reclassifies a feature that already has a CicloMapa type', () => {
    const data = featureWith({
      highway: 'cycleway',
      segregated: 'no',
      type: 'Ciclovia',
    });
    computeTypologies(data, typologyLayers);
    expect(data.features[0].properties.type).toBe('Calçada compartilhada');
  });
});

function catalogWayLayers(version) {
  return getLayersDefinition(version).filter((l) => l.filters && !l.onlyDebug && l.type !== 'poi');
}

describe('layers catalog v2 tagging', () => {
  const v2 = catalogWayLayers('v2');
  const v1 = catalogWayLayers('v1');

  it('does not treat a compound filter as a match on the first tag alone', () => {
    const footway = featureWith({ highway: 'footway' });
    computeTypologies(footway, v2);
    expect(footway.features[0].properties.type).toBeUndefined();
  });

  it('classifies designated paths as calçada, segregated paths as ciclovia, and leftover paths as trilha', () => {
    const designated = featureWith({ highway: 'path', bicycle: 'designated' });
    computeTypologies(designated, v2);
    expect(designated.features[0].properties.type).toBe('Calçada compartilhada');

    const split = featureWith({ highway: 'path', bicycle: 'designated', segregated: 'yes' });
    computeTypologies(split, v2);
    expect(split.features[0].properties.type).toBe('Ciclovia');

    const trail = featureWith({ highway: 'path', bicycle: 'yes' });
    computeTypologies(trail, v2);
    expect(trail.features[0].properties.type).toBe('Trilha');
  });

  it('reads cycleway:both=* spellings that v1 missed', () => {
    const track = featureWith({ 'cycleway:both': 'track' });
    computeTypologies(track, v2);
    expect(track.features[0].properties.type).toBe('Ciclovia');

    const shared = featureWith({ 'cycleway:both': 'shared_lane' });
    computeTypologies(shared, v2);
    expect(shared.features[0].properties.type).toBe('Ciclorrota');

    const sidepath = featureWith({ 'cycleway:both': 'sidepath' });
    computeTypologies(sidepath, v2);
    expect(sidepath.features[0].properties.type).toBe('Calçada compartilhada');

    const v1Shared = featureWith({ 'cycleway:both': 'shared_lane' });
    computeTypologies(v1Shared, v1);
    expect(v1Shared.features[0].properties.type).toBeUndefined();
  });

  it('treats buffered_lane as ciclofaixa in v2 and ciclorrota in v1', () => {
    const buffered = featureWith({ cycleway: 'buffered_lane' });
    computeTypologies(buffered, v2);
    expect(buffered.features[0].properties.type).toBe('Ciclofaixa');

    const v1Buffered = featureWith({ cycleway: 'buffered_lane' });
    computeTypologies(v1Buffered, v1);
    expect(v1Buffered.features[0].properties.type).toBe('Ciclorrota');
  });

  it('keeps highway=path + bicycle=designated as trilha in v1', () => {
    const designated = featureWith({ highway: 'path', bicycle: 'designated' });
    computeTypologies(designated, v1);
    expect(designated.features[0].properties.type).toBe('Trilha');
  });
});

function evalMapboxExpr(expr, props) {
  if (!Array.isArray(expr)) return expr;
  const op = expr[0];
  if (op === 'get') return props[expr[1]] ?? null;
  if (op === '==') return evalMapboxExpr(expr[1], props) === evalMapboxExpr(expr[2], props);
  if (op === '!=') return evalMapboxExpr(expr[1], props) !== evalMapboxExpr(expr[2], props);
  if (op === 'any') return expr.slice(1).some((e) => evalMapboxExpr(e, props));
  if (op === 'all') return expr.slice(1).every((e) => evalMapboxExpr(e, props));
  if (op === 'case') {
    for (let i = 1; i < expr.length - 1; i += 2) {
      if (evalMapboxExpr(expr[i], props)) return evalMapboxExpr(expr[i + 1], props);
    }
    return evalMapboxExpr(expr[expr.length - 1], props);
  }
  throw new Error(`unsupported mapbox op ${op}`);
}

function typologyName(tags, version) {
  const data = featureWith(tags);
  computeTypologies(data, catalogWayLayers(version));
  return data.features[0].properties.type || '';
}

describe('layers v1/v2 debug diff filter', () => {
  const diffFilter = layersVersionDiffMapboxFilter();

  it('is a != of the two typology case expressions', () => {
    expect(diffFilter[0]).toBe('!=');
    expect(diffFilter[1][0]).toBe('case');
    expect(diffFilter[2][0]).toBe('case');
  });

  it.each([
    [{ highway: 'cycleway' }, false],
    [{ highway: 'cycleway', segregated: 'no' }, true],
    [{ highway: 'path', bicycle: 'designated' }, true],
    [{ 'cycleway:both': 'shared_lane' }, true],
    [{ cycleway: 'buffered_lane' }, true],
    [{ highway: 'footway' }, false],
    [{ highway: 'path', bicycle: 'yes' }, false],
    [{ highway: 'cycleway', segregated: 'no', bicycle: 'no' }, false],
  ])('flags %# when v1 and v2 disagree', (tags, shouldDiff) => {
    expect(evalMapboxExpr(diffFilter, tags)).toBe(shouldDiff);
    expect(typologyName(tags, 'v1') !== typologyName(tags, 'v2')).toBe(shouldDiff);
  });
});

describe('layers catalog version ids', () => {
  it('rejects inherited Object properties as version ids', () => {
    expect(resolveLayersVersion('toString')).toBe('v2');
    expect(resolveLayersVersion('v1')).toBe('v1');
    expect(resolveLayersVersion('nope')).toBe('v2');
  });
});

describe('computeTypologies mapper overlays', () => {
  it('does not let leftover pairing tags steal a counted typology', () => {
    const data = featureWith({
      highway: 'cycleway',
      type: 'Ciclovia',
      'ciclomapa:paired': 'false',
    });
    computeTypologies(data, getLayersDefinition('v2'));
    expect(data.features[0].properties.type).toBe('Ciclovia');
  });
});

describe('parallel dedupe engine ids', () => {
  it('falls unknown ids back to the default engine', () => {
    expect(resolveParallelDedupeEngineId('nope')).toBe(DEFAULT_PARALLEL_DEDUPE_ENGINE);
    expect(resolveParallelDedupeEngineId('topology_first')).toBe('topology_first');
  });
});
