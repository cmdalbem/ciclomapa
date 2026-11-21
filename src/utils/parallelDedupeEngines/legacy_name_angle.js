import skmeans from 'skmeans';
import turfDistance from '@turf/distance';

const MIN_AVG_ANGLE_TRESHOLD = 20;

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
  const x = Math.cos(radians);
  const y = Math.sin(radians);
  return [x, y];
}

function angleBetweenPoints(p1, p2) {
  const radians = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
  return toDegrees(radians);
}

function averageOfAngles(angles) {
  // Compute average direction via vector mean (handles wrap-around)
  let x = 0;
  let y = 0;
  angles.forEach((a) => {
    const radians = toRadians(a);
    x += Math.cos(radians);
    y += Math.sin(radians);
  });

  const avgRadians = Math.atan2(y, x);
  return toDegrees(avgRadians);
}

function angleToEmojiDirection(angle) {
  let char;

  angle = toPositiveAngle(angle);

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

export function run({ layer, segments }) {
  // `layer` is accepted for API consistency with other engines.
  // This legacy engine relies solely on geometry + a few OSM tags in `seg.properties`.
  void layer;

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
      const coords = seg.geometry.coordinates;
      const segmentAngles = coords
        .slice(0, -1)
        .map((p, i) => angleBetweenPoints(coords[i], coords[i + 1]));

      const avgAngle = averageOfAngles(segmentAngles);
      seg.properties['ciclomapa:angles'] = segmentAngles
        .map((a) => angleToEmojiDirection(a))
        .join(', ');
      seg.properties['ciclomapa:avgAngle'] = avgAngle;
      seg.properties['ciclomapa:avgAngle_direction'] = angleToEmojiDirection(avgAngle);

      angles.push(avgAngle);
    });

    // Try to avoid streets with 1 side only that have minor differences
    // in their angles (average of differences is less than a threshold)
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

    street.forEach((seg) => {
      seg.properties['ciclomapa:accAngleDelta'] = accAngleDelta;
      seg.properties['ciclomapa:avgAngleDelta'] = avgAngleDelta;
    });

    // Clusterize angles to find sides A & B
    if (avgAngleDelta > MIN_AVG_ANGLE_TRESHOLD) {
      const vectors = angles.map((a) => angleToVector(a));
      const clusters = skmeans(vectors, 2);

      street.forEach((seg, i) => {
        const side = clusters.idxs[i] ? 'a' : 'b';

        seg.properties['ciclomapa:duplicate_candidate'] = 'true';
        seg.properties['ciclomapa:side'] = side;
        seg.properties['ciclomapa:match_confidence_bucket'] = 'med';
      });
    } else {
      // Since this street didn't meet basic criteria, we can stop
      // considering it on all next checks and calculations.
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
