import osmtogeojson from 'osmtogeojson'

import $ from 'jquery'

class OSMController {
    static getQuery(bbox) {
        return `
        [out:json][timeout:100];
        (
            way["highway"="cycleway"](${bbox});
            way[highway~'path$|^footway$'][bicycle=designated](${bbox});

            way["cycleway"="track"](${bbox});
            way["cycleway:right"="track"](${bbox});
            way["cycleway:left"="track"](${bbox});

            way['cycleway'=lane](${bbox});
            way['cycleway:left'=lane](${bbox});
            way['cycleway:right'=lane](${bbox}); 

            way["cycleway"="opposite"](${bbox});

            way["cycleway"="opposite_lane"](${bbox});

            way["cycleway"="opposite_track"](${bbox});

            way["cycleway"="share_busway"](${bbox});

            way["cycleway"="opposite_share_busway"](${bbox});

            way["cycleway"="shared"](${bbox});
            way["cycleway:right"="shared"](${bbox});
            way["cycleway:left"="shared"](${bbox});

            way["cycleway"="shared_lane"](${bbox});
            way["cycleway:right"="shared_lane"](${bbox});
            way["cycleway:left"="shared_lane"](${bbox});

            way['cycleway'=cyclestreet](${bbox});
            way[bicycle_road=yes](${bbox});
            way[cyclestreet=yes](${bbox});

            way["maxspeed"="30"](${bbox});
        );
        out body geom;
    `;
    }

    static getData(bbox) {
        return new Promise((resolve, reject) => {
            const query = OSMController.getQuery(bbox);
            const encodedQuery = encodeURI(query);

            let geoJson;

            $.getJSON(
                // `https://overpass-api.de/api/interpreter?data=${encodedQuery}`,
                `https://overpass.kumi.systems/api/interpreter?data=${encodedQuery}`,
                data => {
                    console.log(data);

                    geoJson = osmtogeojson(data, { flatProperties: true });

                    console.log(geoJson);

                    resolve(geoJson);
                }
            ).fail(e => {
                console.log("Deu erro! Saca só:", e);
                alert('Overpass returned an error: ', e.statusText);
            })
        });
    }
}

export default OSMController;