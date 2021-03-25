import pako from 'pako';
// import { gzip } from 'zlib';

import skmeans from 'skmeans';

import turfLength from '@turf/length';
import turfDistance from '@turf/distance';


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
    data.features.forEach(feature => {
        Object.keys(feature.properties).forEach(propertyKey => {
            if (propertyKey !== 'id' &&
                propertyKey !== 'name' &&
                propertyKey !== 'type')
                delete feature.properties[propertyKey];
        });
    });
}

export function cleanUpInternalTags(data) {
    data.features.forEach(feature => {
        Object.keys(feature.properties).forEach(propertyKey => {
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

    data.features.forEach(feature => {
        if (DEBUG) {
            console.debug(`${feature.properties.id} (${feature.properties.name})`);
        }

        if (!feature.properties.type) {
            // Reverse layers orders so the most important ones override less important ones.
            //   Slice is used here to don't destructively reverse the original array.
            layers
                .slice()
                .reverse()
                .filter(l => !!l.filters)
                .forEach(layer => {
                    let match = false;
                    layer.filters.forEach(filter => {
                        let partsToMatch;
                        if (typeof filter[0] === 'object') {
                            partsToMatch = [false, false];
                        } else {
                            partsToMatch = [false];
                        }

                        Object.keys(feature.properties).forEach(propertyKey => {
                            if (typeof filter[0] === 'object') {
                                if ((propertyKey === filter[0][0] &&
                                    feature.properties[propertyKey] === filter[0][1])) {
                                    partsToMatch[0] = true;
                                }

                                if ((propertyKey === filter[1][0] &&
                                    feature.properties[propertyKey] === filter[1][1])) {
                                    partsToMatch[1] = true;
                                }
                            } else {
                                if ((propertyKey === filter[0] &&
                                    feature.properties[propertyKey] === filter[1])) {
                                    partsToMatch[0] = true;
                                }
                            }
                        });

                        if ((typeof filter[0] === 'object' && partsToMatch[0] && partsToMatch[1])
                            || partsToMatch[0]) {
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

Math.toRadians = function(degrees) {
	return degrees * Math.PI / 180;
}

Math.toDegrees = function(radians) {
	return radians * 180 / Math.PI;
}

Math.toPositiveAngle = function(degrees) {
    if (degrees < 0) return degrees + 360;
    else return degrees;
}

Math.angleToVector = function(degrees) {
    const radians = Math.toRadians(degrees);
    const x = Math.cos(radians);
    const y = Math.sin(radians);
    return [x, y];
}

export function angleBetweenPoints(p1, p2) {
    const radians = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    return Math.toDegrees(radians);
}

export function averageOfAngles(angles) {
    let x = 0;
    let y = 0;
    angles.forEach(a => {
        let radians = Math.toRadians(a)
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
    segments.forEach(seg => {
        if (seg.properties.name && 
            (  (seg.properties['oneway:bicycle'] && seg.properties['oneway:bicycle'] === 'yes') 
            || (!seg.properties['oneway:bicycle'] && seg.properties.oneway && seg.properties.oneway === 'yes'))) {
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
        street.forEach(seg => {
            let segmentAngles = seg.geometry.coordinates.map((g, i, a) => {
                if (i < a.length - 1) return angleBetweenPoints(a[i], a[i + 1])
                else return undefined;
            });
            segmentAngles.pop(); // last item is undefined

            const avgAngle = averageOfAngles(segmentAngles);
            seg.properties['ciclomapa:angles'] = segmentAngles.map(a => angleToEmojiDirection(a)).join(', ');
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
                diff += (diff > 180) ? -360 : (diff < -180) ? 360 : 0;
                acc += Math.abs(diff);
            }
            return acc;
        }, 0)
        const avgAngleDelta = accAngleDelta / angles.length;

        street.forEach((seg, i) => {
            seg.properties['ciclomapa:accAngleDelta'] = accAngleDelta;
            seg.properties['ciclomapa:avgAngleDelta'] = avgAngleDelta;
        });

        // Clusterize angles to find sides A & B
        if (avgAngleDelta > MIN_AVG_ANGLE_TRESHOLD) {
            const vectors = angles.map(a => Math.angleToVector(a));
            const clusters = skmeans(vectors, 2)

            let clustersAnglesList = {a: [], b: []};

            street.forEach((seg, i) => {
                const side = clusters.idxs[i] ? 'a' : 'b';

                seg.properties['ciclomapa:duplicate_candidate'] = 'true';
                seg.properties['ciclomapa:side'] = side;

                clustersAnglesList[side].push(`${seg.properties['ciclomapa:avgAngle_direction']} ${seg.properties['ciclomapa:avgAngle']}`);
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
        street.forEach(seg => {
            seg.geometry.coordinates.forEach(p => {
                allPoints.push(p);
            });
        });

        let maxDist = 0;
        allPoints.forEach(p1 => {
            allPoints.forEach(p2 => {
                maxDist = Math.max(maxDist, turfDistance(p1, p2));
            })
        })

        street.forEach(seg => {
            seg.properties['ciclomapa:max_dist'] = maxDist;
            seg.properties['ciclomapa:max_dist_m'] = (maxDist * 1000).toFixed(2);
        });
    }

    return [
        segments,
        streetsByName
    ];
}

export function calculateLayersLengths(geoJson, layers, strategy) {
    let lengths = {};
    const geoJsonWithTypes = computeTypologies(geoJson, layers);

    console.debug('calculateLayersLengths()', strategy, geoJson, layers);
    
    // POI case: just count total number of elements
    layers
        .filter(l => l.type === 'poi')
        .forEach(l => {
            let segments = geoJsonWithTypes && geoJsonWithTypes.features ?
                    geoJsonWithTypes.features.filter(f => f.properties.type === l.name)
                    : [];
            
            lengths[l.id] = segments.length;
        })

    // Way case: go full-blown length computation
    layers
        .filter(l => l.type === 'way')
        .forEach(l => {
        lengths[l.id] = 0;

        // Use local classification to filter
        let segments = geoJsonWithTypes && geoJsonWithTypes.features ?
                geoJsonWithTypes.features.filter(f => f.properties.type === l.name)
                : [];

        // Calculate lengths
        segments.forEach(seg => {
            // Reset internal tags for when recalculating
            for (let k in seg.properties) {
                if (k.includes('ciclomapa')) {
                    delete seg.properties[k];
                }
            }

            const thisLength = turfLength(seg);
            seg.properties['ciclomapa:segment_length'] = thisLength;
            seg.properties['ciclomapa:segment_length_m'] = (thisLength * 1000).toFixed(2);
        })

        if (l.id === 'ciclovia' ||
            l.id === 'ciclofaixa' ||
            l.id === 'ciclorrota' ||
            l.id === 'calcada-compartilhada') {
            let streetsByName;
            [segments, streetsByName] = detectDoubleWayBikePaths(l, segments);

            // Sum total lengths for names streets
            for (let key in streetsByName) {
                const street = streetsByName[key];

                street.totalLength = 0;
                street.totalLengthSideA = 0;
                street.totalLengthSideB = 0;
                street.forEach(seg => {
                    street.totalLength += seg.properties['ciclomapa:segment_length'];
                    if (seg.properties['ciclomapa:side'] === 'a') {
                        street.totalLengthSideA += seg.properties['ciclomapa:segment_length'];
                    } else {
                        street.totalLengthSideB += seg.properties['ciclomapa:segment_length'];
                    }
                });
                street.forEach(seg => {
                    seg.properties['ciclomapa:dist_by_length_ratio'] = (seg.properties['ciclomapa:max_dist'] / street.totalLength).toFixed(2);

                    // Raw length = sum of segments lengths (thus, not real official length)
                    seg.properties['ciclomapa:total_raw_length'] = street.totalLength;
                    seg.properties['ciclomapa:total_raw_length__side_a'] = street.totalLengthSideA;
                    seg.properties['ciclomapa:total_raw_length__side_b'] = street.totalLengthSideB;

                    if (street.totalLengthSideA > street.totalLengthSideB) {
                        seg.properties['ciclomapa:bigger_side'] = 'a'
                        seg.properties['ciclomapa:smaller_side'] = 'b'
                    } else {
                        seg.properties['ciclomapa:bigger_side'] = 'b'
                        seg.properties['ciclomapa:smaller_side'] = 'a'
                    }

                    // Heuristic to detect false positives: when a street was clustered
                    //   as having 2 sides but actually it's a street that changes its
                    //   "hand" along itself.
                    if (seg.properties['ciclomapa:duplicate_candidate'] &&
                        seg.properties['ciclomapa:dist_by_length_ratio'] > DISTANCE_BY_LENGTH_RATIO_TRESHOLD) {
                        seg.properties['ciclomapa:ignored'] = 'true';
                        delete seg.properties['ciclomapa:duplicate_candidate'];
                        delete seg.properties['ciclomapa:side'];

                        street.falsePositive = true;
                    }
                });
            }

            // Sum up layer lengths
            if (strategy !== 'average') {
                segments.forEach(seg => {
                    if (!seg.properties['ciclomapa:duplicate_candidate']
                        || (strategy === 'pessimistic' && seg.properties['ciclomapa:side'] === seg.properties['ciclomapa:smaller_side']) 
                        || (strategy === 'optimistic' && seg.properties['ciclomapa:side'] === seg.properties['ciclomapa:bigger_side'])
                        || (strategy === 'random' && seg.properties['ciclomapa:side'] === 'a')) {
                        lengths[l.id] += seg.properties['ciclomapa:segment_length'];
                        seg.properties['ciclomapa:considered'] = 'true';
                    }
                })
            } else {
                // Sum all segments that are not part of duplicated streets 
                segments
                    .filter(seg => !seg.properties['ciclomapa:duplicate_candidate'])
                    .forEach(seg => {
                        lengths[l.id] += seg.properties['ciclomapa:segment_length'];
                        seg.properties['ciclomapa:considered'] = 'true';
                    });
                
                // Sum total length of duplicated streets
                for (let name in streetsByName) {
                    const street = streetsByName[name];
                    if (!street.falsePositive) {
                        lengths[l.id] += street.totalLength / 2;

                        // Tag all segments so we can visualize it
                        street.forEach(seg => {
                            seg.properties['ciclomapa:considered'] = 'true';
                        })
                    }
                }
            }
        }
    });

    return lengths;
}