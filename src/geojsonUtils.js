import pako from 'pako';
// import { gzip } from 'zlib';

import skmeans from 'skmeans';
 
import turfLength from '@turf/length';
import turfDistance from '@turf/distance';

const ERROR_THRESHOLD = 20;



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
        if (f.properties.name && f.properties.oneway && f.properties.oneway==='yes') {
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

        console.debug(l.name, key);
        
        // Calculate angles
        let angles = [];
        street.forEach(seg => {
            // console.debug(seg.geometry);

            let segmentAngles = seg.geometry.coordinates.map((g,i,a) => {
                if (i < a.length-1) return angleBetweenPoints(a[i], a[i+1])
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
            if (i < a.length-1) {
                let diff = cur - a[i + 1];
                // Compensate to get the smallest difference between angles
                diff += (diff > 180) ? -360 : (diff < -180) ? 360 : 0;
                acc += Math.abs(diff);
            }
            return acc;
        }, 0)
        const avgErrorDelta = accAngleDelta / angles.length;
        // console.debug('accAngleDelta', accAngleDelta);
        // console.debug('avgErrorDelta', avgErrorDelta);

        street.forEach((seg, i) => {
            seg.properties['ciclomapa:accAngleDelta'] = accAngleDelta;
            seg.properties['ciclomapa:avgErrorDelta'] = avgErrorDelta;
        });

        // Clusterize angles to find sides A & B
        if (avgErrorDelta > ERROR_THRESHOLD) {
            const clusters = skmeans(angles, 2)
            // console.debug(clusters);
            
            street.forEach((seg, i) => {
                seg.properties['ciclomapa:duplicate_candidate'] = 'yes';
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
                maxDist = Math.max(maxDist, turfDistance(p1,p2));
            })
        })

        street.forEach(seg => {
            seg.properties['ciclomapa:max_dist'] = maxDist;
            seg.properties['ciclomapa:max_dist_m'] = (maxDist*1000).toFixed(2);
        });
    }

    return features;
}

export function calculateLayersLengths(geoJson, layers) {
    let lengths = {};
    
    layers.forEach(l => {
        // Use local classification to filter
        let features = geoJson && geoJson.features ? 
            geoJson.features.filter(f => f.properties.type === l.name)
            : [];

        if (l.id === 'ciclovia' ||
            l.id === 'ciclofaixa' ||
            l.id === 'ciclorrota' ||
            l.id === 'calcada-compartilhada') {
            features = detectDoubleWayBikePaths(l, features);
        }
        
        // Calculate lengths
        let layerLength = 0;
        features.forEach(f => {
            if (!f.properties['ciclomapa:duplicate_candidate'] 
                || (f.properties['ciclomapa:side'] && f.properties['ciclomapa:side'] === 'a')) {
                const thisLength = turfLength(f);

                // @todo FIX ME we should compare the total length of the whole street, and not just the segment!!
                // Case when street is linear and there's no overlap between hands
                // Probably it's a street that changes hand in the middle
                // if (f.properties['ciclomapa:max_dist'] > length * 2) {
                //     console.debug('MAX DIST THREHOLD PASSED EINNNNN', f.properties.name);
                //     f.properties['ciclomapa:ignored'] = 'TRUE';
                //     f.properties['ciclomapa:side'] = 'b';
                // } else {
                    layerLength += thisLength;
                    f.properties['ciclomapa:length_m'] = (thisLength*1000).toFixed(2);
                // }
            }
        })

        lengths[l.id] = layerLength;
    });

    console.debug('TOTAL',
        lengths.ciclovia + 
        lengths.ciclofaixa + 
        lengths.ciclorrota + 
        lengths['calcada-compartilhada']);

    return lengths;
}