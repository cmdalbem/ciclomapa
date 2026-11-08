import skmeans from 'skmeans';
import turfDistance from '@turf/distance';

// Heuristic thresholds (units: kilometers unless noted)
// Relaxed: geometry-first used to require "very tight" parallel/endpoint similarity.
// Fortaleza data includes valid opposite-side pairs with larger separation / digitization drift.
const MIN_PAIR_SCORE = 0.42;
const MAX_PARALLEL_DIST_KM = 0.06; // ~60m average point-to-point distance (Fortaleza drift)
const MAX_ENDPOINT_DIST_KM = 0.18; // ~180m endpoint closeness
const MAX_DIR_DEV_DEG = 55;

const GRID_SIZE_DEG = 0.0025; // ~280m at the equator (coarse binning)
const MAX_POINTS_PER_SEG = 35;
const MAX_SAMPLES_FOR_DIST = 25;
// Robustness knobs for "digitization drift" in Fortaleza:
// - parallel distance uses a trimmed mean to ignore a fraction of outlier drift
// - endpoint distance uses nearest points near each end (not only the exact endpoints)
const PARALLEL_TRIM_TOP_RATIO = 0.35; // ignore worst 35% min-dist samples
const ENDPOINT_NEAR_POINTS = 10; // points to consider near each segment end

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

function normalizeName(name) {
  if (typeof name !== 'string') return null;
  const s = name.trim().toLowerCase();
  return s || null;
}

function hasOppositeLane(seg) {
  const props = seg?.properties || {};
  const values = [props['cycleway:left'], props['cycleway:right'], props.cycleway];

  const isOpp = (v) => {
    if (!v) return false;
    if (Array.isArray(v)) return v.some((inner) => isOpp(inner));
    if (typeof v !== 'string') return false;
    return /opposite_lane/i.test(v);
  };

  return values.some((v) => isOpp(v));
}

function getOnewayBicycleIsYes(seg) {
  const onewayBicycle = seg.properties['oneway:bicycle'];
  if (onewayBicycle === 'yes') return true;

  // Some OSM data uses `oneway:bicycle=no` even when cycle lanes exist.
  // Treat it as eligible as long as the street is one-way and we have
  // cycleway tagging on at least one side.
  if (onewayBicycle === 'no') {
    const leftVal = seg.properties['cycleway:left'];
    const rightVal = seg.properties['cycleway:right'];
    const cyclewayVal = seg.properties.cycleway;

    const hasTrack = (v) => {
      if (!v) return false;
      if (Array.isArray(v)) return v.some((inner) => hasTrack(inner));
      if (typeof v !== 'string') return false;
      return /track/i.test(v);
    };

    return (
      seg.properties.oneway === 'yes' &&
      (hasTrack(leftVal) || hasTrack(rightVal) || hasTrack(cyclewayVal))
    );
  }

  if (onewayBicycle) return false;
  return seg.properties.oneway === 'yes';
}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

function toPositiveAngle(degrees) {
  return degrees < 0 ? degrees + 360 : degrees;
}

function angleToVector(degrees) {
  const radians = toRadians(degrees);
  return [Math.cos(radians), Math.sin(radians)];
}

function angleBetweenPoints(p1, p2) {
  const radians = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  return toDegrees(radians);
}

function averageOfAngles(angles) {
  // Average direction via vector mean (handles wrap-around)
  let x = 0;
  let y = 0;
  angles.forEach((a) => {
    const radians = toRadians(a);
    x += Math.cos(radians);
    y += Math.sin(radians);
  });
  const avgRadians = Math.atan2(y, x);
  return toPositiveAngle(toDegrees(avgRadians));
}

function sampleCoords(coords, maxPoints) {
  if (!coords || coords.length === 0) return [];
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const out = [];
  for (let i = 0; i < coords.length; i += step) out.push(coords[i]);
  const last = coords[coords.length - 1];
  if (out.length === 0 || out[out.length - 1] !== last) out.push(last);
  return out;
}

function computeAvgAngleFromCoords(coords) {
  if (!coords || coords.length < 2) return 0;
  const angles = [];
  for (let i = 0; i < coords.length - 1; i++) {
    angles.push(angleBetweenPoints(coords[i], coords[i + 1]));
  }
  if (angles.length === 0) return 0;
  return averageOfAngles(angles);
}

function computeAvgMinPointDistanceKm(coordsA, coordsB) {
  // Robust "parallelism" proxy:
  // For each sampled point in A, compute its min distance to any point in B,
  // then use a trimmed mean to reduce sensitivity to outlier drift sections.
  const samplesA = sampleCoords(coordsA, MAX_SAMPLES_FOR_DIST);
  const samplesB = sampleCoords(coordsB, MAX_SAMPLES_FOR_DIST);
  if (samplesA.length === 0 || samplesB.length === 0) return Infinity;

  const minDists = [];
  for (const p of samplesA) {
    let minDist = Infinity;
    for (const q of samplesB) {
      const d = turfDistance(p, q);
      if (d < minDist) minDist = d;
    }
    minDists.push(minDist);
  }
  minDists.sort((a, b) => a - b);
  const keepCount = Math.max(1, Math.floor(minDists.length * (1 - PARALLEL_TRIM_TOP_RATIO)));
  const trimmed = minDists.slice(0, keepCount);
  const sum = trimmed.reduce((acc, cur) => acc + cur, 0);
  return sum / trimmed.length;
}

function computeEndpointDistanceKm(coordsA, coordsB) {
  const a0 = coordsA[0];
  const a1 = coordsA[coordsA.length - 1];
  const bStart = coordsB.slice(0, Math.min(ENDPOINT_NEAR_POINTS, coordsB.length));
  const bEnd = coordsB.slice(Math.max(0, coordsB.length - ENDPOINT_NEAR_POINTS));

  const minDistToPoints = (pt, points) => {
    let min = Infinity;
    for (const q of points) {
      const d = turfDistance(pt, q);
      if (d < min) min = d;
    }
    return min;
  };

  // "Same orientation" pairs:
  // A.start matches B.start neighborhood + A.end matches B.end neighborhood.
  const dSame = minDistToPoints(a0, bStart) + minDistToPoints(a1, bEnd);
  // "Opposite orientation" pairs:
  // A.start matches B.end neighborhood + A.end matches B.start neighborhood.
  const dOpp = minDistToPoints(a0, bEnd) + minDistToPoints(a1, bStart);
  return Math.min(dSame, dOpp);
}

function getGridCellKey(coords) {
  const mid = coords[Math.floor(coords.length / 2)];
  const lng = mid[0];
  const lat = mid[1];
  const x = Math.floor(lng / GRID_SIZE_DEG);
  const y = Math.floor(lat / GRID_SIZE_DEG);
  return `${x}:${y}`;
}

function buildEdges(segments) {
  const n = segments.length;
  const edges = new Map(); // i -> Set(j)

  const bins = new Map(); // cellKey -> number[]
  const cellKeys = new Array(n);
  for (let i = 0; i < n; i++) {
    const coords = segments[i].geometry.coordinates;
    const key = getGridCellKey(coords);
    cellKeys[i] = key;
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push(i);
  }

  const coordsByIndex = segments.map((s) => s.geometry.coordinates);
  const avgAngleByIndex = segments.map((s) => computeAvgAngleFromCoords(s.geometry.coordinates));
  const sampleCoordsByIndex = coordsByIndex.map((coords) =>
    sampleCoords(coords, MAX_POINTS_PER_SEG)
  );
  const nameByIndex = segments.map((s) => normalizeName(s?.properties?.name));
  const oppositeLaneByIndex = segments.map((s) => hasOppositeLane(s));

  const splitKey = (key) => key.split(':').map(Number);
  const neighborsOf = (key) => {
    const [x, y] = splitKey(key);
    const out = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        out.push(`${x + dx}:${y + dy}`);
      }
    }
    return out;
  };

  const addEdge = (i, j) => {
    if (!edges.has(i)) edges.set(i, new Set());
    edges.get(i).add(j);
  };

  for (let i = 0; i < n; i++) {
    const neighborKeys = neighborsOf(cellKeys[i]);
    const candidates = [];
    for (const nk of neighborKeys) {
      if (bins.has(nk)) candidates.push(...bins.get(nk));
    }

    for (const j of candidates) {
      if (j <= i) continue;
      const coordsI = sampleCoordsByIndex[i];
      const coordsJ = sampleCoordsByIndex[j];
      if (coordsI.length < 2 || coordsJ.length < 2) continue;

      if (oppositeLaneByIndex[i] || oppositeLaneByIndex[j]) continue;

      const nameI = nameByIndex[i];
      const nameJ = nameByIndex[j];
      // Super-reliable heuristic:
      // if both segments have a name and the names differ, don't treat them
      // as an opposite-side paired street.
      if (nameI && nameJ && nameI !== nameJ) continue;

      const avgMinDistKm = computeAvgMinPointDistanceKm(coordsI, coordsJ);
      if (avgMinDistKm > MAX_PARALLEL_DIST_KM * 2) continue;

      const endpointDistKm = computeEndpointDistanceKm(coordsI, coordsJ);
      // Endpoint alignment in OSM can be inconsistent for opposite-side pairs.
      // Use endpoint distance as a soft signal (via endpointScore) rather than
      // a strict "hard reject" at ~2x MAX_ENDPOINT_DIST_KM.
      if (endpointDistKm > MAX_ENDPOINT_DIST_KM * 8) continue;

      let angleDiff = Math.abs(avgAngleByIndex[i] - avgAngleByIndex[j]);
      angleDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;

      const dirScoreOpp = 1 - Math.abs(angleDiff - 180) / MAX_DIR_DEV_DEG;
      // Prefer opposite direction pairs (double-way); reject same-direction lanes.
      const directionScore = clamp01(dirScoreOpp);
      // Hard reject: avoid same-direction lane false positives.
      if (directionScore < 0.35) continue;

      // Score using the same scale as the cheap-rejection thresholds (more tolerant).
      const parallelScore = clamp01(1 - avgMinDistKm / (MAX_PARALLEL_DIST_KM * 2));
      const endpointScore = clamp01(1 - endpointDistKm / (MAX_ENDPOINT_DIST_KM * 2));

      const score = 0.52 * parallelScore + 0.33 * directionScore + 0.15 * endpointScore;
      if (score >= MIN_PAIR_SCORE) {
        addEdge(i, j);
        addEdge(j, i);
      }
    }
  }

  return edges;
}

function connectedComponentsFromEdges(n, edges) {
  const visited = new Array(n).fill(false);
  const components = [];

  for (let i = 0; i < n; i++) {
    if (visited[i]) continue;
    if (!edges.has(i)) continue;

    const queue = [i];
    visited[i] = true;
    const component = [];

    while (queue.length) {
      const cur = queue.shift();
      component.push(cur);
      const nextSet = edges.get(cur);
      if (!nextSet) continue;
      for (const nxt of nextSet) {
        if (!visited[nxt]) {
          visited[nxt] = true;
          queue.push(nxt);
        }
      }
    }

    if (component.length >= 2) components.push(component);
  }

  return components;
}

function computeMaxDistKm(coordsPoints) {
  let maxDist = 0;
  for (let i = 0; i < coordsPoints.length; i++) {
    for (let j = i + 1; j < coordsPoints.length; j++) {
      const d = turfDistance(coordsPoints[i], coordsPoints[j]);
      if (d > maxDist) maxDist = d;
    }
  }
  return maxDist;
}

export function run({ layer, segments }) {
  void layer;

  if (!segments || segments.length < 2) return [segments, {}];

  // Candidate filtering:
  // other engines restrict pairing candidates using oneway/cycleway tags.
  // geometry_first historically paired purely by geometry and became
  // too permissive with the expanded negative set.
  const candidateIndices = [];
  for (let i = 0; i < segments.length; i++) {
    if (getOnewayBicycleIsYes(segments[i])) candidateIndices.push(i);
  }

  if (candidateIndices.length < 2) return [segments, {}];

  const candidateSegments = candidateIndices.map((idx) => segments[idx]);

  // Geometry-first: build matching graph using ONLY geometric similarity,
  // but with stronger candidate eligibility.
  const edges = buildEdges(candidateSegments);
  const components = connectedComponentsFromEdges(candidateSegments.length, edges);

  if (components.length === 0) return [segments, {}];

  const groupsById = {};
  components.forEach((component, compIdx) => {
    const members = component.map((i) => candidateSegments[i]);

    const angles = members.map((seg) => computeAvgAngleFromCoords(seg.geometry.coordinates));
    const vectors = angles.map((a) => angleToVector(a));
    const clusters = skmeans(vectors, 2);

    members.forEach((seg, i) => {
      const side = clusters.idxs[i] ? 'a' : 'b';
      seg.properties['ciclomapa:duplicate_candidate'] = 'true';
      seg.properties['ciclomapa:side'] = side;
    });

    // Confidence estimation (for debug visualization):
    // compute a few best pair-scores within the component and bucket them.
    const sampledCoordsByMember = members.map((seg) =>
      sampleCoords(seg.geometry.coordinates, MAX_POINTS_PER_SEG)
    );
    const pairScores = [];
    let checkedPairs = 0;
    const MAX_GROUP_PAIR_SAMPLES = 28;

    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const avgMinDistKm = computeAvgMinPointDistanceKm(
          sampledCoordsByMember[i],
          sampledCoordsByMember[j]
        );
        const endpointDistKm = computeEndpointDistanceKm(
          sampledCoordsByMember[i],
          sampledCoordsByMember[j]
        );

        let angleDiff = Math.abs(angles[i] - angles[j]);
        angleDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;

        const dirScoreOpp = 1 - Math.abs(angleDiff - 180) / MAX_DIR_DEV_DEG;
        const directionScore = clamp01(dirScoreOpp);

        const parallelScore = clamp01(1 - avgMinDistKm / (MAX_PARALLEL_DIST_KM * 2));
        const endpointScore = clamp01(1 - endpointDistKm / (MAX_ENDPOINT_DIST_KM * 2));

        const score = 0.52 * parallelScore + 0.33 * directionScore + 0.15 * endpointScore;
        pairScores.push(score);

        checkedPairs++;
        if (checkedPairs >= MAX_GROUP_PAIR_SAMPLES) break;
      }
      if (checkedPairs >= MAX_GROUP_PAIR_SAMPLES) break;
    }

    pairScores.sort((a, b) => b - a);
    const topScores = pairScores.slice(0, Math.min(3, pairScores.length));
    const groupScore =
      topScores.length > 0 ? topScores.reduce((sum, s) => sum + s, 0) / topScores.length : 0;

    const confidenceBucket = groupScore >= 0.78 ? 'high' : groupScore >= 0.7 ? 'med' : 'low';
    members.forEach((seg) => {
      seg.properties['ciclomapa:match_confidence_bucket'] = confidenceBucket;
    });

    const allPointsSampled = [];
    members.forEach((seg) => {
      sampleCoords(seg.geometry.coordinates, MAX_POINTS_PER_SEG).forEach((p) =>
        allPointsSampled.push(p)
      );
    });

    const maxDistKm = computeMaxDistKm(allPointsSampled);
    members.forEach((seg) => {
      seg.properties['ciclomapa:max_dist'] = maxDistKm;
      seg.properties['ciclomapa:max_dist_m'] = (maxDistKm * 1000).toFixed(2);
    });

    groupsById[`geometry_group_${compIdx}`] = members;
  });

  return [segments, groupsById];
}
