import osmtogeojson from 'osmtogeojson'

import $ from 'jquery'

import { notification } from 'antd';

import { DEFAULT_BORDER_WIDTH } from './constants.js'
import { slugify } from './utils.js'

import * as layers from './layers.json';

class OSMController {
    static getQuery(constraints) {
        const bbox = constraints.bbox;
        const area = constraints.area.split(',')[0];

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
                    `(area.searchArea);\n`)
            ).join("")
        ).join("");

        return `
            [out:json][timeout:100];
            ${!bbox && `(area[name="${area}"];)->.searchArea;`}
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
                l.style.borderWidth = DEFAULT_BORDER_WIDTH;
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
            const query = OSMController.getQuery(constraints);
            console.debug('generated query: ', query);

            const encodedQuery = encodeURI(query);

            let geoJson;

            $.getJSON(
                // `https://overpass-api.de/api/interpreter?data=${encodedQuery}`,
                `https://overpass.kumi.systems/api/interpreter?data=${encodedQuery}`,
                data => {
                    console.debug('osm data: ', data);
                    geoJson = osmtogeojson(data, { flatProperties: true });
                    console.debug('converted to geoJSON: ', geoJson);

                    resolve({
                        geoJson: geoJson
                    });
                }
            ).fail(e => {
                console.error("Deu erro! Saca só:", e);
                notification['error']({
                    message: 'Erro',
                    description:
                        'Ops, erro do Overpass. Abra o console para ver mais detalhes.',
                });

                reject();
            })
        });
    }
}

export default OSMController;