#!/usr/bin/env node
/**
 * Evaluate double-way detection engines on Fortaleza.
 *
 * Outputs whether each known pair of OSM way IDs gets `ciclomapa:paired=true`
 * after running `calculateLayersLengths()` with each parallel dedupe engine.
 *
 * Usage:
 *   node scripts/evaluate-fortaleza-doubleways.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import osmtogeojson from 'osmtogeojson';

// --- Minimal "browser" stubs for importing app modules in Node ---
// eslint-disable-next-line no-undef
globalThis.window = globalThis.window || {
  location: { hostname: '' },
  matchMedia: () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
};

const OVERPASS_SERVERS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
];

const bboxFromCatalogFortaleza = {
  // [minLng, minLat, maxLng, maxLat]
  minLng: -38.6379078,
  minLat: -3.8945441,
  maxLng: -38.4013259,
  maxLat: -3.6921047,
};

const LENGTH_COUNTED_LAYER_IDS = [
  'ciclovia',
  'ciclofaixa',
  'ciclorrota',
  'calcada-compartilhada',
];

// Pairs you provided (from Fortaleza ground-truth reconciliation)
const WAY_PAIRS = [
  [23405846, 913906395],
  [185735692, 436564154],
  [278919566, 707853098],
  [540493695, 437157697],
  [980650619, 445301275],
  [653830177, 653830174],
  [522561155, 500001849],
  [1281305939, 916867776],
  [434435625, 505101200],
  [873181011, 873181012],
  [450885298, 280300712],
];

// Ways that should NOT be paired (same lane / same direction)
const NEGATIVE_WAY_IDS = [
  1050321316,
  1144796398,
  1050321317,
  437263107,
  910964429,
  771484104,
  824057783,
  389966900,
  838378080,
  906866216,
  283166321,
  949170012,
  40131227,
  40131236,
  281321966,
  281321970,
  663520242,
  1270410990,
  1270410991,
  1262762484,
  437963248,
  436564182,
  952700868,
  789871639,
  48506861,
  273101650,
  853044146,
  705197626,
  158084961,
  1219567463,
  278852092,
  280057029,
  112116581,
  444893398,
  913664974,
  401034085,
  243009853,
  633036588,
  24404333,
  932050275,
  979896923,
  846207891,
  1020064089,
  1020064093,
  1020064092,
  873181004,
  704719185,
];

// Ways that should be included as paired=true (even without knowing the exact opposite-side partner here).
const MUST_BE_PAIRED_WAY_IDS = [
  913958781,
  644435291,
  644435290,
  913958782,
  970969816,
  970968516,
  1166283978,
];

const OVERPASS_ENDPOINT = OVERPASS_SERVERS[0];

function slugify(str) {
  // Small local copy of the app's slugify behavior, minus special-case logic.
  const a = 'àáäâãåăæçèéëêǵḧìíïîḿńǹñòóöôœøṕŕßśșțùúüûǘẃẍÿź·/_,:;';
  const b = 'aaaaaaaaceeeeghiiiimnnnooooooprssstuuuuuwxyz------';
  const p = new RegExp(a.split('').join('|'), 'g');
  return str
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(p, (c) => b.charAt(a.indexOf(c)))
    .replace(/&/g, '-and-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function buildBboxString(b) {
  // Overpass bbox order: (south,west,north,east)
  const south = b.minLat;
  const west = b.minLng;
  const north = b.maxLat;
  const east = b.maxLng;
  return `${south},${west},${north},${east}`;
}

function loadLayersJson() {
  const layersPath = path.join(process.cwd(), 'src', 'config', 'layers.json');
  const raw = fs.readFileSync(layersPath, 'utf8');
  return JSON.parse(raw);
}

function generateOverpassQueryForCountedLayers(layers, bboxStr) {
  const includedLayers = layers
    .filter((l) => l.filters)
    .filter((l) => LENGTH_COUNTED_LAYER_IDS.includes(slugify(l.name)));

  const body = includedLayers
    .map((l) => (l.type === 'poi' ? ['node', 'way'] : ['way'])
      .map((element) =>
        l.filters
          .map((f) => {
            const selector =
              typeof f[0] === 'string'
                ? `["${f[0]}"="${f[1]}"]`
                : f.map((f_inner) => `["${f_inner[0]}"="${f_inner[1]}"]`).join('');
            return `${element}${selector}(${bboxStr});\n`;
          })
          .join('')
      )
      .join(''))
    .join('');

  // Note: we intentionally only query "body geom" for speed.
  return `
    [out:json][timeout:500];
    (
      ${body}
    );
    out body geom;
  `;
}

async function fetchOverpassGeoJson(query) {
  const url = `${OVERPASS_ENDPOINT}?data=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Overpass request failed (${res.status}): ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  return osmtogeojson({ elements: data.elements }, { flatProperties: true });
}

function getPairedStatusForWayId(geoJson, wayId) {
  const idStr = String(wayId);
  const matches = (geoJson.features || []).filter((f) => {
    if (!f) return false;
    if (f.id === `way/${idStr}`) return true;
    if (f.properties && f.properties.id === idStr) return true;
    if (f.properties && f.properties['@id'] === `way/${idStr}`) return true;
    if (f.properties && f.properties['osm_id'] === idStr) return true;
    return false;
  });
  if (matches.length === 0) return { found: false, paired: null, count: 0 };
  // Usually it's 1 feature per way id, but we handle multiples safely.
  const paired = matches.some((f) => f?.properties?.['ciclomapa:paired'] === 'true');
  return { found: true, paired, count: matches.length };
}

function sampleCoords(coords, maxPoints) {
  if (!coords || coords.length === 0) return [];
  if (coords.length <= maxPoints) return coords;
  const step = Math.ceil(coords.length / maxPoints);
  const out = [];
  for (let i = 0; i < coords.length; i += step) out.push(coords[i]);
  // Ensure last point exists (helps endpoint checks).
  const last = coords[coords.length - 1];
  if (out.length === 0 || out[out.length - 1] !== last) out.push(last);
  return out;
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

function angleBetweenPoints(p1, p2) {
  const radians = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  return toDegrees(radians);
}

function averageOfAngles(angles) {
  // Vector mean handles wrap-around at 0/360.
  let x = 0;
  let y = 0;
  for (const a of angles) {
    const radians = toRadians(a);
    x += Math.cos(radians);
    y += Math.sin(radians);
  }
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

function clamp01(x) {
  return Math.min(1, Math.max(0, x));
}

function computeAvgMinPointDistanceKm(coordsA, coordsB, turfDistance) {
  const MAX_SAMPLES_FOR_DIST = 25;
  const samplesA = sampleCoords(coordsA, MAX_SAMPLES_FOR_DIST);
  const samplesB = sampleCoords(coordsB, MAX_SAMPLES_FOR_DIST);
  if (samplesA.length === 0 || samplesB.length === 0) return Infinity;

  let sum = 0;
  for (const p of samplesA) {
    let minDist = Infinity;
    for (const q of samplesB) {
      const d = turfDistance(p, q);
      if (d < minDist) minDist = d;
    }
    sum += minDist;
  }
  return sum / samplesA.length;
}

function computeEndpointDistanceKm(coordsA, coordsB, turfDistance) {
  const a0 = coordsA[0];
  const a1 = coordsA[coordsA.length - 1];
  const b0 = coordsB[0];
  const b1 = coordsB[coordsB.length - 1];
  const dSame = turfDistance(a0, b0) + turfDistance(a1, b1);
  const dOpp = turfDistance(a0, b1) + turfDistance(a1, b0);
  return Math.min(dSame, dOpp);
}

function getWayFeature(geoJson, wayId) {
  const idStr = String(wayId);
  return (geoJson.features || []).find((f) => {
    if (!f) return false;
    if (f.id === `way/${idStr}`) return true;
    if (f.properties && f.properties.id === idStr) return true;
    if (f.properties && f.properties['@id'] === `way/${idStr}`) return true;
    if (f.properties && f.properties['osm_id'] === idStr) return true;
    return false;
  });
}

async function main() {
  const { PARALLEL_DEDUPE_ENGINES } = await import(
    '../src/utils/parallelDedupeEngines/engineTypes.js'
  );
  const { calculateLayersLengths, computeTypologies } = await import('../src/utils/geojsonUtils.js');

  const layersJson = loadLayersJson();

  // Build minimal layer objects with ids/types expected by calculateLayersLengths().
  const layers = layersJson.map((l) => ({
    ...l,
    id: slugify(l.name),
    type: l.type || 'way',
  }));

  const bboxStr = buildBboxString(bboxFromCatalogFortaleza);
  const query = generateOverpassQueryForCountedLayers(layersJson, bboxStr);

  const cacheDir = path.join(process.cwd(), 'scripts', '.cache');
  const cachePath = path.join(cacheDir, 'fortaleza-doubleways.geojson');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

  let geoJson;
  const useCache = !process.argv.includes('--no-cache');
  if (useCache && fs.existsSync(cachePath)) {
    console.log(`Loading Fortaleza geojson from cache: ${cachePath}`);
    geoJson = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } else {
    console.log('Fetching Fortaleza OSM data from Overpass...');
    geoJson = await fetchOverpassGeoJson(query);
    console.log(`Fetched ${geoJson.features?.length || 0} GeoJSON features`);
    fs.writeFileSync(cachePath, JSON.stringify(geoJson));
    console.log(`Saved cache: ${cachePath}`);
  }

  const results = {};

  // Ground-truth total length (only ciclovia + ciclofaixa), based on
  // your provided positive pairs.
  const turfLengthModule = await import('@turf/length');
  const turfLength = turfLengthModule.default || turfLengthModule;
  const gtPairsWayIds = new Set(WAY_PAIRS.flat());
  const cicloviaLayerName = layers.find((l) => l.id === 'ciclovia')?.name;
  const ciclofaixaLayerName = layers.find((l) => l.id === 'ciclofaixa')?.name;

  function extractWayIdFromFeature(f) {
    if (!f) return null;
    if (typeof f.id === 'string' && f.id.startsWith('way/')) {
      const n = Number(f.id.split('/')[1]);
      return Number.isFinite(n) ? n : null;
    }
    const props = f.properties || {};
    const candidates = [props.id, props['@id'], props.osm_id];
    for (const c of candidates) {
      if (typeof c === 'string') {
        const n = Number(c.startsWith('way/') ? c.split('/')[1] : c);
        if (Number.isFinite(n)) return n;
      }
      if (typeof c === 'number' && Number.isFinite(c)) return c;
    }
    return null;
  }

  const geoForGt = JSON.parse(JSON.stringify(geoJson));
  computeTypologies(geoForGt, layers);
  let gtSumAll = 0;
  let gtDupSum = 0;
  for (const f of geoForGt.features || []) {
    const type = f?.properties?.type;
    if (type !== cicloviaLayerName && type !== ciclofaixaLayerName) continue;
    const len = turfLength(f);
    gtSumAll += len;
    const wayIdNum = extractWayIdFromFeature(f);
    if (wayIdNum !== null && gtPairsWayIds.has(wayIdNum)) {
      gtDupSum += len;
    }
  }
  const gtTotalCicloviaCiclofaixa = gtSumAll - gtDupSum / 2;

  const ENGINE_ORDER = PARALLEL_DEDUPE_ENGINES;

  for (const engineId of PARALLEL_DEDUPE_ENGINES) {
    console.log(`\nRunning engine: ${engineId}`);
    const geoClone = JSON.parse(JSON.stringify(geoJson));
    const originalDebug = console.debug;
    console.debug = () => {};
    const layerLengths = calculateLayersLengths(geoClone, layers, 'average', engineId);
    console.debug = originalDebug;

    const enginePairs = [];
    for (const [a, b] of WAY_PAIRS) {
      const aStatus = getPairedStatusForWayId(geoClone, a);
      const bStatus = getPairedStatusForWayId(geoClone, b);
      const ok = aStatus.paired === true && bStatus.paired === true;
      enginePairs.push({ a, b, ok, aStatus, bStatus });
    }

    const okCount = enginePairs.filter((p) => p.ok).length;

    let negativePairedViolations = 0;
    const negativeStatuses = [];
    for (const wayId of NEGATIVE_WAY_IDS) {
      const status = getPairedStatusForWayId(geoClone, wayId);
      const violates = status.found && status.paired === true;
      if (violates) negativePairedViolations++;
      negativeStatuses.push({ wayId, status, violates });
    }

    let mustPairedViolations = 0;
    let mustPairedMissing = 0;
    const mustStatuses = [];
    for (const wayId of MUST_BE_PAIRED_WAY_IDS) {
      const status = getPairedStatusForWayId(geoClone, wayId);
      const violates = status.found && status.paired !== true;
      const missing = !status.found;
      if (violates) mustPairedViolations++;
      if (missing) mustPairedMissing++;
      mustStatuses.push({ wayId, status, violates, missing });
    }

    results[engineId] = {
      okCount,
      enginePairs,
      negativePairedViolations,
      negativeStatuses,
      mustPairedViolations,
      mustPairedMissing,
      mustStatuses,
      totalLenCicloviaCiclofaixa:
        (layerLengths?.ciclovia || 0) + (layerLengths?.ciclofaixa || 0),
    };

    console.log(`Paired pairs: ${okCount}/${WAY_PAIRS.length}`);
    console.log(`Negative (should be unpaired) violations: ${negativePairedViolations}/${NEGATIVE_WAY_IDS.length}`);
  }

  // Geometry score breakdown for the pairs that geometry/topology still missed.
  // This gives immediate guidance on which threshold/score component is blocking them.
  const turfDistanceModule = await import('@turf/distance');
  const turfDistance = turfDistanceModule.default || turfDistanceModule;
  const geometryFirst = 'geometry_first';
  const topologyFirst = 'topology_first';

  for (const [a, b] of WAY_PAIRS) {
    const aFoundFeature = getWayFeature(geoJson, a);
    const bFoundFeature = getWayFeature(geoJson, b);
    if (!aFoundFeature || !bFoundFeature) continue;

    const aStatus = results[geometryFirst]?.enginePairs.find((p) => p.a === a && p.b === b);
    const aTopStatus = results[topologyFirst]?.enginePairs.find((p) => p.a === a && p.b === b);
    const missedByGeom = aStatus && aStatus.ok === false;
    const missedByTopo = aTopStatus && aTopStatus.ok === false;
    if (!missedByGeom && !missedByTopo) continue;

    const coordsA = aFoundFeature.geometry?.coordinates;
    const coordsB = bFoundFeature.geometry?.coordinates;
    if (!coordsA || !coordsB || coordsA.length < 2 || coordsB.length < 2) continue;

    // Mirror geometry_first thresholds and scoring.
    const MIN_PAIR_SCORE = 0.69;
    const MAX_PARALLEL_DIST_KM = 0.027;
    const MAX_ENDPOINT_DIST_KM = 0.18;
    const MAX_DIR_DEV_DEG = 55;
    const MAX_POINTS_PER_SEG = 35;

    const coordsASampled = sampleCoords(coordsA, MAX_POINTS_PER_SEG);
    const coordsBSampled = sampleCoords(coordsB, MAX_POINTS_PER_SEG);

    const avgMinDistKm = computeAvgMinPointDistanceKm(coordsASampled, coordsBSampled, turfDistance);
    const endpointDistKm = computeEndpointDistanceKm(coordsASampled, coordsBSampled, turfDistance);

    const avgAngleA = computeAvgAngleFromCoords(coordsA);
    const avgAngleB = computeAvgAngleFromCoords(coordsB);
    let angleDiff = Math.abs(avgAngleA - avgAngleB);
    angleDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;

    const dirScoreOpp = 1 - Math.abs(angleDiff - 180) / MAX_DIR_DEV_DEG;
    const dirScoreSame = 1 - Math.abs(angleDiff - 0) / MAX_DIR_DEV_DEG;
    const directionScore = clamp01(Math.max(dirScoreOpp, dirScoreSame));

    const parallelScore = clamp01(1 - avgMinDistKm / MAX_PARALLEL_DIST_KM);
    const endpointScore = clamp01(1 - endpointDistKm / MAX_ENDPOINT_DIST_KM);
    const score = 0.52 * parallelScore + 0.33 * directionScore + 0.15 * endpointScore;

    const avgMinDistReject = avgMinDistKm > MAX_PARALLEL_DIST_KM * 2;
    const endpointReject = endpointDistKm > MAX_ENDPOINT_DIST_KM * 2;
    const scoreReject = score < MIN_PAIR_SCORE;

    const onewayA = aFoundFeature?.properties?.oneway;
    const onewayB = bFoundFeature?.properties?.oneway;
    const onewayBicycleA = aFoundFeature?.properties?.['oneway:bicycle'];
    const onewayBicycleB = bFoundFeature?.properties?.['oneway:bicycle'];

    console.log(`\n[Geometry debug] pair ${a}+${b}`);
    console.log(
      `  tags: oneway(A=${onewayA}, oneway:bicycle(A)=${onewayBicycleA}) | oneway(B=${onewayB}, oneway:bicycle(B)=${onewayBicycleB})`
    );
    console.log(`  avgMinDistKm=${avgMinDistKm.toFixed(4)} (reject>${(MAX_PARALLEL_DIST_KM * 2).toFixed(4)} => ${avgMinDistReject})`);
    console.log(`  endpointDistKm=${endpointDistKm.toFixed(4)} (reject>${(MAX_ENDPOINT_DIST_KM * 2).toFixed(4)} => ${endpointReject})`);
    console.log(`  angleDiff=${angleDiff.toFixed(1)} directionScore=${directionScore.toFixed(3)}`);
    console.log(`  parallelScore=${parallelScore.toFixed(3)} endpointScore=${endpointScore.toFixed(3)} => score=${score.toFixed(3)} (MIN ${MIN_PAIR_SCORE} => ${scoreReject ? 'reject' : 'pass'})`);
  }

  console.log('\n=== Detailed Pair Results ===');
  for (const engineId of PARALLEL_DEDUPE_ENGINES) {
    console.log(`\n${engineId}`);
    for (const { a, b, ok, aStatus, bStatus } of results[engineId].enginePairs) {
      const aFound = aStatus.found ? `found x${aStatus.count}` : 'NOT FOUND';
      const bFound = bStatus.found ? `found x${bStatus.count}` : 'NOT FOUND';
      console.log(
        `  ways ${a} + ${b}: ${ok ? 'OK' : 'MISS'} (a=${aFound}, paired=${aStatus.paired}; b=${bFound}, paired=${bStatus.paired})`
      );
    }

    const violations = results[engineId].negativeStatuses.filter((s) => s.violates);
    if (violations.length > 0) {
      console.log('  Negative violations (paired=true but should not):');
      for (const v of violations) {
        console.log(`    way/${v.wayId}: paired=true (found x${v.status.count})`);
      }
    } else {
      console.log('  Negative violations: none');
    }

    const mustViolations = results[engineId].mustStatuses.filter((s) => s.violates);
    const mustMissing = results[engineId].mustStatuses.filter((s) => s.missing);
    console.log(
      `  Must-be-paired violations: ${mustViolations.length}/${MUST_BE_PAIRED_WAY_IDS.length} (missing ${mustMissing.length})`
    );
  }

  console.log('\n=== Final Summary Table (ciclovia + ciclofaixa only) ===');
  const gtTotalStr = gtTotalCicloviaCiclofaixa.toFixed(3);

  const pad = (s, n) => String(s).padEnd(n, ' ');
  const fmtKm = (n) => (Number.isFinite(n) ? n.toFixed(3) : '0.000');
  const signedDelta = (n) => {
    if (!Number.isFinite(n)) return '0.000';
    const s = n.toFixed(3);
    return n > 0 ? `+${s}` : s;
  };

  const header =
    `| ${pad('Engine', 18)} | ${pad('Pos OK', 6)} | ${pad('Neg Viol', 8)} | ${pad(
      'Must Viol',
      9
    )} | ${pad('Missing', 7)} | ${pad('TotalLen km', 12)} | ${pad('Delta vs GT', 14)} |`;
  const sep = '|' + '-'.repeat(header.length - 2) + '|';
  console.log(header);
  console.log(sep);

  for (const engineId of ENGINE_ORDER) {
    const r = results[engineId];
    const posOk = `${r.okCount}/${WAY_PAIRS.length}`;
    const negViol = `${r.negativePairedViolations}/${NEGATIVE_WAY_IDS.length}`;
    const mustViol = `${r.mustPairedViolations}/${MUST_BE_PAIRED_WAY_IDS.length}`;
    const missing = `${r.mustPairedMissing}`;
    const total = r.totalLenCicloviaCiclofaixa;
    const delta = total - gtTotalCicloviaCiclofaixa;

    console.log(
      `| ${pad(engineId, 18)} | ${pad(posOk, 6)} | ${pad(negViol, 8)} | ${pad(
        mustViol,
        9
      )} | ${pad(missing, 7)} | ${pad(fmtKm(total), 12)} | ${pad(
        signedDelta(delta),
        14
      )} |`
    );
  }

  console.log(
    `| ${pad('ground_truth', 18)} | ${pad(`${WAY_PAIRS.length}/${WAY_PAIRS.length}`, 6)} | ${pad('-', 8)} | ${pad(
      '-', // must
      9
    )} | ${pad('-', 7)} | ${pad(gtTotalStr, 12)} | ${pad('0.000', 14)} |`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

