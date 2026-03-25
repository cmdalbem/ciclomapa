import skmeans from 'skmeans';
import turfDistance from '@turf/distance';

// Topology-first pairing:
// - cluster segment endpoints into "junction nodes" (no line splitting)
// - pair segments whose endpoints match in opposite order (A.start ~ B.end && A.end ~ B.start)
// - verify via parallelism + opposite direction scoring

// Thresholds (km / degrees)
// Relaxed: topology-first previously required tight parallel/endpoint similarity.
// Fortaleza includes opposite-side pairs with more digitization drift.
const MIN_PAIR_SCORE = 0.39;
const MAX_PARALLEL_DIST_KM = 0.045; // ~45m (more tolerant for drift-heavy cases)
// Endpoint clustering is used only for candidate pruning; Fortaleza digitization
// isn't always perfectly aligned at endpoints, so we allow a larger radius.
// Fortaleza digitization drift: allow wider endpoint clustering for topology-first
const MAX_ENDPOINT_DIST_KM = 1.0; // ~1km (Fortaleza endpoint drift)
const MAX_DIR_DEV_DEG = 55;

// Endpoint/node clustering (degrees ~= meters scale, coarse on purpose)
const ENDPOINT_GRID_SIZE_DEG = 0.0018; // ~200m-ish at equator
const MAX_POINTS_PER_SEG = 35;
const MAX_SAMPLES_FOR_DIST = 25;
const MAX_GROUP_PAIR_SAMPLES = 28;
// Robustness knobs for "digitization drift" in Fortaleza:
// parallel distance uses a trimmed mean to ignore a fraction of outlier drift sections
const PARALLEL_TRIM_TOP_RATIO = 0.35; // ignore worst 35% min-dist samples
// When MAX_ENDPOINT_DIST_KM is large, the 3x3 cell lookup can miss nearby nodes.
// Expand the neighbor-cell range proportionally (in km) to allow clustering within MAX_ENDPOINT_DIST_KM.
const ENDPOINT_GRID_CELL_KM_APPROX = ENDPOINT_GRID_SIZE_DEG * 111.32;
const ENDPOINT_NODE_NEIGHBOR_RANGE = Math.max(
  1,
  Math.ceil(MAX_ENDPOINT_DIST_KM / ENDPOINT_GRID_CELL_KM_APPROX) + 2
);

function getOnewayBicycleIsYes(seg) {
  const onewayBicycle = seg.properties['oneway:bicycle'];
  if (onewayBicycle === 'yes') return true;
  // Some OSM data uses `oneway:bicycle=no` even when cycle lanes exist.
  // Treat it as eligible as long as the street is one-way and we have
  // cycleway tagging on at least one side.
  if (onewayBicycle === 'no') {
    // Some OSM data uses `oneway:bicycle=no` even when cycle lanes exist.
    // Use a narrower heuristic: only treat as eligible when we have an
    // explicit `track` cycleway (not just `lane`/`shared_lane`).
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

  if (seg.properties.oneway !== 'yes') return false;

  return true;
}

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

function computeAvgAngleFromCoords(coords) {
  if (!coords || coords.length < 2) return 0;
  const angles = [];
  for (let i = 0; i < coords.length - 1; i++) {
    angles.push(angleBetweenPoints(coords[i], coords[i + 1]));
  }
  if (angles.length === 0) return 0;
  return averageOfAngles(angles);
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

function computeAvgMinPointDistanceKm(coordsA, coordsB) {
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

function computeEndpointDistanceKm(startA, endA, startB, endB) {
  const dSame = turfDistance(startA, startB) + turfDistance(endA, endB);
  const dOpp = turfDistance(startA, endB) + turfDistance(endA, startB);
  return Math.min(dSame, dOpp);
}

function getEndpointGridCellKey(endpointCoords) {
  const lng = endpointCoords[0];
  const lat = endpointCoords[1];
  const x = Math.floor(lng / ENDPOINT_GRID_SIZE_DEG);
  const y = Math.floor(lat / ENDPOINT_GRID_SIZE_DEG);
  return `${x}:${y}`;
}

function neighboringKeys(key, range = ENDPOINT_NODE_NEIGHBOR_RANGE) {
  const [xStr, yStr] = key.split(':');
  const x = Number(xStr);
  const y = Number(yStr);
  const out = [];
  for (let dx = -range; dx <= range; dx++) {
    for (let dy = -range; dy <= range; dy++) {
      out.push(`${x + dx}:${y + dy}`);
    }
  }
  return out;
}

function buildEndpointNodes(segments) {
  // nodes: [{id, coords}] where coords is [lng,lat]
  const nodes = [];
  const nodeIndexByCell = new Map(); // cellKey -> number[]
  const segmentEndpoints = new Array(segments.length);

  for (let i = 0; i < segments.length; i++) {
    const coords = segments[i].geometry.coordinates;
    const start = coords[0];
    const end = coords[coords.length - 1];

    segmentEndpoints[i] = { start, end };
  }

  const getOrCreateNodeId = (ptCoords, cellKey) => {
    // Search existing nodes in 3x3 neighboring cells
    const candidates = [];
    for (const nk of neighboringKeys(cellKey)) {
      if (nodeIndexByCell.has(nk)) candidates.push(...nodeIndexByCell.get(nk));
    }

    let bestId = null;
    let bestDistKm = Infinity;
    for (const nodeId of candidates) {
      const d = turfDistance(ptCoords, nodes[nodeId].coords);
      if (d < bestDistKm) {
        bestDistKm = d;
        bestId = nodeId;
      }
    }

    // If no nearby node, create one
    if (bestId === null || bestDistKm > MAX_ENDPOINT_DIST_KM) {
      const newId = nodes.length;
      nodes.push({ id: newId, coords: ptCoords });
      const list = nodeIndexByCell.get(cellKey) || [];
      list.push(newId);
      nodeIndexByCell.set(cellKey, list);
      return newId;
    }

    return bestId;
  };

  // Assign start/end node id for each segment
  const startNodeBySeg = new Array(segments.length);
  const endNodeBySeg = new Array(segments.length);

  for (let i = 0; i < segments.length; i++) {
    const { start, end } = segmentEndpoints[i];
    const startCell = getEndpointGridCellKey(start);
    const endCell = getEndpointGridCellKey(end);

    startNodeBySeg[i] = getOrCreateNodeId(start, startCell);
    endNodeBySeg[i] = getOrCreateNodeId(end, endCell);
  }

  return { nodes, startNodeBySeg, endNodeBySeg };
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

function buildEdgesViaTopology(segments, startNodeBySeg, endNodeBySeg, precomputed) {
  const n = segments.length;
  const edges = new Map(); // i -> Set(j)

  const forwardIndex = new Map(); // "u:v" -> number[]
  for (let i = 0; i < n; i++) {
    const key = `${startNodeBySeg[i]}:${endNodeBySeg[i]}`;
    if (!forwardIndex.has(key)) forwardIndex.set(key, []);
    forwardIndex.get(key).push(i);
  }

  const addEdge = (i, j) => {
    if (!edges.has(i)) edges.set(i, new Set());
    edges.get(i).add(j);
  };

  for (let i = 0; i < n; i++) {
    const u = startNodeBySeg[i];
    const v = endNodeBySeg[i];
    const reversedKey = `${v}:${u}`;
    const sameKey = `${u}:${v}`;

    const candidatesSet = new Set();
    if (forwardIndex.has(reversedKey)) {
      for (const j of forwardIndex.get(reversedKey)) candidatesSet.add(j);
    }
    if (forwardIndex.has(sameKey)) {
      for (const j of forwardIndex.get(sameKey)) candidatesSet.add(j);
    }

    // Additional candidate expansion:
    // Even when junction-node IDs don't align perfectly, opposite-side segments
    // can still have sufficiently close endpoints. Use endpoint-grid bins
    // to capture those cases.
    const coordsI = precomputed.sampleCoordsBySeg[i];
    if (coordsI?.length >= 2 && precomputed.endpointBinsByCell) {
      const startCell = getEndpointGridCellKey(coordsI[0]);
      const endCell = getEndpointGridCellKey(coordsI[coordsI.length - 1]);
      for (const nk of neighboringKeys(startCell)) {
        const bucket = precomputed.endpointBinsByCell.get(nk);
        if (!bucket) continue;
        for (const j of bucket) candidatesSet.add(j);
      }
      for (const nk of neighboringKeys(endCell)) {
        const bucket = precomputed.endpointBinsByCell.get(nk);
        if (!bucket) continue;
        for (const j of bucket) candidatesSet.add(j);
      }
    }

    for (const j of candidatesSet) {
      if (j <= i) continue;

      // Cheap endpoint reject (we cluster nodes, but still keep threshold)
      const coordsI = precomputed.sampleCoordsBySeg[i];
      const coordsJ = precomputed.sampleCoordsBySeg[j];
      if (coordsI.length < 2 || coordsJ.length < 2) continue;

      if (precomputed.oppositeLaneBySeg?.[i] || precomputed.oppositeLaneBySeg?.[j]) continue;

      const nameI = precomputed.nameBySeg?.[i];
      const nameJ = precomputed.nameBySeg?.[j];
      // Super-reliable heuristic:
      // if both segments have a name and the names differ, don't consider them a valid opposite pair.
      if (nameI && nameJ && nameI !== nameJ) continue;

      const endpointDistKm =
        precomputed.endpointDistKmByPair[i]?.[j] ??
        computeEndpointDistanceKm(
          coordsI[0],
          coordsI[coordsI.length - 1],
          coordsJ[0],
          coordsJ[coordsJ.length - 1]
        );
      if (endpointDistKm > MAX_ENDPOINT_DIST_KM * 2) continue;

      const avgMinDistKm =
        precomputed.avgMinDistKmByPair[i]?.[j] ?? computeAvgMinPointDistanceKm(coordsI, coordsJ);
      if (avgMinDistKm > MAX_PARALLEL_DIST_KM * 2) continue;

      // Direction similarity (accept both "opposite" and "same", since endpoint digitization
      // direction isn't consistent across OSM data).
      let angleDiff = Math.abs(precomputed.avgAngleBySeg[i] - precomputed.avgAngleBySeg[j]);
      angleDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;
      const dirScoreOpp = 1 - Math.abs(angleDiff - 180) / MAX_DIR_DEV_DEG;
      // Prefer opposite direction pairs (double-way); reject same-direction lanes.
      const directionScore = clamp01(dirScoreOpp);
      if (directionScore < 0.35) continue;

      const parallelScore = clamp01(1 - avgMinDistKm / (MAX_PARALLEL_DIST_KM * 2));
      const endpointScore = clamp01(1 - endpointDistKm / (MAX_ENDPOINT_DIST_KM * 2));
      const score = 0.55 * parallelScore + 0.3 * directionScore + 0.15 * endpointScore;

      if (score >= MIN_PAIR_SCORE) {
        addEdge(i, j);
        addEdge(j, i);
      }
    }
  }

  return edges;
}

export function run({ layer, segments }) {
  void layer;

  if (!segments || segments.length < 2) return [segments, {}];

  // Candidate set: only segments that look like one-way bike links.
  const candidateIndices = [];
  for (let i = 0; i < segments.length; i++) {
    if (getOnewayBicycleIsYes(segments[i])) {
      candidateIndices.push(i);
    }
  }

  if (candidateIndices.length < 2) return [segments, {}];

  const candidateSegments = candidateIndices.map((idx) => segments[idx]);
  if (candidateSegments.length < 2) return [segments, {}];

  // Build endpoint "junction nodes"
  const { startNodeBySeg, endNodeBySeg } = buildEndpointNodes(candidateSegments);

  // Precompute angles + sampled coords
  const avgAngleBySeg = candidateSegments.map((seg) =>
    computeAvgAngleFromCoords(seg.geometry.coordinates)
  );
  const sampleCoordsBySeg = candidateSegments.map((seg) =>
    sampleCoords(seg.geometry.coordinates, MAX_POINTS_PER_SEG)
  );
  const nameBySeg = candidateSegments.map((seg) => normalizeName(seg?.properties?.name));
  const oppositeLaneBySeg = candidateSegments.map((seg) => hasOppositeLane(seg));

  // Endpoint bins for candidate expansion (endpoint proximity, not node-id matching).
  const endpointBinsByCell = new Map(); // cellKey -> Set(indices)
  for (let i = 0; i < sampleCoordsBySeg.length; i++) {
    const coords = sampleCoordsBySeg[i];
    if (!coords || coords.length < 2) continue;
    const startCell = getEndpointGridCellKey(coords[0]);
    const endCell = getEndpointGridCellKey(coords[coords.length - 1]);

    const addToBin = (cellKey) => {
      if (!endpointBinsByCell.has(cellKey)) endpointBinsByCell.set(cellKey, new Set());
      endpointBinsByCell.get(cellKey).add(i);
    };

    addToBin(startCell);
    addToBin(endCell);
  }

  // Precompute endpoint distances and avgMinDist for candidate pairs lazily in a sparse object.
  // For simplicity, we compute for all i<j within same reversed endpoint mapping.
  // (We keep this fairly cheap by using endpoint-node matching first.)
  const endpointDistKmByPair = [];
  const avgMinDistKmByPair = [];
  for (let i = 0; i < candidateSegments.length; i++) {
    endpointDistKmByPair[i] = {};
    avgMinDistKmByPair[i] = {};
  }

  // Build same forwardIndex as in buildEdgesViaTopology
  const forwardIndex = new Map();
  for (let i = 0; i < candidateSegments.length; i++) {
    const key = `${startNodeBySeg[i]}:${endNodeBySeg[i]}`;
    if (!forwardIndex.has(key)) forwardIndex.set(key, []);
    forwardIndex.get(key).push(i);
  }

  for (let i = 0; i < candidateSegments.length; i++) {
    const u = startNodeBySeg[i];
    const v = endNodeBySeg[i];
    const reversedKey = `${v}:${u}`;
    if (!forwardIndex.has(reversedKey)) continue;
    const candidates = forwardIndex.get(reversedKey);
    for (const j of candidates) {
      if (j <= i) continue;
      const coordsI = candidateSegments[i].geometry.coordinates;
      const coordsJ = candidateSegments[j].geometry.coordinates;
      const startI = coordsI[0];
      const endI = coordsI[coordsI.length - 1];
      const startJ = coordsJ[0];
      const endJ = coordsJ[coordsJ.length - 1];

      endpointDistKmByPair[i][j] = computeEndpointDistanceKm(startI, endI, startJ, endJ);
      avgMinDistKmByPair[i][j] = computeAvgMinPointDistanceKm(
        sampleCoordsBySeg[i],
        sampleCoordsBySeg[j]
      );
    }
  }

  const edges = buildEdgesViaTopology(candidateSegments, startNodeBySeg, endNodeBySeg, {
    endpointDistKmByPair,
    avgMinDistKmByPair,
    avgAngleBySeg,
    sampleCoordsBySeg,
    endpointBinsByCell,
    nameBySeg,
    oppositeLaneBySeg,
  });

  const components = connectedComponentsFromEdges(candidateSegments.length, edges);
  if (components.length === 0) return [segments, {}];

  const groupsById = {};
  components.forEach((component, compIdx) => {
    const members = component.map((i) => candidateSegments[i]);

    // Assign side A/B by angle clustering within the component
    const angles = members.map((seg) => computeAvgAngleFromCoords(seg.geometry.coordinates));
    const vectors = angles.map((a) => angleToVector(a));
    const clusters = skmeans(vectors, 2);

    members.forEach((seg, i) => {
      const side = clusters.idxs[i] ? 'a' : 'b';
      seg.properties['ciclomapa:duplicate_candidate'] = 'true';
      seg.properties['ciclomapa:side'] = side;
    });

    // Compute max distance for false-positive guard
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

    // Confidence estimate: score a few best member pairs.
    const sampledCoordsByMember = members.map((seg) =>
      sampleCoords(seg.geometry.coordinates, MAX_POINTS_PER_SEG)
    );
    const pairScores = [];
    let checkedPairs = 0;

    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const avgMinDistKm = computeAvgMinPointDistanceKm(
          sampledCoordsByMember[i],
          sampledCoordsByMember[j]
        );
        const endpointDistKm = computeEndpointDistanceKm(
          sampledCoordsByMember[i][0],
          sampledCoordsByMember[i][sampledCoordsByMember[i].length - 1],
          sampledCoordsByMember[j][0],
          sampledCoordsByMember[j][sampledCoordsByMember[j].length - 1]
        );

        let angleDiff = Math.abs(angles[i] - angles[j]);
        angleDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;
        const dirScoreOpp = 1 - Math.abs(angleDiff - 180) / MAX_DIR_DEV_DEG;
        const directionScore = clamp01(dirScoreOpp);

        const parallelScore = clamp01(1 - avgMinDistKm / (MAX_PARALLEL_DIST_KM * 2));
        const endpointScore = clamp01(1 - endpointDistKm / (MAX_ENDPOINT_DIST_KM * 2));

        const score = 0.55 * parallelScore + 0.3 * directionScore + 0.15 * endpointScore;
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

    groupsById[`topology_group_${compIdx}`] = members;
  });

  return [segments, groupsById];
}
