import turfDistance from '@turf/distance';

// Double mapping: a road tagged cycleway=* (track, lane, sidepath) sitting next
// to a separately drawn highway=cycleway. Runs across layers, because the road
// is often a ciclofaixa and the drawn way a ciclovia.
//
// We mark the tagged road as the duplicate (dropped from length) and keep the
// dedicated cycleway. Do not put them in an A/B length group: a 180m street
// stub next to a 3km cycleway would make pessimistic count 180m and throw
// away the rest.

const MAX_SHADOW_DIST_KM = 0.025;
const MIN_COVERAGE = 0.65;
const MAX_BEARING_DELTA_DEG = 30;
const GRID_SIZE_DEG = 0.003;
const DENSIFY_STEP_KM = 0.015;
const MAX_ROAD_SAMPLES = 40;
const MAX_CYCLEWAY_SAMPLES = 200;
// A 20-30m roundabout stub sharing a node with a km-long cycleway sits
// entirely inside the 25m shadow, so it looks like a dual-map. Real
// cases (João Bettega etc.) are hundreds of metres.
const MIN_DUAL_MAP_ROAD_KM = 0.05;

function tagLooksLikeOnStreetCycleway(v) {
  if (!v) return false;
  if (Array.isArray(v)) return v.some((inner) => tagLooksLikeOnStreetCycleway(inner));
  if (typeof v !== 'string') return false;
  if (/shared/i.test(v)) return false;
  return /track|lane|sidepath/i.test(v);
}

function tagHasOnStreetCycleway(props) {
  const values = [
    props.cycleway,
    props['cycleway:left'],
    props['cycleway:right'],
    props['cycleway:both'],
  ];
  return values.some((v) => tagLooksLikeOnStreetCycleway(v));
}

function isDedicatedCycleway(seg) {
  return seg?.properties?.highway === 'cycleway';
}

function isOnStreetCyclewayRoad(seg) {
  const highway = seg?.properties?.highway;
  if (!highway || highway === 'cycleway') return false;
  return tagHasOnStreetCycleway(seg.properties);
}

function densifyCoords(coords, stepKm, cap) {
  if (!coords || coords.length < 2) return coords || [];
  const out = [coords[0]];
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const d = turfDistance(a, b);
    const n = Math.max(1, Math.ceil(d / stepKm));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  if (out.length <= cap) return out;
  const sampled = [];
  const step = (out.length - 1) / (cap - 1);
  for (let i = 0; i < cap; i++) {
    sampled.push(out[Math.round(i * step)]);
  }
  return sampled;
}

function cellKey(lng, lat) {
  return `${Math.floor(lng / GRID_SIZE_DEG)}:${Math.floor(lat / GRID_SIZE_DEG)}`;
}

function averageBearing(coords) {
  let x = 0;
  let y = 0;
  let n = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    if (turfDistance(a, b) < 0.003) continue;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const ang = Math.atan2(dy, dx);
    x += Math.cos(ang);
    y += Math.sin(ang);
    n++;
  }
  if (n === 0) return null;
  return (Math.atan2(y, x) * 180) / Math.PI;
}

function bearingDelta(a, b) {
  if (a == null || b == null) return 0;
  let d = Math.abs(a - b);
  if (d > 180) d = 360 - d;
  return d;
}

function isParallelEnough(delta) {
  return delta <= MAX_BEARING_DELTA_DEG || delta >= 180 - MAX_BEARING_DELTA_DEG;
}

function coverageNear(samplesA, samplesB, maxDistKm = MAX_SHADOW_DIST_KM) {
  let near = 0;
  let sum = 0;
  for (const p of samplesA) {
    let minDist = Infinity;
    for (const q of samplesB) {
      const d = turfDistance(p, q);
      if (d < minDist) minDist = d;
    }
    sum += minDist;
    if (minDist <= maxDistKm) near++;
  }
  return {
    cover: near / samplesA.length,
    avg: sum / samplesA.length,
  };
}

function isCloseEnough(stats) {
  return stats.cover >= MIN_COVERAGE && stats.avg <= MAX_SHADOW_DIST_KM;
}

function alreadyPaired(seg) {
  return seg?.properties?.['ciclomapa:duplicate_candidate'] === 'true';
}

function segmentLengthKm(seg, samples) {
  const tagged = Number(seg.properties?.['ciclomapa:segment_length']);
  if (Number.isFinite(tagged) && tagged > 0) return tagged;
  const coords = samples || seg?.geometry?.coordinates;
  if (!coords || coords.length < 2) return 0;
  let sum = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    sum += turfDistance(coords[i], coords[i + 1]);
  }
  return sum;
}

/**
 * Mutates counted-layer segments in place. Does not add A/B length groups.
 */
export function applyDualMappedCycleways(segments) {
  if (!segments || segments.length < 2) return;

  const roads = [];
  const cycleways = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const geom = seg?.geometry;
    if (!geom || geom.type !== 'LineString' || !geom.coordinates || geom.coordinates.length < 2) {
      continue;
    }
    if (isOnStreetCyclewayRoad(seg) && !alreadyPaired(seg)) roads.push(i);
    else if (isDedicatedCycleway(seg)) cycleways.push(i);
  }

  if (roads.length === 0 || cycleways.length === 0) return;

  const bins = new Map();
  const samplesByCycleway = new Array(cycleways.length);
  const bearingByCycleway = new Array(cycleways.length);

  for (let ci = 0; ci < cycleways.length; ci++) {
    const coords = segments[cycleways[ci]].geometry.coordinates;
    samplesByCycleway[ci] = densifyCoords(coords, DENSIFY_STEP_KM, MAX_CYCLEWAY_SAMPLES);
    bearingByCycleway[ci] = averageBearing(coords);
    for (const p of coords) {
      const key = cellKey(p[0], p[1]);
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push(ci);
    }
  }

  const neighborOffsets = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) neighborOffsets.push([dx, dy]);
  }

  for (const roadIdx of roads) {
    const road = segments[roadIdx];
    const coords = road.geometry.coordinates;
    if (segmentLengthKm(road, coords) < MIN_DUAL_MAP_ROAD_KM) continue;
    const roadSamples = densifyCoords(coords, DENSIFY_STEP_KM, MAX_ROAD_SAMPLES);
    const roadBearing = averageBearing(coords);

    const candidateSet = new Set();
    for (const p of coords) {
      const x = Math.floor(p[0] / GRID_SIZE_DEG);
      const y = Math.floor(p[1] / GRID_SIZE_DEG);
      for (const [dx, dy] of neighborOffsets) {
        const bucket = bins.get(`${x + dx}:${y + dy}`);
        if (!bucket) continue;
        for (const ci of bucket) candidateSet.add(ci);
      }
    }

    const matches = [];
    for (const ci of candidateSet) {
      const delta = bearingDelta(roadBearing, bearingByCycleway[ci]);
      if (!isParallelEnough(delta)) continue;
      const cwSamples = samplesByCycleway[ci];
      const roadOnCw = coverageNear(roadSamples, cwSamples);
      const cwOnRoad = coverageNear(cwSamples, roadSamples);
      // Either the road sits on the cycleway (short stub) or the cycleway
      // sits on a longer tagged street (Eduardo Pinto da Rocha).
      if (!isCloseEnough(roadOnCw) && !isCloseEnough(cwOnRoad)) continue;
      matches.push(ci);
    }

    if (matches.length === 0) continue;

    // paired=dual keeps these out of Lado A/B/Pareados (those filter paired=true).
    road.properties['ciclomapa:paired'] = 'dual';
    road.properties['ciclomapa:duplicate_candidate'] = 'true';
    road.properties['ciclomapa:side'] = 'b';
    road.properties['ciclomapa:pair_kind'] = 'dual_mapped';
    road.properties['ciclomapa:match_confidence_bucket'] = 'high';

    for (const ci of matches) {
      const cycleway = segments[cycleways[ci]];
      cycleway.properties['ciclomapa:paired'] = 'dual';
      cycleway.properties['ciclomapa:side'] = 'a';
      cycleway.properties['ciclomapa:pair_kind'] = 'dual_mapped';
      cycleway.properties['ciclomapa:match_confidence_bucket'] = 'high';
    }
    // Dedicated cycleway stays out of duplicate_candidate so pessimistic
    // length still counts the full way, not the shorter road stub.
  }
}

// Two highway=cycleway drawn on the same corridor. Brasília park roads often
// keep an older sparse way next to a newer detailed one, ~20-35m apart. Fortaleza
// opposite one-ways never enter here: those are already duplicate_candidate.
const OVERLAP_MAX_DIST_KM = 0.04;
const OVERLAP_MIN_COVERAGE = 0.75;
const OVERLAP_MIN_SHORTER_KM = 0.05;

function overlapCloseEnough(stats) {
  return stats.cover >= OVERLAP_MIN_COVERAGE && stats.avg <= OVERLAP_MAX_DIST_KM;
}

/**
 * Mutates counted-layer segments in place. Drops the shorter overlapping
 * cycleway from length; keeps the longer one.
 */
export function applyOverlappingDedicatedCycleways(segments) {
  if (!segments || segments.length < 2) return;

  const idxs = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const geom = seg?.geometry;
    if (!geom || geom.type !== 'LineString' || !geom.coordinates || geom.coordinates.length < 2) {
      continue;
    }
    if (isDedicatedCycleway(seg)) idxs.push(i);
  }
  if (idxs.length < 2) return;

  const samples = new Array(idxs.length);
  const bearings = new Array(idxs.length);
  const lengths = new Array(idxs.length);
  const bins = new Map();

  for (let i = 0; i < idxs.length; i++) {
    const coords = segments[idxs[i]].geometry.coordinates;
    samples[i] = densifyCoords(coords, DENSIFY_STEP_KM, MAX_CYCLEWAY_SAMPLES);
    bearings[i] = averageBearing(coords);
    lengths[i] = segmentLengthKm(segments[idxs[i]], samples[i]);
    for (const p of coords) {
      const key = cellKey(p[0], p[1]);
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push(i);
    }
  }

  const neighborOffsets = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) neighborOffsets.push([dx, dy]);
  }

  for (let i = 0; i < idxs.length; i++) {
    if (alreadyPaired(segments[idxs[i]])) continue;

    const candidateSet = new Set();
    for (const p of segments[idxs[i]].geometry.coordinates) {
      const x = Math.floor(p[0] / GRID_SIZE_DEG);
      const y = Math.floor(p[1] / GRID_SIZE_DEG);
      for (const [dx, dy] of neighborOffsets) {
        const bucket = bins.get(`${x + dx}:${y + dy}`);
        if (!bucket) continue;
        for (const j of bucket) {
          if (j !== i) candidateSet.add(j);
        }
      }
    }

    for (const j of candidateSet) {
      if (alreadyPaired(segments[idxs[j]])) continue;
      if (!isParallelEnough(bearingDelta(bearings[i], bearings[j]))) continue;

      const iIsShorter = lengths[i] <= lengths[j];
      const shortI = iIsShorter ? i : j;
      const longI = iIsShorter ? j : i;
      if (lengths[shortI] < OVERLAP_MIN_SHORTER_KM) continue;

      const stats = coverageNear(samples[shortI], samples[longI], OVERLAP_MAX_DIST_KM);
      if (!overlapCloseEnough(stats)) continue;

      const shorter = segments[idxs[shortI]];
      const longer = segments[idxs[longI]];
      shorter.properties['ciclomapa:paired'] = 'overlap';
      shorter.properties['ciclomapa:duplicate_candidate'] = 'true';
      shorter.properties['ciclomapa:side'] = 'b';
      shorter.properties['ciclomapa:pair_kind'] = 'overlapping_cycleway';
      shorter.properties['ciclomapa:match_confidence_bucket'] = 'high';
      longer.properties['ciclomapa:paired'] = 'overlap';
      longer.properties['ciclomapa:side'] = 'a';
      longer.properties['ciclomapa:pair_kind'] = 'overlapping_cycleway';
      longer.properties['ciclomapa:match_confidence_bucket'] = 'high';
      // Long way can still match other short overlays; a short way is done.
      if (shortI === i) break;
    }
  }
}

// Opposite one-way roads with cycleway=lane/track. Fortaleza engines miss Brasília
// park dual-carriageways: they sit ~50-80m apart (engine cap is ~45-60m) and a
// short opposite stub vs a long carriageway blows the average-distance check.
const ONEWAY_LANE_MAX_DIST_KM = 0.09;
const ONEWAY_LANE_MIN_COVERAGE = 0.75;

function isOnewayCyclelaneRoad(seg) {
  if (isDedicatedCycleway(seg)) return false;
  const highway = seg?.properties?.highway;
  if (!highway) return false;
  if (!tagHasOnStreetCycleway(seg.properties)) return false;
  return seg.properties.oneway === 'yes' || seg.properties['oneway:bicycle'] === 'yes';
}

function namesConflict(a, b) {
  const nameA =
    typeof a.properties?.name === 'string' ? a.properties.name.trim().toLowerCase() : '';
  const nameB =
    typeof b.properties?.name === 'string' ? b.properties.name.trim().toLowerCase() : '';
  return Boolean(nameA && nameB && nameA !== nameB);
}

function isAntiParallel(delta) {
  return delta >= 180 - MAX_BEARING_DELTA_DEG;
}

function onewayLaneCloseEnough(stats) {
  return stats.cover >= ONEWAY_LANE_MIN_COVERAGE && stats.avg <= ONEWAY_LANE_MAX_DIST_KM;
}

/**
 * Opposite one-way cycle lanes on a wide median. Marks the shorter as the
 * duplicate so pessimistic length keeps the longer carriageway.
 */
export function applyOppositeOnewayLanes(segments) {
  if (!segments || segments.length < 2) return;

  const idxs = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const geom = seg?.geometry;
    if (!geom || geom.type !== 'LineString' || !geom.coordinates || geom.coordinates.length < 2) {
      continue;
    }
    if (isOnewayCyclelaneRoad(seg) && !alreadyPaired(seg)) idxs.push(i);
  }
  if (idxs.length < 2) return;

  const samples = new Array(idxs.length);
  const bearings = new Array(idxs.length);
  const lengths = new Array(idxs.length);
  const bins = new Map();

  for (let i = 0; i < idxs.length; i++) {
    const coords = segments[idxs[i]].geometry.coordinates;
    samples[i] = densifyCoords(coords, DENSIFY_STEP_KM, MAX_CYCLEWAY_SAMPLES);
    bearings[i] = averageBearing(coords);
    lengths[i] = segmentLengthKm(segments[idxs[i]], samples[i]);
    for (const p of coords) {
      const key = cellKey(p[0], p[1]);
      if (!bins.has(key)) bins.set(key, []);
      bins.get(key).push(i);
    }
  }

  const neighborOffsets = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) neighborOffsets.push([dx, dy]);
  }

  for (let i = 0; i < idxs.length; i++) {
    if (alreadyPaired(segments[idxs[i]])) continue;

    const candidateSet = new Set();
    for (const p of segments[idxs[i]].geometry.coordinates) {
      const x = Math.floor(p[0] / GRID_SIZE_DEG);
      const y = Math.floor(p[1] / GRID_SIZE_DEG);
      for (const [dx, dy] of neighborOffsets) {
        const bucket = bins.get(`${x + dx}:${y + dy}`);
        if (!bucket) continue;
        for (const j of bucket) {
          if (j !== i) candidateSet.add(j);
        }
      }
    }

    for (const j of candidateSet) {
      if (alreadyPaired(segments[idxs[j]])) continue;
      if (namesConflict(segments[idxs[i]], segments[idxs[j]])) continue;
      if (!isAntiParallel(bearingDelta(bearings[i], bearings[j]))) continue;

      const iIsShorter = lengths[i] <= lengths[j];
      const shortI = iIsShorter ? i : j;
      const longI = iIsShorter ? j : i;
      if (lengths[shortI] < OVERLAP_MIN_SHORTER_KM) continue;

      const stats = coverageNear(samples[shortI], samples[longI], ONEWAY_LANE_MAX_DIST_KM);
      if (!onewayLaneCloseEnough(stats)) continue;

      const shorter = segments[idxs[shortI]];
      const longer = segments[idxs[longI]];
      // paired=true so these show on Lado A/B with Fortaleza opposite one-ways.
      shorter.properties['ciclomapa:paired'] = 'true';
      shorter.properties['ciclomapa:duplicate_candidate'] = 'true';
      shorter.properties['ciclomapa:side'] = 'b';
      shorter.properties['ciclomapa:match_confidence_bucket'] = 'high';
      longer.properties['ciclomapa:paired'] = 'true';
      longer.properties['ciclomapa:side'] = 'a';
      longer.properties['ciclomapa:match_confidence_bucket'] = 'high';
      if (shortI === i) break;
    }
  }
}
