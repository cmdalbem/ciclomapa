import pako from 'pako';
// import { gzip } from 'zlib';

const DEBUG = false;


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
    data.features.forEach(feature => {
        if (DEBUG) {
            console.debug(`${feature.properties.id} (${feature.properties.name})`);
        }

        if (!feature.properties.type) {
            layers.forEach(layer => {
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
                        feature.properties.type = layer.name;
                        match = true;
                        // console.debug(`.  .  → ${feature.properties.name} (${feature.properties.id}) = ${layer.name}`);
                    }

                    // console.debug(`.  .  ${filter} ${match ? '✓' : ''}`);
                });

                if (DEBUG) {
                    console.debug(`.  ${layer.name} ${match ? '👍' : ''}`);
                }
            });
        }
    });
}