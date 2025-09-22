/* eslint-disable no-loop-func */
import osmtogeojson from 'osmtogeojson'

import $ from 'jquery'

import { notification } from 'antd';

import {
    DEFAULT_BORDER_WIDTH,
    OVERPASS_SERVERS,
    AREA_ID_OVERRIDES,
} from './constants.js'
import { slugify } from './utils.js'

import * as layersDefinitions from './layers.json';

// Helper function to parse area name into city, state, country components
function parseAreaName(areaName) {
    // Split by comma and clean up whitespace
    const parts = areaName.split(',').map(part => part.trim());
    
    if (parts.length >= 3) {
        return {
            city: parts[0],
            state: parts[1],
            country: parts[2]
        };
    } else if (parts.length === 2) {
        return {
            city: parts[0],
            state: parts[1],
            country: parts[1] // Use state as country if no country specified
        };
    } else {
        return {
            city: parts[0],
            state: parts[0], // Use city as state if only one part
            country: parts[0] // Use city as country if only one part
        };
    }
}

class OSMController {
    // getQuery() converts our CicloMapa layers filter syntax to the OSM Overpass query syntax
    // Example:
    //      "filters": [
    //          [["highway","track"],["bicycle","designated"]],
    //          [["highway","track"],["bicycle","yes"]],
    //          [["highway","path"],["bicycle","designated"]],
    //          [["highway","path"],["bicycle","yes"]]
    //      ],
    //
    //  ...becomes:
    // 
    //      way["highway"="track"]["bicycle"="designated"](area.a);
    //      way["highway"="track"]["bicycle"="yes"](area.a);
    //      way["highway"="path"]["bicycle"="designated"](area.a);
    //      way["highway"="path"]["bicycle"="yes"](area.a);
    static getQuery(constraints) {
        const bbox = constraints.bbox;
        const areaId = constraints.areaId;
        const areaName = constraints.areaName;
        const filteredLayers = layersDefinitions.default.filter(l => l.filters);

        const body = filteredLayers.map(l =>
            (l.type === 'poi' ? ['node', 'way'] : ['way']).map( element =>
                l.filters.map(f =>
                    element
                    + (typeof f[0] === 'string' ?
                        `["${f[0]}"="${f[1]}"]`
                        :
                        f.map(f_inner =>
                            `["${f_inner[0]}"="${f_inner[1]}"]`
                        ).join(""))
                    + (bbox ? 
                        `(${bbox});\n`
                        :
                        `(area.a);\n`)
                ).join("")
            ).join("")
        ).join("");

        // Add boundary geometry query
        const boundaryQuery = areaName ? (() => {
            const { city, state, country } = parseAreaName(areaName);
            return `
                (
                    rel
                    ["boundary"="administrative"]
                    ["admin_level"~"^(6|7|8|9|10)$"]
                    ["name"="${city}"]
                    ["is_in:state"="${state}"]
                    ["is_in:country"="${country}"];
                    rel
                    ["boundary"="administrative"]
                    ["admin_level"~"^(6|7|8|9|10)$"]
                    ["name"="${city}"]
                    ["is_in:country"="${country}"];
                    rel
                    ["boundary"="administrative"]
                    ["admin_level"~"^(6|7|8|9|10)$"]
                    ["name"="${city}"];
                );
                map_to_area ->.cityArea;
                out geom;
            `;
        })() : '';

        return `
            [out:json][timeout:500];
            ${boundaryQuery}
            ${!bbox && `area(${areaId})->.a;`}
            (
                ${body}
            );
            out body geom;
        `;
    }

    static getLayers(isDarkMode, isDebugMode) {
        let layers = layersDefinitions.default;
        
        layers.forEach(l => {
            // Generate an ID based on name
            l.id = slugify(l.name);

            // Omitted values
            l.isActive = l.isActive !== undefined ? l.isActive : true;
            l.type = l.type || 'way';
            if (l.style) {
                l.style.lineColor = isDarkMode && l.style.lineColorDark ? l.style.lineColorDark : l.style.lineColor;
                l.style.textColor = isDarkMode && l.style.textColorDark ? l.style.textColorDark : l.style.textColor;
 
                l.style.lineStyle = l.style.lineStyle || 'solid';

                if (l.style.borderColor) { 
                    l.style.borderStyle = l.style.borderStyle || 'solid';
                    l.style.borderWidth = l.style.borderWidth || DEFAULT_BORDER_WIDTH;
                }
            }
        });

        if (!isDebugMode) {
            layers = layers.filter(l => !l.onlyDebug || l.onlyDebug && l.onlyDebug === false);
        }

        return layers;
    }

    static getAreaId(areaName) {
        return new Promise((resolve, reject) => {
            const overriden = AREA_ID_OVERRIDES[areaName];
            if (overriden) {
                resolve(overriden);
            } else {
                fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURI(areaName)}`)
                    .then( response => response.json() )
                    .then( nominatimData => {
                        console.debug('nominatimData', nominatimData);

                        if (nominatimData.length > 0) {
                            // This tries to replicate the behavior of the "geocodeArea" filter on Overpass Turbo.
                            // Gets the first 'relation' result from Nomatim and extract its corresponding area.
                            // Source: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#By_area_.28area.29
                            let osmId;
                            for(let i=0; i < nominatimData.length && osmId === undefined; i++) {
                                console.log('nominatimData[i]', nominatimData[i]);
                                if (nominatimData[i].osm_type === 'relation') {
                                    osmId = nominatimData[i].osm_id;
                                }
                            }
                            // Fallback if there's no relation in search results. Not sure if it's needed, but just in case.
                            if (!osmId) {
                                osmId = nominatimData[0].osm_id;
                            }
                            
                            let areaId = 3600000000 + osmId;
                            
                            resolve(areaId);
                        } else {
                            reject(new Error('Area not found'));
                        }
                        
                    })
                    .catch(e => {
                        console.error("Deu erro! Saca só:", e);
                        notification['error']({
                            message: 'Erro',
                            description: 'Ops, erro na API do Nominatim. Abra o console para ver mais detalhes.',
                        });
    
                        reject(e);
                    });
            }
        });
    }

    static getData(constraints) {
        let abortController = new AbortController();
        let isAborted = false;
        
        const promise = new Promise((resolve, reject) => {
            let geoJson;
            
            this.getAreaId(constraints.area)
                .then(areaId => {
                    if (isAborted) {
                        reject(new Error('Request aborted'));
                        return;
                    }
                    
                    const query = OSMController.getQuery({
                        areaId,
                        areaName: constraints.area
                    });
                    console.debug('generated query: ', query);
        
                    const encodedQuery = encodeURI(query);
        
                    let requests = [];
                    for (let i = 0; i < OVERPASS_SERVERS.length; i++) {
                        const endpoint = OVERPASS_SERVERS[i] + '?data=' + encodedQuery;
                        
                        console.debug(`[SERVER #${i}] ${OVERPASS_SERVERS[i]}`);
        
                        requests[i] = $.getJSON(
                            endpoint,
                            data => {
                                if (isAborted) {
                                    return;
                                }
                                
                                if (data.elements.length > 0) {
                                    console.debug(`[SERVER #${i}] Success!`);
                                    for (let r = 0; r < requests.length; r++) {
                                        if (r !== i) {
                                            console.debug(`[SERVER #${r}] Aborting`);
                                            requests[r].abort();
                                        }
                                    }
        
                                    console.debug('osm data: ', data);
                                    
                                    // Convert all data to GeoJSON without filtering
                                    geoJson = osmtogeojson({ elements: data.elements }, { flatProperties: true });
                                    
                                    console.debug('converted to geoJSON: ', geoJson);
                                    
                                    resolve({
                                        geoJson: geoJson
                                    });
                                } else {
                                    console.debug(`[SERVER #${i}] Empty result`);
        
                                    // Check if I'm the last one
                                    let isLastRemainingRequest = true;
                                    for (let r = 0; r < requests.length; r++) {
                                        if (r !== i) {
                                            if (requests[r].status === undefined) {
                                                isLastRemainingRequest = false;
                                            }
                                        }
                                    }
                                    if (isLastRemainingRequest) {
                                        console.debug(`[SERVER #${i}] I was the last one, so probably the result is empty.`);
                                        resolve({ 
                                            geoJson: null
                                        });
                                    }
                                }
                            }).fail(e => {
                                if (e.statusText !== 'abort' && !isAborted) {
                                    console.error(`[SERVER #${i}] Error:`, e);
                                }
                            });
                    }
                })
                .catch(e => {
                    if (!isAborted) {
                        console.error(e);
                        reject(e);
                    }
                });
        });
        
        // Add abort method to the promise
        promise.abort = () => {
            console.debug('OSM request aborted');
            isAborted = true;
            abortController.abort();
        };
        
        return promise;
    }
}

export default OSMController;