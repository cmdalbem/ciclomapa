import osmtogeojson from 'osmtogeojson'

import $ from 'jquery'

class OSMController {
    static getQuery(bbox) {
        return `
        [out:json][timeout:100];
        (
            // Quando a ciclovia é mapeada separadamente da estrada (veja Bicicleta).
            way["highway"="cycleway"](${bbox});
            way[highway~'path$|^footway$'][bicycle=designated](${bbox});

            // A trilha é uma rota que é separado da estrada.
            way["cycleway"="track"](${bbox});
            way["cycleway:right"="track"](${bbox});
            way["cycleway:left"="track"](${bbox});

            // A lane é uma rota que se encontra dentro da pista	
            way['cycleway'=lane](${bbox});
            way['cycleway:left'=lane](${bbox});
            way['cycleway:right'=lane](${bbox});

            // Usada em vias com oneway=yes onde é permitido pedalar em ambos os sentidos (só em países onde é legalmente permitido).	
            way["cycleway"="opposite"](${bbox});

            // Utilizadas em formas com oneway=yes, que tem uma pista de ciclismo indo na direção oposta do fluxo de tráfego normal (um "contramão" da pista)	
            way["cycleway"="opposite_lane"](${bbox});

            // Usada em vias com oneway=yes com uma ciclovia separada indo no sentido oposto ao do tráfego normal}.	
            way["cycleway"="opposite_track"](${bbox});

            // There is a bus lane that cyclists are permitted to use.	
            way["cycleway"="share_busway"](${bbox});

            // Usada em vias com oneway=yes que tèm uma faixa de ônibus/autocarro em que os ciclistas também podem usar, e que vão no sentido oposto do sentido normal do trânsito. Usado junto com oneway:bicycle=no.	
            way["cycleway"="opposite_share_busway"](${bbox});

            // Cyclists share space with other traffic on this highway.	
            way["cycleway"="shared"](${bbox});
            way["cycleway:right"="shared"](${bbox});
            way["cycleway:left"="shared"](${bbox});

            // Cyclists share a lane with motor vehicles, but there are markings indicating that they should share the lane with motorists. The road markings are usually there to highlight a cycle route or to remind drivers that you can cycle there. Also used for the on-road shared-lane marking called a "sharrow"[1].	
            way["cycleway"="shared_lane"](${bbox});
            way["cycleway:right"="shared_lane"](${bbox});
            way["cycleway:left"="shared_lane"](${bbox});

            // cyclestreets
            way['cycleway'=cyclestreet](${bbox});
            way[bicycle_road=yes](${bbox});
            way[cyclestreet=yes](${bbox});

            /////////////
            // Vias com limite de velocidade de 30km/h
            //
            
            way["maxspeed"="30"](${bbox});
        );
        out body;
        >;
        out skel qt;
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