import {
  applyDualMappedCycleways,
  applyOppositeOnewayLanes,
  applyOverlappingDedicatedCycleways,
} from './dual_mapped.js';
import { calculateLayersLengths } from '../geojsonUtils.js';

function feat(id, props, coordinates) {
  return {
    type: 'Feature',
    properties: { id, ...props },
    geometry: { type: 'LineString', coordinates },
  };
}

function byId(segments) {
  return Object.fromEntries(segments.map((s) => [s.properties.id, s]));
}

// ~10m north of a Curitiba-ish longitude
const OFFSET = 0.00009;

function parallelPair(roadId, cyclewayId, roadProps, startLng, startLat, n = 8) {
  const road = [];
  const cycleway = [];
  for (let i = 0; i < n; i++) {
    const lng = startLng + i * 0.001;
    const lat = startLat;
    road.push([lng, lat]);
    cycleway.push([lng, lat + OFFSET]);
  }
  return [
    feat(roadId, { highway: 'primary', ...roadProps }, road),
    feat(
      cyclewayId,
      {
        highway: 'cycleway',
        oneway: 'no',
        bicycle: 'designated',
        foot: 'designated',
        segregated: 'no',
      },
      cycleway
    ),
  ];
}

describe('applyDualMappedCycleways', () => {
  it('pairs a oneway street with cycleway:right=track next to a two-way cycleway', () => {
    const segments = parallelPair(
      'way/524286135',
      'way/1558199051',
      {
        name: 'Rua João Bettega',
        oneway: 'yes',
        'oneway:bicycle': 'no',
        'cycleway:right': 'track',
      },
      -49.32,
      -25.49
    );

    applyDualMappedCycleways(segments);
    const got = byId(segments);
    expect(got['way/524286135'].properties['ciclomapa:paired']).toBe('dual');
    expect(got['way/524286135'].properties['ciclomapa:pair_kind']).toBe('dual_mapped');
    expect(got['way/524286135'].properties['ciclomapa:duplicate_candidate']).toBe('true');
    expect(got['way/524286135'].properties['ciclomapa:side']).toBe('b');
    expect(got['way/1558199051'].properties['ciclomapa:paired']).toBe('dual');
    expect(got['way/1558199051'].properties['ciclomapa:side']).toBe('a');
    expect(got['way/1558199051'].properties['ciclomapa:duplicate_candidate']).toBeUndefined();
  });

  it('pairs a two-way street with cycleway:left=track (Fredolin Wolf style)', () => {
    const segments = parallelPair(
      'way/315883613',
      'way/1339909945',
      {
        name: 'Avenida Fredolin Wolf',
        oneway: 'no',
        'cycleway:left': 'track',
        highway: 'secondary',
      },
      -49.33,
      -25.38
    );

    applyDualMappedCycleways(segments);
    const got = byId(segments);
    expect(got['way/315883613'].properties['ciclomapa:pair_kind']).toBe('dual_mapped');
    expect(got['way/1339909945'].properties['ciclomapa:pair_kind']).toBe('dual_mapped');
  });

  it('pairs a ciclofaixa-tagged street next to a dedicated cycleway', () => {
    const segments = parallelPair(
      'way/406586021',
      'way/1167859350',
      {
        name: 'Rua Eduardo Pinto da Rocha',
        highway: 'secondary',
        'cycleway:left': 'lane',
        'oneway:bicycle': 'no',
      },
      -49.26,
      -25.56
    );

    applyDualMappedCycleways(segments);
    const got = byId(segments);
    expect(got['way/406586021'].properties['ciclomapa:pair_kind']).toBe('dual_mapped');
    expect(got['way/1167859350'].properties['ciclomapa:pair_kind']).toBe('dual_mapped');
    expect(got['way/406586021'].properties['ciclomapa:duplicate_candidate']).toBe('true');
    expect(got['way/1167859350'].properties['ciclomapa:duplicate_candidate']).toBeUndefined();
  });

  it('pairs a busway with cycleway:right=track even without oneway', () => {
    const segments = parallelPair(
      'way/631357225',
      'way/1558192448',
      {
        name: 'Rua Sander Roberto da Cunha',
        highway: 'busway',
        'cycleway:right': 'track',
      },
      -49.29,
      -25.51
    );

    applyDualMappedCycleways(segments);
    expect(byId(segments)['way/631357225'].properties['ciclomapa:pair_kind']).toBe('dual_mapped');
  });

  it('still pairs a short road stub against a much longer cycleway', () => {
    const road = feat(
      'way/524286135',
      {
        highway: 'primary',
        name: 'Rua João Bettega',
        oneway: 'yes',
        'oneway:bicycle': 'no',
        'cycleway:right': 'track',
      },
      [
        [-49.321913, -25.4907163],
        [-49.321694, -25.4904147],
        [-49.3209327, -25.4893659],
      ]
    );
    const cycleway = feat('way/1558199051', { highway: 'cycleway', oneway: 'no' }, [
      [-49.3219445, -25.4908532],
      [-49.3216456, -25.4904397],
      [-49.3203772, -25.488685],
      [-49.3201026, -25.4883052],
      [-49.3199416, -25.4880846],
      [-49.3195062, -25.487488],
      [-49.3180466, -25.4853642],
      [-49.3160464, -25.4821589],
      [-49.3115954, -25.478151],
      [-49.2969112, -25.4750803],
    ]);

    applyDualMappedCycleways([road, cycleway]);
    expect(road.properties['ciclomapa:pair_kind']).toBe('dual_mapped');
    expect(cycleway.properties['ciclomapa:pair_kind']).toBe('dual_mapped');
    expect(cycleway.properties['ciclomapa:duplicate_candidate']).toBeUndefined();
  });

  it('still pairs when the tagged road continues past the cycleway', () => {
    const road = feat(
      'way/406586021',
      { highway: 'secondary', 'cycleway:left': 'lane' },
      Array.from({ length: 16 }, (_, i) => [-49.26 + i * 0.001, -25.56])
    );
    const cycleway = feat(
      'way/1167859350',
      { highway: 'cycleway', oneway: 'no' },
      Array.from({ length: 8 }, (_, i) => [-49.26 + i * 0.001, -25.56 + OFFSET])
    );

    applyDualMappedCycleways([road, cycleway]);
    expect(road.properties['ciclomapa:pair_kind']).toBe('dual_mapped');
    expect(cycleway.properties['ciclomapa:pair_kind']).toBe('dual_mapped');
  });

  it('does not pair shared_lane sharrows next to a cycleway', () => {
    const segments = parallelPair(
      'way/road',
      'way/cw',
      {
        highway: 'residential',
        cycleway: 'shared_lane',
      },
      -49.26,
      -25.56
    );
    applyDualMappedCycleways(segments);
    expect(segments[0].properties['ciclomapa:pair_kind']).toBeUndefined();
  });

  it('does not pair perpendicular ways', () => {
    const road = feat('way/road', { highway: 'primary', 'cycleway:right': 'track' }, [
      [-49.32, -25.49],
      [-49.31, -25.49],
    ]);
    const cycleway = feat('way/cw', { highway: 'cycleway' }, [
      [-49.315, -25.495],
      [-49.315, -25.485],
    ]);

    applyDualMappedCycleways([road, cycleway]);
    expect(road.properties['ciclomapa:paired']).toBeUndefined();
  });

  it('leaves already-paired Fortaleza segments alone', () => {
    const [road, cycleway] = parallelPair(
      'way/road',
      'way/cw',
      {
        'cycleway:right': 'track',
        oneway: 'yes',
      },
      -49.32,
      -25.49
    );
    road.properties['ciclomapa:duplicate_candidate'] = 'true';
    road.properties['ciclomapa:paired'] = 'true';
    road.properties['ciclomapa:side'] = 'a';

    applyDualMappedCycleways([road, cycleway]);
    expect(road.properties['ciclomapa:pair_kind']).toBeUndefined();
    expect(cycleway.properties['ciclomapa:paired']).toBeUndefined();
  });
});

describe('calculateLayersLengths dual-maps across ciclovia and ciclofaixa', () => {
  const countedLayers = [
    {
      id: 'ciclovia',
      name: 'Ciclovia',
      type: 'way',
      filters: [['highway', 'cycleway']],
    },
    {
      id: 'ciclofaixa',
      name: 'Ciclofaixa',
      type: 'way',
      filters: [['cycleway:left', 'lane']],
    },
  ];

  it('marks a lane-tagged road and a neighboring highway=cycleway', () => {
    const [road, cycleway] = parallelPair(
      'way/406586021',
      'way/1167859350',
      {
        name: 'Rua Eduardo Pinto da Rocha',
        highway: 'secondary',
        'cycleway:left': 'lane',
      },
      -49.26,
      -25.56
    );
    const geoJson = { type: 'FeatureCollection', features: [road, cycleway] };

    calculateLayersLengths(geoJson, countedLayers, 'pessimistic', 'topology_first');

    expect(road.properties.type).toBe('Ciclofaixa');
    expect(cycleway.properties.type).toBe('Ciclovia');
    expect(road.properties['ciclomapa:pair_kind']).toBe('dual_mapped');
    expect(cycleway.properties['ciclomapa:pair_kind']).toBe('dual_mapped');
    expect(road.properties['ciclomapa:duplicate_candidate']).toBe('true');
    expect(cycleway.properties['ciclomapa:duplicate_candidate']).toBeUndefined();
  });
});

function parallelCycleways(idA, idB, startLng, startLat, nA, nB, latOffset, reverseB = false) {
  const a = [];
  const b = [];
  for (let i = 0; i < nA; i++) a.push([startLng + i * 0.001, startLat]);
  for (let i = 0; i < nB; i++) b.push([startLng + i * 0.001, startLat + latOffset]);
  if (reverseB) b.reverse();
  return [
    feat(idA, { highway: 'cycleway' }, a),
    feat(
      idB,
      {
        highway: 'cycleway',
        oneway: 'no',
        bicycle: 'designated',
        foot: 'designated',
      },
      b
    ),
  ];
}

describe('applyOverlappingDedicatedCycleways', () => {
  // ~30m at Brasília latitude. Dual-map's 25m shadow misses this class.
  const OFFSET_30M = 0.00028;

  it('drops the shorter of two parallel highway=cycleway (EPDB redraw)', () => {
    const segments = parallelCycleways(
      'way/915582633',
      'way/1521453775',
      -47.83,
      -15.84,
      20,
      12,
      OFFSET_30M
    );
    applyOverlappingDedicatedCycleways(segments);
    const got = byId(segments);
    expect(got['way/1521453775'].properties['ciclomapa:pair_kind']).toBe('overlapping_cycleway');
    expect(got['way/1521453775'].properties['ciclomapa:duplicate_candidate']).toBe('true');
    expect(got['way/915582633'].properties['ciclomapa:pair_kind']).toBe('overlapping_cycleway');
    expect(got['way/915582633'].properties['ciclomapa:duplicate_candidate']).toBeUndefined();
  });

  it('marks both short overlays of a longer cycleway', () => {
    const [longWay, first] = parallelCycleways(
      'way/915582633',
      'way/1521453775',
      -47.83,
      -15.84,
      24,
      10,
      OFFSET_30M
    );
    const second = feat(
      'way/1537798522',
      { highway: 'cycleway', oneway: 'no' },
      Array.from({ length: 8 }, (_, i) => [-47.83 + (14 + i) * 0.001, -15.84 + OFFSET_30M])
    );
    const segments = [longWay, first, second];
    applyOverlappingDedicatedCycleways(segments);
    const got = byId(segments);
    expect(got['way/1521453775'].properties['ciclomapa:duplicate_candidate']).toBe('true');
    expect(got['way/1537798522'].properties['ciclomapa:duplicate_candidate']).toBe('true');
    expect(got['way/915582633'].properties['ciclomapa:duplicate_candidate']).toBeUndefined();
  });

  it('pairs anti-parallel overlapping cycleways (EPCL stub)', () => {
    const segments = parallelCycleways(
      'way/236764808',
      'way/1419527839',
      -47.818,
      -15.86,
      16,
      8,
      OFFSET_30M,
      true
    );
    applyOverlappingDedicatedCycleways(segments);
    expect(byId(segments)['way/1419527839'].properties['ciclomapa:duplicate_candidate']).toBe(
      'true'
    );
  });

  it('pairs the real EPCL stub next to Ciclovia Estrada Parque Contorno', () => {
    const segments = [
      feat('way/236764808', { highway: 'cycleway', name: 'Ciclovia Estrada Parque Contorno' }, [
        [-47.8195132, -15.8618411],
        [-47.8193071, -15.8611845],
        [-47.8192613, -15.8610498],
        [-47.8174121, -15.854935],
        [-47.8169256, -15.8533265],
        [-47.8165105, -15.8521106],
        [-47.8163506, -15.8516344],
      ]),
      feat('way/1419527839', { highway: 'cycleway' }, [
        [-47.8183391, -15.8591422],
        [-47.8183765, -15.859443],
        [-47.8184183, -15.8595699],
        [-47.818665, -15.8599907],
        [-47.818814, -15.8604363],
        [-47.8188429, -15.8604538],
      ]),
    ];
    applyOverlappingDedicatedCycleways(segments);
    expect(byId(segments)['way/1419527839'].properties['ciclomapa:duplicate_candidate']).toBe(
      'true'
    );
    expect(
      byId(segments)['way/236764808'].properties['ciclomapa:duplicate_candidate']
    ).toBeUndefined();
  });

  it('does not pair cycleways ~80m apart on opposite sides', () => {
    const segments = parallelCycleways('way/a', 'way/b', -47.83, -15.84, 16, 16, 0.00072);
    applyOverlappingDedicatedCycleways(segments);
    expect(segments.every((s) => !s.properties['ciclomapa:pair_kind'])).toBe(true);
  });

  it('leaves Fortaleza-paired one-ways alone', () => {
    const segments = parallelCycleways('way/a', 'way/b', -47.83, -15.84, 16, 10, OFFSET_30M);
    segments[1].properties['ciclomapa:duplicate_candidate'] = 'true';
    segments[1].properties['ciclomapa:paired'] = 'true';
    applyOverlappingDedicatedCycleways(segments);
    expect(segments[0].properties['ciclomapa:pair_kind']).toBeUndefined();
  });
});

function oppositeLanePair(idA, idB, startLng, startLat, nA, nB, latOffset) {
  const a = [];
  const b = [];
  for (let i = 0; i < nA; i++) a.push([startLng + i * 0.001, startLat]);
  for (let i = 0; i < nB; i++) b.push([startLng + i * 0.001, startLat + latOffset]);
  b.reverse();
  const laneProps = {
    highway: 'secondary',
    name: 'Estrada Parque Península Norte',
    oneway: 'yes',
    'cycleway:right': 'lane',
  };
  return [feat(idA, laneProps, a), feat(idB, { ...laneProps }, b)];
}

describe('applyOppositeOnewayLanes', () => {
  // EPPN carriageways sit ~75m apart, past Fortaleza's 45-60m cap.
  const OFFSET_76M = 0.00068;

  it('pairs a short opposite lane with a longer carriageway (EPPN stub)', () => {
    const segments = oppositeLanePair(
      'way/277808297',
      'way/916019052',
      -47.85,
      -15.74,
      20,
      6,
      OFFSET_76M
    );
    applyOppositeOnewayLanes(segments);
    const got = byId(segments);
    expect(got['way/916019052'].properties['ciclomapa:duplicate_candidate']).toBe('true');
    expect(got['way/916019052'].properties['ciclomapa:paired']).toBe('true');
    expect(got['way/277808297'].properties['ciclomapa:paired']).toBe('true');
    expect(got['way/277808297'].properties['ciclomapa:duplicate_candidate']).toBeUndefined();
  });

  it('pairs two similar-length opposite one-ways (EPPN)', () => {
    const segments = oppositeLanePair(
      'way/916018181',
      'way/916017123',
      -47.83,
      -15.76,
      8,
      8,
      OFFSET_76M
    );
    applyOppositeOnewayLanes(segments);
    const got = byId(segments);
    const dropped = ['way/916018181', 'way/916017123'].filter(
      (id) => got[id].properties['ciclomapa:duplicate_candidate'] === 'true'
    );
    expect(dropped).toHaveLength(1);
    expect(got['way/916018181'].properties['ciclomapa:paired']).toBe('true');
    expect(got['way/916017123'].properties['ciclomapa:paired']).toBe('true');
  });

  it('pairs a 50m-offset opposite stub (EPPN north)', () => {
    const segments = oppositeLanePair(
      'way/207791333',
      'way/916454253',
      -47.87,
      -15.73,
      16,
      5,
      0.00045
    );
    applyOppositeOnewayLanes(segments);
    expect(byId(segments)['way/916454253'].properties['ciclomapa:duplicate_candidate']).toBe(
      'true'
    );
  });

  it('does not pair same-direction lanes', () => {
    const a = [];
    const b = [];
    for (let i = 0; i < 10; i++) {
      a.push([-47.85 + i * 0.001, -15.74]);
      b.push([-47.85 + i * 0.001, -15.74 + OFFSET_76M]);
    }
    const laneProps = {
      highway: 'secondary',
      oneway: 'yes',
      'cycleway:right': 'lane',
      name: 'Estrada Parque Península Norte',
    };
    const segments = [feat('way/a', laneProps, a), feat('way/b', { ...laneProps }, b)];
    applyOppositeOnewayLanes(segments);
    expect(segments.every((s) => s.properties['ciclomapa:paired'] !== 'true')).toBe(true);
  });

  it('does not pair opposite lanes with different street names', () => {
    const segments = oppositeLanePair('way/a', 'way/b', -47.85, -15.74, 10, 10, OFFSET_76M);
    segments[1].properties.name = 'Outra Rua';
    applyOppositeOnewayLanes(segments);
    expect(segments.every((s) => !s.properties['ciclomapa:duplicate_candidate'])).toBe(true);
  });
});
