/* eslint-disable no-loop-func */
import osmtogeojson from 'osmtogeojson'

import $ from 'jquery'

import { notification } from 'antd';

import { DEFAULT_BORDER_WIDTH } from './constants.js'
import { slugify } from './utils.js'

import * as layers from './layers.json';

const servers = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'http://overpass.openstreetmap.fr/api/interpreter',
    'http://overpass.osm.ch/api/interpreter',
    'https://overpass.nchc.org.tw'
];

class OSMController {
    static getQuery(constraints) {
        const bbox = constraints.bbox;
        // const area = constraints.area.split(',')[0];
        const areaId = constraints.areaId;

        const body = layers.default.map(l =>
            l.filters.map(f =>
                'way'
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
        ).join("");

        return `
            [out:json][timeout:500];
            ${!bbox && `area(${areaId})->.a;`}
            (
                ${body}
            );
            out body geom;
        `;
    }

    static massageLayersData() {
        layers.default.forEach(l => {
            // Omitted values
            l.style.lineStyle = l.style.lineStyle || 'solid';
            l.isActive = l.isActive !== undefined ? l.isActive : true;

            if (l.style.borderColor) {
                l.style.borderStyle = l.style.borderStyle || 'solid';
                l.style.borderWidth = l.style.borderWidth || DEFAULT_BORDER_WIDTH;
            }
            
            // Generate an ID based on name
            l.id = slugify(l.name);
        });

        return layers.default;
    }

    static getLayers() {
        return this.massageLayersData();
    }

    static getData(constraints) {
        return new Promise((resolve, reject) => {
            let geoJson;

            $.getJSON(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURI(constraints.area)}`,
                nominatimData => {
                    console.debug('nominatimData', nominatimData);

                    // Source: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL#By_area_.28area.29
                    let areaId
                    if (constraints.area === 'Brasília, Distrito Federal, Brazil') {
                        areaId = 3600059470;
                    } else if (constraints.area === 'Vitória, Espirito Santo, Brazil') {
                        areaId = 3601825817;
                    } else {
                        areaId = 3600000000 + nominatimData[0].osm_id;
                    }

                    const query = OSMController.getQuery({ areaId: areaId});
                    
                    console.debug('generated query: ', query);

                    const encodedQuery = encodeURI(query);

                    let requests = [];
                    for (let i = 0; i < servers.length; i++) {
                        const endpoint = servers[i] + '?data=' + encodedQuery;
                        
                        console.debug(i + ' OSM server: ' + servers[i]);

                        requests[i] = $.getJSON(
                            endpoint,
                            data => {
                                if (data.elements.length > 0) {
                                    console.debug('SUCCESS! @ ' + i);
                                    for (let r = 0; r < requests.length; r++) {
                                        if (r !== i) {
                                            console.debug('Aborting ' + r);
                                            requests[r].abort();
                                        }
                                    }
    
                                    console.debug('osm data: ', data);
                                    geoJson = osmtogeojson(data, { flatProperties: true });
                                    console.debug('converted to geoJSON: ', geoJson);
                                    
                                    resolve({
                                        geoJson: geoJson
                                    });
                                } else {
                                    console.debug(`Server ${i} returned an empty result.`);

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
                                        console.debug('I was the last one, so probably the result is empty.');
                                        resolve({ geoJson: null });
                                    }
                                }
                            }).fail(e => {
                                if (e.statusText !== 'abort') {
                                    console.error(`Servidor ${i} deu erro:`, e);
                                }
                            });
                    }
                    
                    // console.error("Deu erro! Saca só:", e);
                    // notification['error']({
                    //     message: 'Erro',
                    //     description:
                    //         `Ops, erro na API do Overpass (erro ${e.status}). Abra o console para ver mais detalhes.`,
                    // });
                    // reject();

                }).fail(e => {
                    console.error("Deu erro! Saca só:", e);
                    notification['error']({
                        message: 'Erro',
                        description:
                            'Ops, erro na API do Nominatim. Abra o console para ver mais detalhes.',
                    });

                    reject();
                });
        });
    }
}

export default OSMController;