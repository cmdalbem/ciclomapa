import pako from 'pako';
// import { gzip } from 'zlib';

import skmeans from 'skmeans';

import turfLength from '@turf/length';
import turfDistance from '@turf/distance';
import turfLineOverlap from '@turf/line-overlap';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import { IS_MOBILE, LENGTH_COUNTED_LAYER_IDS } from '../config/constants.js';

/** Lateral search radius for nearest-cyclepath coverage (~8 m). */
export const COVERAGE_MAX_LATERAL_KM = 0.008;
/** Max absolute heading difference (also treats opposite as aligned). */
export const COVERAGE_MAX_HEADING_DEG = 35;
/** Sample spacing along the route when attributing coverage. */
export const COVERAGE_SAMPLE_STEP_KM = 0.012;
/** Original city-GeoJSON matcher: turf lineOverlap tolerance (~1 m). */
export const COVERAGE_OVERLAP_TOLERANCE_KM = 0.001;

// 0 = all segments have exactly the same angle
const MIN_AVG_ANGLE_TRESHOLD = 20;

// 0.5 = a perfectly straight street that has two parallel sides with opposite hands
// 1 = a perfectly straight street that change its hand in the middle
const DISTANCE_BY_LENGTH_RATIO_TRESHOLD = 0.8;

export function gzipDecompress(data) {
  return JSON.parse(pako.inflate(data), { to: 'string' });
}

export function gzipCompress(data) {
  const compressed = pako.deflate(JSON.stringify(data), { to: 'string' });

  // Test if compression went OK
  // const decompressed = JSON.parse(pako.inflate(compressed), { to: 'string' });
  // console.log(decompressed);

  return compressed;
}

export function cleanUpOSMTags(data) {
  data.features.forEach((feature) => {
    Object.keys(feature.properties).forEach((propertyKey) => {
      if (propertyKey !== 'id' && propertyKey !== 'name' && propertyKey !== 'type')
        delete feature.properties[propertyKey];
    });
  });
}

export function cleanUpInternalTags(data) {
  data.features.forEach((feature) => {
    Object.keys(feature.properties).forEach((propertyKey) => {
      if (propertyKey.includes('ciclomapa')) {
        delete feature.properties[propertyKey];
      }
    });
  });
}

export function computeTypologies(data, layers) {
  const DEBUG = false;

  if (!data || !data.features || data.features.length === 0 || !layers) {
    console.error('computeTypologies(): missing parameters');
    return data;
  }

  data.features.forEach((feature) => {
    if (DEBUG) {
      console.debug(`${feature.properties.id} (${feature.properties.name})`);
    }

    if (!feature.properties.type) {
      // Reverse layers orders so the most important ones override less important ones.
      //   Slice is used here to don't destructively reverse the original array.
      layers
        .slice()
        .reverse()
        .filter((l) => !!l.filters)
        .forEach((layer) => {
          let match = false;
          layer.filters.forEach((filter) => {
            let partsToMatch;
            if (typeof filter[0] === 'object') {
              partsToMatch = [false, false];
            } else {
              partsToMatch = [false];
            }

            Object.keys(feature.properties).forEach((propertyKey) => {
              if (typeof filter[0] === 'object') {
                if (
                  propertyKey === filter[0][0] &&
                  feature.properties[propertyKey] === filter[0][1]
                ) {
                  partsToMatch[0] = true;
                }

                if (
                  propertyKey === filter[1][0] &&
                  feature.properties[propertyKey] === filter[1][1]
                ) {
                  partsToMatch[1] = true;
                }
              } else {
                if (propertyKey === filter[0] && feature.properties[propertyKey] === filter[1]) {
                  partsToMatch[0] = true;
                }
              }
            });

            if (
              (typeof filter[0] === 'object' && partsToMatch[0] && partsToMatch[1]) ||
              partsToMatch[0]
            ) {
              match = true;

              // "Proibido" layer should have priority over the rest
              if (!feature.properties.type || feature.properties.type !== 'Proibido') {
                feature.properties.type = layer.name;
              }
              // console.debug(`.  .  → ${feature.properties.name} (${feature.properties.id}) = ${layer.name}`);
            }

            // console.debug(`.  .  ${filter} ${match ? '✓' : ''}`);
          });

          if (DEBUG && match) {
            console.debug(`.  ${layer.name}`);
          }
        });
    }
  });

  return data;
}

Math.toRadians = function (degrees) {
  return (degrees * Math.PI) / 180;
};

Math.toDegrees = function (radians) {
  return (radians * 180) / Math.PI;
};

Math.toPositiveAngle = function (degrees) {
  if (degrees < 0) return degrees + 360;
  else return degrees;
};

Math.angleToVector = function (degrees) {
  const radians = Math.toRadians(degrees);
  const x = Math.cos(radians);
  const y = Math.sin(radians);
  return [x, y];
};

export function angleBetweenPoints(p1, p2) {
  const radians = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  return Math.toDegrees(radians);
}

export function averageOfAngles(angles) {
  let x = 0;
  let y = 0;
  angles.forEach((a) => {
    let radians = Math.toRadians(a);
    x += Math.cos(radians);
    y += Math.sin(radians);
  });

  const avgRadians = Math.atan2(y, x);
  const avgDegrees = Math.toDegrees(avgRadians);
  // const avgPositiveDegrees = Math.toPositiveAngle(avgDegrees);

  return avgDegrees;
}

export function angleToEmojiDirection(angle) {
  let char;

  angle = Math.toPositiveAngle(angle);

  if (angle > 0 && angle <= 22) {
    char = '➡️';
  } else if (angle > 22 && angle <= 67) {
    char = '↗️';
  } else if (angle > 67 && angle <= 112) {
    char = '⬆️';
  } else if (angle > 112 && angle <= 157) {
    char = '↖️';
  } else if (angle > 157 && angle <= 202) {
    char = '⬅️';
  } else if (angle > 202 && angle <= 247) {
    char = '↙️';
  } else if (angle > 247 && angle <= 292) {
    char = '⬇️';
  } else if (angle > 292 && angle <= 337) {
    char = '↘️';
  } else if (angle > 337 && angle <= 360) {
    char = '↘️';
  }

  return char;
}

function detectDoubleWayBikePaths(l, segments) {
  // Detect duplicates
  let streetsByName = {};
  segments.forEach((seg) => {
    if (
      seg.properties.name &&
      ((seg.properties['oneway:bicycle'] && seg.properties['oneway:bicycle'] === 'yes') ||
        (!seg.properties['oneway:bicycle'] &&
          seg.properties.oneway &&
          seg.properties.oneway === 'yes'))
    ) {
      // if (seg.properties.name && seg.properties.oneway && seg.properties.oneway === 'yes') {
      if (streetsByName[seg.properties.name]) {
        streetsByName[seg.properties.name].push(seg);
      } else {
        streetsByName[seg.properties.name] = [seg];
      }
    } else if (!seg.properties.name) {
      seg.properties['ciclomapa:unnamed'] = 'true';
    }
  });

  // Remove streets with only 1 segment
  for (let key in streetsByName) {
    if (streetsByName[key].length < 2) {
      delete streetsByName[key];
    }
  }

  // Mark sides
  for (let streetName in streetsByName) {
    const street = streetsByName[streetName];

    // Calculate angles
    let angles = [];
    street.forEach((seg) => {
      let segmentAngles = seg.geometry.coordinates.map((g, i, a) => {
        if (i < a.length - 1) return angleBetweenPoints(a[i], a[i + 1]);
        else return undefined;
      });
      segmentAngles.pop(); // last item is undefined

      const avgAngle = averageOfAngles(segmentAngles);
      seg.properties['ciclomapa:angles'] = segmentAngles
        .map((a) => angleToEmojiDirection(a))
        .join(', ');
      seg.properties['ciclomapa:avgAngle'] = avgAngle;
      seg.properties['ciclomapa:avgAngle_direction'] = angleToEmojiDirection(avgAngle);

      angles.push(avgAngle);
    });

    // Try to avoid streets with 1 side only that have minor differences
    //  in their angles (average of differences is less than a threshold)
    const accAngleDelta = angles.reduce((acc, cur, i, a) => {
      if (i < a.length - 1) {
        let diff = cur - a[i + 1];
        // Compensate to get the smallest difference between angles
        diff += diff > 180 ? -360 : diff < -180 ? 360 : 0;
        acc += Math.abs(diff);
      }
      return acc;
    }, 0);
    const avgAngleDelta = accAngleDelta / angles.length;

    street.forEach((seg, i) => {
      seg.properties['ciclomapa:accAngleDelta'] = accAngleDelta;
      seg.properties['ciclomapa:avgAngleDelta'] = avgAngleDelta;
    });

    // Clusterize angles to find sides A & B
    if (avgAngleDelta > MIN_AVG_ANGLE_TRESHOLD) {
      const vectors = angles.map((a) => Math.angleToVector(a));
      const clusters = skmeans(vectors, 2);

      let clustersAnglesList = { a: [], b: [] };

      street.forEach((seg, i) => {
        const side = clusters.idxs[i] ? 'a' : 'b';

        seg.properties['ciclomapa:duplicate_candidate'] = 'true';
        seg.properties['ciclomapa:side'] = side;

        clustersAnglesList[side].push(
          `${seg.properties['ciclomapa:avgAngle_direction']} ${seg.properties['ciclomapa:avgAngle']}`
        );
      });
    } else {
      // Since this street didn't meet basic criteria, we can stop
      //   considering it on all next checks and calculations.
      // @todo make absolute sure it's safe to delete an array element
      //   in the middle of a "for in" loop.
      delete streetsByName[streetName];
    }
  }

  // Calculate max distance of points
  for (let streetName in streetsByName) {
    const street = streetsByName[streetName];

    let allPoints = [];
    street.forEach((seg) => {
      seg.geometry.coordinates.forEach((p) => {
        allPoints.push(p);
      });
    });

    let maxDist = 0;
    allPoints.forEach((p1) => {
      allPoints.forEach((p2) => {
        maxDist = Math.max(maxDist, turfDistance(p1, p2));
      });
    });

    street.forEach((seg) => {
      seg.properties['ciclomapa:max_dist'] = maxDist;
      seg.properties['ciclomapa:max_dist_m'] = (maxDist * 1000).toFixed(2);
    });
  }

  return [segments, streetsByName];
}

export function calculateLayersLengths(geoJson, layers, strategy) {
  // Length math is skipped on mobile (heavy); callers treat an empty result as "no fresh lengths".
  // Still classify typologies so route coverage and cached geoJson keep feature.properties.type.
  if (IS_MOBILE) {
    computeTypologies(geoJson, layers);
    return {};
  }

  let lengths = {};
  const geoJsonWithTypes = computeTypologies(geoJson, layers);

  console.debug('calculateLayersLengths()', strategy, geoJson, layers);

  // POI case: just count total number of elements
  layers
    .filter((l) => l.type === 'poi')
    .forEach((l) => {
      let segments =
        geoJsonWithTypes && geoJsonWithTypes.features
          ? geoJsonWithTypes.features.filter((f) => f.properties.type === l.name)
          : [];

      lengths[l.id] = segments.length;
    });

  // Way case: go full-blown length computation
  layers
    .filter((l) => l.type === 'way')
    .forEach((l) => {
      lengths[l.id] = 0;

      // Use local classification to filter
      let segments =
        geoJsonWithTypes && geoJsonWithTypes.features
          ? geoJsonWithTypes.features.filter((f) => f.properties.type === l.name)
          : [];

      // Calculate lengths
      segments.forEach((seg) => {
        // Reset internal tags for when recalculating
        for (let k in seg.properties) {
          if (k.includes('ciclomapa')) {
            delete seg.properties[k];
          }
        }

        const thisLength = turfLength(seg);
        seg.properties['ciclomapa:segment_length'] = thisLength;
        seg.properties['ciclomapa:segment_length_m'] = (thisLength * 1000).toFixed(2);
      });

      if (LENGTH_COUNTED_LAYER_IDS.includes(l.id)) {
        let streetsByName;
        [segments, streetsByName] = detectDoubleWayBikePaths(l, segments);

        // Sum total lengths for names streets
        for (let key in streetsByName) {
          const street = streetsByName[key];

          street.totalLength = 0;
          street.totalLengthSideA = 0;
          street.totalLengthSideB = 0;
          street.forEach((seg) => {
            street.totalLength += seg.properties['ciclomapa:segment_length'];
            if (seg.properties['ciclomapa:side'] === 'a') {
              street.totalLengthSideA += seg.properties['ciclomapa:segment_length'];
            } else {
              street.totalLengthSideB += seg.properties['ciclomapa:segment_length'];
            }
          });
          street.forEach((seg) => {
            seg.properties['ciclomapa:dist_by_length_ratio'] = (
              seg.properties['ciclomapa:max_dist'] / street.totalLength
            ).toFixed(2);

            // Raw length = sum of segments lengths (thus, not real official length)
            seg.properties['ciclomapa:total_raw_length'] = street.totalLength;
            seg.properties['ciclomapa:total_raw_length__side_a'] = street.totalLengthSideA;
            seg.properties['ciclomapa:total_raw_length__side_b'] = street.totalLengthSideB;

            if (street.totalLengthSideA > street.totalLengthSideB) {
              seg.properties['ciclomapa:bigger_side'] = 'a';
              seg.properties['ciclomapa:smaller_side'] = 'b';
            } else {
              seg.properties['ciclomapa:bigger_side'] = 'b';
              seg.properties['ciclomapa:smaller_side'] = 'a';
            }

            // Heuristic to detect false positives: when a street was clustered
            //   as having 2 sides but actually it's a street that changes its
            //   "hand" along itself.
            if (
              seg.properties['ciclomapa:duplicate_candidate'] &&
              seg.properties['ciclomapa:dist_by_length_ratio'] > DISTANCE_BY_LENGTH_RATIO_TRESHOLD
            ) {
              seg.properties['ciclomapa:ignored'] = 'true';
              delete seg.properties['ciclomapa:duplicate_candidate'];
              delete seg.properties['ciclomapa:side'];

              street.falsePositive = true;
            }
          });
        }

        // Sum up layer lengths
        if (strategy !== 'average') {
          segments.forEach((seg) => {
            if (
              !seg.properties['ciclomapa:duplicate_candidate'] ||
              (strategy === 'pessimistic' &&
                seg.properties['ciclomapa:side'] === seg.properties['ciclomapa:smaller_side']) ||
              (strategy === 'optimistic' &&
                seg.properties['ciclomapa:side'] === seg.properties['ciclomapa:bigger_side']) ||
              (strategy === 'random' && seg.properties['ciclomapa:side'] === 'a')
            ) {
              lengths[l.id] += seg.properties['ciclomapa:segment_length'];
              seg.properties['ciclomapa:considered'] = 'true';
            }
          });
        } else {
          // Sum all segments that are not part of duplicated streets
          segments
            .filter((seg) => !seg.properties['ciclomapa:duplicate_candidate'])
            .forEach((seg) => {
              lengths[l.id] += seg.properties['ciclomapa:segment_length'];
              seg.properties['ciclomapa:considered'] = 'true';
            });

          // Sum total length of duplicated streets
          for (let name in streetsByName) {
            const street = streetsByName[name];
            if (!street.falsePositive) {
              lengths[l.id] += street.totalLength / 2;

              // Tag all segments so we can visualize it
              street.forEach((seg) => {
                seg.properties['ciclomapa:considered'] = 'true';
              });
            }
          }
        }
      }
    });

  return lengths;
}

/** Smallest angle between two headings, treating opposite directions as aligned. */
function alignedHeadingDiffDeg(a, b) {
  let d = Math.abs(a - b) % 360;
  if (d > 180) d = 360 - d;
  return Math.min(d, 180 - d);
}

function lineStringBbox(coords) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of coords) {
    if (c[0] < minX) minX = c[0];
    if (c[1] < minY) minY = c[1];
    if (c[0] > maxX) maxX = c[0];
    if (c[1] > maxY) maxY = c[1];
  }
  return [minX, minY, maxX, maxY];
}

/**
 * Walk a LineString and emit sample points every `stepKm` along its length.
 * Each sample carries the local segment bearing for heading checks.
 */
function sampleLineString(coords, stepKm) {
  const samples = [];
  let cum = 0;
  let nextAt = 0;

  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = turfDistance(a, b, { units: 'kilometers' });
    if (segLen < 1e-12) continue;
    const bearing = angleBetweenPoints(a, b);

    while (nextAt <= cum + segLen + 1e-12) {
      const t = Math.min(1, Math.max(0, (nextAt - cum) / segLen));
      samples.push({
        coordinates: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        bearing,
        along: nextAt,
      });
      nextAt += stepKm;
    }
    cum += segLen;
  }

  return { samples, routeLength: cum };
}

export const ROUTE_PAINT_STREET_TYPE = 'street';

function emptyCoverageResult() {
  return {
    coverage: 0,
    coverageByType: {},
    overlappingCyclepaths: [],
    routePaintSegments: [],
  };
}

function makePaintSegmentFeature(type, coords, lengthKm, index) {
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates: coords },
    properties: {
      debug_cyclepath_name: type,
      debug_cyclepath_type: type,
      debug_segment_index: index,
      debug_segment_length_km: lengthKm,
    },
  };
}

function filterCyclepathLineStrings(geoJson, layers) {
  const cyclepathLayerNames = layers
    .filter((layer) => LENGTH_COUNTED_LAYER_IDS.includes(layer.id))
    .map((layer) => layer.name);

  if (cyclepathLayerNames.length === 0) {
    console.error('No cyclepath layer names found');
    return { cyclepathLayerNames: [], cyclepathFeatures: [] };
  }

  const cyclepathFeatures = (geoJson?.features || []).filter(
    (feature) =>
      feature.properties?.type &&
      cyclepathLayerNames.includes(feature.properties.type) &&
      feature.geometry?.type === 'LineString' &&
      feature.geometry.coordinates?.length >= 2
  );

  return { cyclepathLayerNames, cyclepathFeatures };
}

function coveragePercentages(lengthByType, routeLength) {
  const coverageByTypePercentages = {};
  Object.keys(lengthByType).forEach((type) => {
    coverageByTypePercentages[type] = Math.min(
      Math.max((lengthByType[type] / routeLength) * 100, 0),
      100
    );
  });
  return coverageByTypePercentages;
}

/**
 * Original coverage matcher: sum every turf lineOverlap against the route.
 * Can double-count parallel lanes that both fall within `tolerance`.
 * Kept for A/B compare against the nearest-only matcher.
 */
export function calculateCyclepathCoverageByOverlap(
  route,
  geoJson,
  layers,
  { tolerance = COVERAGE_OVERLAP_TOLERANCE_KM } = {}
) {
  if (!route || !geoJson || !layers) {
    console.error('Missing data for cyclepath coverage calculation:', {
      route: !!route,
      geoJson: !!geoJson,
      layers: !!layers,
    });
    return emptyCoverageResult();
  }

  const { cyclepathLayerNames, cyclepathFeatures } = filterCyclepathLineStrings(geoJson, layers);
  if (cyclepathLayerNames.length === 0) return emptyCoverageResult();
  if (cyclepathFeatures.length === 0) {
    console.error('No cyclepath features found after filtering');
    return emptyCoverageResult();
  }

  const coverageByType = {};
  cyclepathLayerNames.forEach((layerName) => {
    coverageByType[layerName] = 0;
  });

  const routeLength = turfLength(route, { units: 'kilometers' });
  if (routeLength === 0) return emptyCoverageResult();

  let totalOverlapLength = 0;
  const overlapSegments = [];

  cyclepathFeatures.forEach((cyclepath, index) => {
    try {
      const overlap = turfLineOverlap(route, cyclepath, { tolerance });
      if (!overlap?.features?.length) return;

      overlap.features.forEach((segment, segIndex) => {
        const segmentLength = turfLength(segment, { units: 'kilometers' });
        totalOverlapLength += segmentLength;

        const cyclepathType = cyclepath.properties.type;
        if (coverageByType.hasOwnProperty(cyclepathType)) {
          coverageByType[cyclepathType] += segmentLength;
        }

        overlapSegments.push({
          ...segment,
          properties: {
            debug_cyclepath_index: index,
            debug_cyclepath_name:
              cyclepath.properties.name || cyclepath.properties.ref || 'Unnamed',
            debug_cyclepath_type: cyclepath.properties.type,
            debug_segment_index: segIndex,
            debug_segment_length_km: segmentLength,
          },
        });
      });
    } catch (error) {
      console.error('Error calculating overlap with cyclepath:', error);
    }
  });

  return {
    coverage: Math.min(Math.max((totalOverlapLength / routeLength) * 100, 0), 100),
    coverageByType: coveragePercentages(coverageByType, routeLength),
    overlappingCyclepaths: overlapSegments,
  };
}

/**
 * Coverage via nearest-only attribution: sample the route, pick the closest
 * cyclepath within a moderate lateral radius whose heading roughly matches,
 * and count that length once. Avoids double-counting parallel lanes that
 * lineOverlap would both match under a wide tolerance.
 *
 * @param {Object} route - GeoJSON LineString geometry (or Feature)
 * @param {Object} geoJson - GeoJSON FeatureCollection containing cyclepath data
 * @param {Array} layers - Layer definitions from layers.json
 * @param {Object} [options]
 * @param {number} [options.maxLateralKm]
 * @param {number} [options.maxHeadingDeg]
 * @param {number} [options.sampleStepKm]
 * @returns {Object} - { coverage, coverageByType, overlappingCyclepaths }
 */
export function calculateCyclepathCoverage(
  route,
  geoJson,
  layers,
  {
    maxLateralKm = COVERAGE_MAX_LATERAL_KM,
    maxHeadingDeg = COVERAGE_MAX_HEADING_DEG,
    sampleStepKm = COVERAGE_SAMPLE_STEP_KM,
  } = {}
) {
  if (!route || !geoJson || !layers) {
    console.error('Missing data for cyclepath coverage calculation:', {
      route: !!route,
      geoJson: !!geoJson,
      layers: !!layers,
    });
    return { coverage: 0, coverageByType: {}, overlappingCyclepaths: [] };
  }

  const routeCoords = route.type === 'Feature' ? route.geometry?.coordinates : route.coordinates;
  if (!routeCoords || routeCoords.length < 2) {
    return { coverage: 0, coverageByType: {}, overlappingCyclepaths: [] };
  }

  const cyclepathLayerNames = layers
    .filter((layer) => LENGTH_COUNTED_LAYER_IDS.includes(layer.id))
    .map((layer) => layer.name);

  if (cyclepathLayerNames.length === 0) {
    console.error('No cyclepath layer names found');
    return { coverage: 0, coverageByType: {}, overlappingCyclepaths: [] };
  }

  // ~meters → degrees pad for bbox prefilter (generous; heading/distance do the real cut)
  const padDeg = (maxLateralKm * 1000) / 80_000;
  const cyclepathFeatures = [];
  for (const feature of geoJson.features) {
    if (
      !feature.properties?.type ||
      !cyclepathLayerNames.includes(feature.properties.type) ||
      !feature.geometry ||
      feature.geometry.type !== 'LineString' ||
      !feature.geometry.coordinates?.length
    ) {
      continue;
    }
    cyclepathFeatures.push({
      feature,
      bbox: lineStringBbox(feature.geometry.coordinates),
    });
  }

  if (cyclepathFeatures.length === 0) {
    console.error('No cyclepath features found after filtering');
    return { coverage: 0, coverageByType: {}, overlappingCyclepaths: [] };
  }

  const coverageByType = {};
  cyclepathLayerNames.forEach((layerName) => {
    coverageByType[layerName] = 0;
  });

  const { samples, routeLength } = sampleLineString(routeCoords, sampleStepKm);
  if (routeLength === 0 || samples.length === 0) {
    return { coverage: 0, coverageByType: {}, overlappingCyclepaths: [] };
  }

  let totalCoveredLength = 0;
  const matched = []; // per-sample winner for building debug segments

  for (let s = 0; s < samples.length; s++) {
    const sample = samples[s];
    const nextAlong = s + 1 < samples.length ? samples[s + 1].along : routeLength;
    const segmentLen = Math.max(0, nextAlong - sample.along);
    const [lng, lat] = sample.coordinates;
    const point = {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: sample.coordinates },
      properties: {},
    };

    let best = null;
    for (let ci = 0; ci < cyclepathFeatures.length; ci++) {
      const { feature, bbox } = cyclepathFeatures[ci];
      if (
        lng < bbox[0] - padDeg ||
        lng > bbox[2] + padDeg ||
        lat < bbox[1] - padDeg ||
        lat > bbox[3] + padDeg
      ) {
        continue;
      }

      let snapped;
      try {
        snapped = nearestPointOnLine(feature, point, { units: 'kilometers' });
      } catch {
        continue;
      }
      const dist = snapped?.properties?.dist;
      if (dist == null || dist > maxLateralKm) continue;

      const idx = Math.min(snapped.properties.index ?? 0, feature.geometry.coordinates.length - 2);
      const cpBearing = angleBetweenPoints(
        feature.geometry.coordinates[idx],
        feature.geometry.coordinates[idx + 1]
      );
      if (alignedHeadingDiffDeg(sample.bearing, cpBearing) > maxHeadingDeg) continue;

      if (!best || dist < best.dist) {
        best = { dist, feature, index: ci, snapped };
      }
    }

    const endCoords =
      s + 1 < samples.length ? samples[s + 1].coordinates : routeCoords[routeCoords.length - 1];

    if (best && segmentLen > 0) {
      totalCoveredLength += segmentLen;
      const cyclepathType = best.feature.properties.type;
      if (coverageByType.hasOwnProperty(cyclepathType)) {
        coverageByType[cyclepathType] += segmentLen;
      }
      matched.push({
        startCoords: sample.coordinates,
        endCoords,
        segmentLen,
        cyclepathIndex: best.index,
        cyclepath: best.feature,
      });
    } else {
      matched.push(null);
    }
  }

  // Stitch consecutive samples that hit the same cyclepath into debug LineStrings
  const overlapSegments = [];
  let run = null;
  const flushRun = () => {
    if (!run || run.coords.length < 2) {
      run = null;
      return;
    }
    overlapSegments.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: run.coords },
      properties: {
        debug_cyclepath_index: run.cyclepathIndex,
        debug_cyclepath_name:
          run.cyclepath.properties.name || run.cyclepath.properties.ref || 'Unnamed',
        debug_cyclepath_type: run.cyclepath.properties.type,
        debug_segment_index: overlapSegments.length,
        debug_segment_length_km: run.lengthKm,
      },
    });
    run = null;
  };

  for (const hit of matched) {
    if (!hit) {
      flushRun();
      continue;
    }
    if (!run || run.cyclepathIndex !== hit.cyclepathIndex) {
      flushRun();
      run = {
        cyclepathIndex: hit.cyclepathIndex,
        cyclepath: hit.cyclepath,
        coords: [hit.startCoords, hit.endCoords],
        lengthKm: hit.segmentLen,
      };
    } else {
      run.coords.push(hit.endCoords);
      run.lengthKm += hit.segmentLen;
    }
  }
  flushRun();

  const coverageByTypePercentages = {};
  Object.keys(coverageByType).forEach((type) => {
    coverageByTypePercentages[type] = Math.min(
      Math.max((coverageByType[type] / routeLength) * 100, 0),
      100
    );
  });

  return {
    coverage: Math.min(Math.max((totalCoveredLength / routeLength) * 100, 0), 100),
    coverageByType: coverageByTypePercentages,
    overlappingCyclepaths: overlapSegments,
  };
}

/** GraphHopper details intervals: [fromIndex, toIndex) into the route coordinates. */
function detailValueAt(intervals, index) {
  if (!Array.isArray(intervals)) return null;
  for (const entry of intervals) {
    if (!Array.isArray(entry) || entry.length < 3) continue;
    const [from, to, value] = entry;
    if (index >= from && index < to) return value;
  }
  return null;
}

function typologyFromGhDetails(roadClass, bikeNetwork) {
  const rc = String(roadClass || '').toLowerCase();
  const net = String(bikeNetwork || '').toLowerCase();
  if (rc === 'cycleway') return 'Ciclovia';
  if (net && net !== 'missing' && net !== 'other') return 'Ciclorrota';
  return null;
}

/**
 * Coverage from GraphHopper path details (no geometric snap).
 * Stock GH only distinguishes dedicated cycleway vs signed bike network.
 */
export function calculateCyclepathCoverageFromPathDetails(route, pathDetails, layers) {
  const coords = route?.type === 'Feature' ? route.geometry?.coordinates : route?.coordinates;
  if (!coords || coords.length < 2 || !pathDetails || !layers) {
    return emptyCoverageResult();
  }

  const { cyclepathLayerNames } = filterCyclepathLineStrings({ features: [] }, layers);
  const coverageByType = {};
  cyclepathLayerNames.forEach((name) => {
    coverageByType[name] = 0;
  });

  const routeLength = turfLength(
    { type: 'Feature', geometry: { type: 'LineString', coordinates: coords }, properties: {} },
    { units: 'kilometers' }
  );
  if (routeLength === 0) return emptyCoverageResult();

  const roadClass = pathDetails.road_class;
  const bikeNetwork = pathDetails.bike_network;
  let totalCovered = 0;
  const paintSegments = [];
  let run = null;

  const flush = () => {
    if (!run || run.coords.length < 2) {
      run = null;
      return;
    }
    paintSegments.push(
      makePaintSegmentFeature(run.type, run.coords, run.lengthKm, paintSegments.length)
    );
    run = null;
  };

  for (let i = 0; i < coords.length - 1; i++) {
    const infraType = typologyFromGhDetails(
      detailValueAt(roadClass, i),
      detailValueAt(bikeNetwork, i)
    );
    const segLen = turfDistance(coords[i], coords[i + 1], { units: 'kilometers' });
    if (segLen <= 0) continue;
    const paintType = infraType || ROUTE_PAINT_STREET_TYPE;
    if (infraType) {
      totalCovered += segLen;
      if (coverageByType.hasOwnProperty(infraType)) coverageByType[infraType] += segLen;
    }
    if (!run || run.type !== paintType) {
      flush();
      run = { type: paintType, coords: [coords[i], coords[i + 1]], lengthKm: segLen };
    } else {
      run.coords.push(coords[i + 1]);
      run.lengthKm += segLen;
    }
  }
  flush();

  return {
    coverage: Math.min(Math.max((totalCovered / routeLength) * 100, 0), 100),
    coverageByType: coveragePercentages(coverageByType, routeLength),
    overlappingCyclepaths: paintSegments.filter(
      (f) => f.properties.debug_cyclepath_type !== ROUTE_PAINT_STREET_TYPE
    ),
    routePaintSegments: paintSegments,
  };
}

export function parseOsmTagString(tagString) {
  const properties = {};
  if (!tagString) return properties;
  for (const part of String(tagString).split(/\s+/)) {
    const eq = part.indexOf('=');
    if (eq > 0) properties[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return properties;
}

function typologyFromOsmProperties(properties, layers) {
  const collection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { ...properties },
        geometry: {
          type: 'LineString',
          coordinates: [
            [0, 0],
            [0.0001, 0],
          ],
        },
      },
    ],
  };
  computeTypologies(collection, layers);
  return collection.features[0].properties.type || null;
}

/**
 * Walk a LineString and return the sub-linestring covering [startKm, endKm]
 * along its length (kilometers).
 */
function sliceLineStringByDistanceKm(coords, startKm, endKm) {
  if (!coords || coords.length < 2 || endKm <= startKm) return null;

  const out = [];
  let cum = 0;
  let started = false;

  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const segLen = turfDistance(a, b, { units: 'kilometers' });
    if (segLen < 1e-12) continue;
    const segEnd = cum + segLen;

    if (!started && segEnd > startKm) {
      const t = Math.min(1, Math.max(0, (startKm - cum) / segLen));
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      started = true;
    }

    if (started) {
      if (segEnd >= endKm) {
        const t = Math.min(1, Math.max(0, (endKm - cum) / segLen));
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        break;
      }
      out.push(b);
    }

    cum = segEnd;
  }

  return out.length >= 2 ? out : null;
}

/**
 * Coverage from BRouter message rows (WayTags + Distance). No geometric snap.
 * Distance is meters. Paint highlights by slicing the dense route geometry so we
 * don't chord straight between sparse message nodes (that looked "off street").
 *
 * @param {Array} messages - BRouter properties.messages
 * @param {Array} layers
 * @param {Object} [routeGeometry] - LineString geometry from the same BRouter response
 */
export function calculateCyclepathCoverageFromBrouterMessages(messages, layers, routeGeometry) {
  if (!Array.isArray(messages) || messages.length < 2 || !layers) {
    return emptyCoverageResult();
  }

  const header = messages[0];
  const wayIdx = header.indexOf('WayTags');
  const distIdx = header.indexOf('Distance');
  if (wayIdx < 0 || distIdx < 0) return emptyCoverageResult();

  const routeCoords =
    routeGeometry?.type === 'LineString' ? routeGeometry.coordinates : routeGeometry?.coordinates;
  const useRouteGeom = Array.isArray(routeCoords) && routeCoords.length >= 2;

  const { cyclepathLayerNames } = filterCyclepathLineStrings({ features: [] }, layers);
  const coverageByType = {};
  cyclepathLayerNames.forEach((name) => {
    coverageByType[name] = 0;
  });

  let routeLengthKm = 0;
  let totalCovered = 0;
  const paintSegments = [];
  let run = null; // { type, startKm, endKm, lengthKm }

  const flush = () => {
    if (!run || run.endKm <= run.startKm) {
      run = null;
      return;
    }
    const coords = useRouteGeom
      ? sliceLineStringByDistanceKm(routeCoords, run.startKm, run.endKm)
      : null;
    if (!coords || coords.length < 2) {
      run = null;
      return;
    }
    paintSegments.push(
      makePaintSegmentFeature(run.type, coords, run.lengthKm, paintSegments.length)
    );
    run = null;
  };

  let cumKm = 0;
  for (let i = 1; i < messages.length; i++) {
    const row = messages[i];
    if (!Array.isArray(row)) continue;
    const distM = Number(row[distIdx]);
    const segKm = Number.isFinite(distM) ? distM / 1000 : 0;
    if (segKm <= 0) continue;
    const startKm = cumKm;
    cumKm += segKm;
    routeLengthKm = cumKm;

    let infraType = null;
    try {
      infraType = typologyFromOsmProperties(parseOsmTagString(row[wayIdx]), layers);
    } catch (err) {
      console.warn('BR tags typology failed for message row', err);
    }
    if (infraType && !cyclepathLayerNames.includes(infraType)) infraType = null;

    const paintType = infraType || ROUTE_PAINT_STREET_TYPE;
    if (infraType) {
      if (coverageByType.hasOwnProperty(infraType)) coverageByType[infraType] += segKm;
      totalCovered += segKm;
    }

    if (!run || run.type !== paintType) {
      flush();
      run = { type: paintType, startKm, endKm: cumKm, lengthKm: segKm };
    } else {
      run.endKm = cumKm;
      run.lengthKm += segKm;
    }
  }
  flush();

  if (routeLengthKm === 0) return emptyCoverageResult();

  return {
    coverage: Math.min(Math.max((totalCovered / routeLengthKm) * 100, 0), 100),
    coverageByType: coveragePercentages(coverageByType, routeLengthKm),
    overlappingCyclepaths: paintSegments.filter(
      (f) => f.properties.debug_cyclepath_type !== ROUTE_PAINT_STREET_TYPE
    ),
    routePaintSegments: useRouteGeom ? paintSegments : [],
  };
}
