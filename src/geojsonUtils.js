import pako from 'pako';
// import { gzip } from 'zlib';

import skmeans from 'skmeans';
 
import turfLength from '@turf/length';


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
    return Math.atan2(p2[1] - p1[1], p2[0] - p1[0]) * 180 / Math.PI;
}

export function calculateLayersLengths(geoJson, layers) {
    const ERROR_THRESHOLD = 20;

    let lengths = {};
    
    layers.forEach(l => {
        // Use local classification to filter
        const features = geoJson && geoJson.features ? 
            geoJson.features.filter(f => f.properties.type === l.name)
            : [];
        
        // Detect duplicates
        let waysByName = {};
        features.forEach(f => {
            if (f.properties.name && f.properties.oneway && f.properties.oneway==='yes') {
                if (waysByName[f.properties.name]) {
                    waysByName[f.properties.name].push(f);
                } else {
                    waysByName[f.properties.name] = [f];
                }
            }
        });
        
        // Remove ways that have only 1 segment
        for (let key in waysByName) {
            if (waysByName[key].length < 2) {
                delete waysByName[key];
            }
        }
        
        // Mark sides
        for (let key in waysByName) {
            const way = waysByName[key];

            console.debug(l.name, key);
            
            let angles = [];
            way.forEach(w => {
                const angle = angleBetweenPoints(w.geometry.coordinates[0], w.geometry.coordinates[1]);
                w.properties['ciclomapa:angle'] = angle;
                angles.push(angle);
            });
            console.debug(angles);

            // Try to avoid streets with 1 side onlye
            const accDifferences = angles.reduce((acc, cur, i, a) => {
                console.debug(acc, cur, i);
                if (i < a.length-1) {
                    return acc + Math.abs(cur - a[i+1]);
                } else {
                    return acc;
                }
            }, 0)
            const avgError = accDifferences / angles.length;
            console.debug('accDifferences', accDifferences);
            console.debug('avgError', avgError);

            way.forEach((w, i) => {
                w.properties['ciclomapa:accDifferences'] = accDifferences;
                w.properties['ciclomapa:avgError'] = avgError;
            });

            if (avgError > ERROR_THRESHOLD) {
                // angles = angles.map(a => [Math.cos(a), Math.sen(a)]);
                const clusters = skmeans(angles, 2)
                console.debug(clusters);
                
                way.forEach((w, i) => {
                    w.properties['ciclomapa:duplicate_candidate'] = 'yes';
                    w.properties['ciclomapa:side'] = clusters.idxs[i] ? 'a' : 'b';
                });
            }
        }
        
        // Calculate lengths
        let length = 0;
        features.forEach(f => {
            if (!f.properties['ciclomapa:duplicate_candidate'] 
                || (f.properties['ciclomapa:side'] && f.properties['ciclomapa:side'] === 'a')) {
                const thisLength = turfLength(f);
                length += thisLength;
                f.properties['ciclomapa:comprimento'] = thisLength;
            }
        })

        lengths[l.id] = length;
    });

    console.debug('TOTAL',
        lengths.ciclovia + 
        lengths.ciclofaixa + 
        lengths.ciclorrota + 
        lengths['calcada-compartilhada']);

    return lengths;
}