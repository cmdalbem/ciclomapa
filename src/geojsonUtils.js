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

export function computeTypologies(data, layers) {
    const DEBUG = false;

    if (!data || !data.features || data.features.length === 0) {
        return data;
    }

    data.features.forEach(feature => {
        if (DEBUG) {
            console.debug(`${feature.properties.id} (${feature.properties.name})`);
        }

        if (!feature.properties.type) {
            // Reverse layers orders so the most important ones override less important ones.
            //   Slice is used here to don't destructively reverse the original array.
            layers.slice().reverse().forEach(layer => {
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

export function angleBetweenPoints(p1, p2) {
    const rads = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
    const degs = rads * 180 / Math.PI
    return degs;

    // Convert to positives
    // if (degs < 0) return degs+360;
    // else return degs;
}

export function average(nums) {
    return nums.reduce((a, b) => (a + b)) / nums.length;
}

function detectDoubleWayBikePaths(l, features) {
    // Detect duplicates
    let streetsByName = {};
    features.forEach(f => {
        if (f.properties.name && f.properties.oneway && f.properties.oneway === 'yes') {
            if (streetsByName[f.properties.name]) {
                streetsByName[f.properties.name].push(f);
            } else {
                streetsByName[f.properties.name] = [f];
            }
        }
    });

    // Remove ways that have only 1 segment
    for (let key in streetsByName) {
        if (streetsByName[key].length < 2) {
            delete streetsByName[key];
        }
    }

    // Mark sides
    for (let key in streetsByName) {
        const street = streetsByName[key];

        // console.debug(l.name, key);

        // Calculate angles
        let angles = [];
        street.forEach(seg => {
            // console.debug(seg.geometry);

            let segmentAngles = seg.geometry.coordinates.map((g, i, a) => {
                if (i < a.length - 1) return angleBetweenPoints(a[i], a[i + 1])
                else return;
            });
            segmentAngles.pop(); // last item is undefined
            // console.debug(segmentAngles);

            const avgAngle = average(segmentAngles);
            seg.properties['ciclomapa:avgAngle'] = avgAngle;

            angles.push(avgAngle);
        });
        // console.debug(angles);

        // Try to avoid streets with 1 side only that have minor differences
        //  in their angles (average of differences is less than a threshold)
        const accAngleDelta = angles.reduce((acc, cur, i, a) => {
            // console.debug(acc, cur, i);
            if (i < a.length - 1) {
                let diff = cur - a[i + 1];
                // Compensate to get the smallest difference between angles
                diff += (diff > 180) ? -360 : (diff < -180) ? 360 : 0;
                acc += Math.abs(diff);
            }
            return acc;
        }, 0)
        const avgAngleDelta = accAngleDelta / angles.length;
        // console.debug('accAngleDelta', accAngleDelta);
        // console.debug('avgAngleDelta', avgAngleDelta);

        street.forEach((seg, i) => {
            seg.properties['ciclomapa:accAngleDelta'] = accAngleDelta;
            seg.properties['ciclomapa:avgAngleDelta'] = avgAngleDelta;
        });

        // Clusterize angles to find sides A & B
        if (avgAngleDelta > MIN_AVG_ANGLE_TRESHOLD) {
            const clusters = skmeans(angles, 2)
            // console.debug(clusters);

            street.forEach((seg, i) => {
                seg.properties['ciclomapa:duplicate_candidate'] = 'true';
                seg.properties['ciclomapa:side'] = clusters.idxs[i] ? 'a' : 'b';
            });
        }
    }

    // Calculate max distance of points
    for (let key in streetsByName) {
        const street = streetsByName[key];

        let allPoints = [];
        street.forEach(seg => {
            seg.geometry.coordinates.forEach(p => {
                allPoints.push(p);
            });
        });
        // console.debug(allPoints);

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
        features,
        streetsByName
    ];
}

export function calculateLayersLengths(geoJson, layers) {
    let lengths = {};

    layers.forEach(l => {
        lengths[l.id] = 0;

        // Use local classification to filter
        let features = geoJson && geoJson.features ?
            geoJson.features.filter(f => f.properties.type === l.name)
            : [];
        
        // Calculate lengths
        features.forEach(f => {
            const thisLength = turfLength(f);
            f.properties['ciclomapa:length'] = thisLength;
            f.properties['ciclomapa:length_m'] = (thisLength * 1000).toFixed(2);
        })

        if (l.id === 'ciclovia' ||
            l.id === 'ciclofaixa' ||
            l.id === 'ciclorrota' ||
            l.id === 'calcada-compartilhada') {
            let streetsByName;
            [features, streetsByName] = detectDoubleWayBikePaths(l, features);

            // Sum total lengths for names streets
            for (let key in streetsByName) {
                const street = streetsByName[key];

                street.totalLength = 0;
                street.forEach(seg => {
                    street.totalLength += seg.properties['ciclomapa:length'];
                });
                street.forEach(seg => {
                    // This is not the street official length, but the sum of segments lengths
                    seg.properties['ciclomapa:total_raw_length'] = street.totalLength;
                    seg.properties['ciclomapa:dist_by_length_ratio'] = (seg.properties['ciclomapa:max_dist']/street.totalLength).toFixed(2);

                    // Heuristic to detect false positives, when a street was clustered
                    //   as having 2 sides but actually it's a street thag changes its
                    //   "hand" along itself.
                    if (seg.properties['ciclomapa:duplicate_candidate'] &&
                        seg.properties['ciclomapa:dist_by_length_ratio'] > DISTANCE_BY_LENGTH_RATIO_TRESHOLD) {
                        seg.properties['ciclomapa:ignored'] = 'true';
                        delete seg.properties['ciclomapa:duplicate_candidate'];
                        delete seg.properties['ciclomapa:side'];
                    }
                });

                console.debug(street, street.totalLength);
            }
        }

        // Sum up layer lengths
        let layerLength = 0;
        features.forEach(f => {
            if (!f.properties['ciclomapa:duplicate_candidate']
                || (f.properties['ciclomapa:side'] && f.properties['ciclomapa:side'] === 'a')) {
                lengths[l.id] += f.properties['ciclomapa:length'];
            }
        })
    });

    console.debug('TOTAL',
        lengths.ciclovia +
        lengths.ciclofaixa +
        lengths.ciclorrota +
        lengths['calcada-compartilhada']);

    return lengths;
}