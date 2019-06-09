const DEBUG_BOUNDS_OPTIMIZATION = false;

let map;
let largestBoundsYet;

function doesAContainsB(a, b) {
    if (a && b) {
        return a.getNorth() >= b.getNorth()
            && a.getSouth() <= b.getSouth()
            && a.getEast() >= b.getEast()
            && a.getWest() <= b.getWest();
    } else {
        return null;
    }
}

function getQuery(bbox) {
    return `
        [out:json][timeout:100];
        (
            ///////////////
            // Ciclovias //
            ///////////////
            
            way["highway"="cycleway"](${bbox});


            /////////////////
            // Ciclofaixas //
            /////////////////

            // Ciclovia na estrada ou ciclofaixa: faixa integrada na estrada destinada a bicicletas. Pode ter simplesmente marcas no piso e eventualmente pequenos pilaretes de plástico a separar a faixa da estrada rodoviária.	
            way["cycleway"="lane"](${bbox});

            // Usada em vias com oneway=yes onde é permitido pedalar em ambos os sentidos.
            way["cycleway"="opposite"](${bbox});

            // Utilizadas em formas com oneway=yes, que tem uma pista de ciclismo indo na direção oposta do fluxo de tráfego normal (um "contramão" da pista)	
            way["cycleway"="opposite_lane"](${bbox});

            // A trilha é uma rota que é separado da estrada.
            way["cycleway"="track"](${bbox});

            // Usada em vias com oneway=yes com uma ciclovia separada indo no sentido oposto ao do tráfego normal}.	
            way["cycleway"="opposite_track"](${bbox});

            // There is a bus lane that cyclists are permitted to use.	
            way["cycleway"="share_busway"](${bbox});

            // Usada em vias com oneway=yes que tèm uma faixa de ônibus/autocarro em que os ciclistas também podem usar, e que vão no sentido oposto do sentido normal do trânsito. Usado junto com oneway:bicycle=no.	
            way["cycleway"="opposite_share_busway"](${bbox});


            // Cyclists share space with other traffic on this highway.	
            way["cycleway"="shared"](${bbox});

            // Cyclists share a lane with motor vehicles, but there are markings indicating that they should share the lane with motorists.
            way["cycleway"="shared_lane"](${bbox});


            // Vias com limite de velocidade de 30km/h
            //way["maxspeed"="30"](${bbox});
        );
        out body;
        >;
        out skel qt;
    `;
}

function updateDebugPolygon(bbox, id) {
    const polygon = createPolygonFromBBox(bbox);
    console.log('polygon', polygon);

    map.getSource('debug-polygon-'+id).setData(polygon);
}

function createPolygonFromBBox(bbox) {
    return {
        'type': 'Feature',
        'geometry': {
            'type': 'Polygon',
            'coordinates': [
                [
                    bbox.getNorthWest().toArray(),
                    bbox.getNorthEast().toArray(),
                    bbox.getSouthEast().toArray(),
                    bbox.getSouthWest().toArray(),
                    bbox.getNorthWest().toArray()
                ]
            ]
        }
    };
}

// southern-most latitude, western-most longitude, northern-most latitude, eastern-most longitude
function getCurrentBBox() {
    const fallback = "-23.036345361742164,-43.270405878917785,-22.915284125684607,-43.1111041211104";

    if (map) {
        const sw = map.getBounds().getSouthWest();
        const ne = map.getBounds().getNorthEast();
        return `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
    } else {
        return fallback;
    }
}

function updateMap() {
    return new Promise(function (resolve, reject) {
        if (!map) {
            reject();
        }

        // Temporary so we don't download absurds quantities of data
        if (map.getZoom < 10) {
            reject();
        }

        $('#spinner').show();

        const bbox = getCurrentBBox();
        const query = getQuery(bbox);
        const encodedQuery = encodeURI(query);

        let geoJson;
        $.getJSON(
            `http://overpass-api.de/api/interpreter?data=${encodedQuery}`,
            data => {
                console.log(data);

                geoJson = osmtogeojson(data, {flatProperties: true});

                console.log(geoJson);

                if (map.getSource('osm')) {
                    map.getSource('osm').setData(geoJson);
                }

                $('#spinner').hide();

                resolve();
            }
        ); 
    });
}

function initStylesSwitcher() {
    var layerList = document.getElementById('styles-menu');
    var inputs = layerList.getElementsByTagName('input');

    function switchLayer(layer) {
        var layerId = layer.target.id;
        map.setStyle('mapbox://styles/mapbox/' + layerId);
    }

    for (var i = 0; i < inputs.length; i++) {
        inputs[i].onclick = switchLayer;
    }
}

function initMap() {
    mapboxgl.accessToken = 'pk.eyJ1IjoiY21kYWxiZW0iLCJhIjoiY2pnbXhjZnplMDJ6MjMzbnk0OGthZGE1ayJ9.n1flNO8ndRYKQcR9wNIT9w';
    map = new mapboxgl.Map({
        container: 'map',
        // style: 'mapbox://styles/mapbox/streets-v11',
        style: 'mapbox://styles/mapbox/light-v10',
        // style: 'mapbox://styles/cmdalbem/cjwo31j95588k1cqxbs7smwd3',
        center: [-43.190754999999996, -22.9758283],
        zoom: 10
    });

    map.addControl(new mapboxgl.NavigationControl());
    map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: {
            enableHighAccuracy: true
        },
        trackUserLocation: true
    }));
    // map.addControl(new mapboxgl.FullscreenControl({ container: document.querySelector('body') }));
    map.addControl(new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl
    }),
        'top-left'
    );

    map.on('load', function () {
        map.addSource("osm", {
            "type": "geojson",
            "data": {
                'type': 'FeatureCollection',
                'features': []
            }
        });

        map.addLayer({
            "id": "cyclewaysBorder",
            "type": "line",
            "source": "osm",
            "layout": {
                "line-join": "round",
                "line-cap": "round"
            },
            "paint": {
                "line-color": [
                    "case",
                        ["==", ["get", "highway"], "cycleway"], "green",
                        ["==", ["get", "cycleway"], "track"], "green",
                        ["==", ["get", "cycleway"], "opposite_track"], "green",
                        ["==", ["get", "cycleway"], "segregated"], "green",
                        "transparent"
                ],
                "line-width": 5
            },
            "filter": ["==", "$type", "LineString"],
        });

        map.addLayer({
            "id": "cycleways",
            "type": "line",
            "source": "osm",
            "layout": {
                "line-join": "round",
                "line-cap": "round"
            },
            "paint": {
                "line-color": [
                    "case",
                        ["==", ["get", "cycleway"], "lane"], "orange",
                        ["==", ["get", "cycleway"], "opposite"], "orange",
                        ["==", ["get", "cycleway"], "opposite_lane"], "orange",
                        ["==", ["get", "cycleway"], "crossing"], "orange",
                        ["==", ["get", "cycleway"], "shared_lane"], "orange",
                        ["==", ["get", "cycleway"], "share_busway"], "orange",
                        ["==", ["get", "cycleway"], "shared"], "red",
                        "lightgreen"
                ],
                "line-width": 2
            },
            "filter": ["==", "$type", "LineString"],
        });

        largestBoundsYet = map.getBounds();
        
        if (DEBUG_BOUNDS_OPTIMIZATION) {
            map.addLayer({
                'id': 'debug-polygon-1',
                'type': 'line',
                'source': {
                    'type': 'geojson',
                    "data": {
                        'type': 'FeatureCollection',
                        'features': []
                    }
                },
                'paint': {
                    "line-color": "red",
                    "line-width": 2
                }
            });
            
            updateDebugPolygon(largestBoundsYet,1);
            
            map.addLayer({
                'id': 'debug-polygon-2',
                'type': 'fill',
                'source': {
                    'type': 'geojson',
                    "data": {
                        'type': 'FeatureCollection',
                        'features': []
                    }
                },
                'paint': {
                    'fill-color': 'green',
                    'fill-opacity': 0.1
                }
            });
        }

        map.on('moveend', () => {
            let newBounds = map.getBounds();

            if (DEBUG_BOUNDS_OPTIMIZATION) {
                updateDebugPolygon(newBounds,2);
            }

            // Only redo the query if we need new data
            if (!doesAContainsB(largestBoundsYet, newBounds)) {
                updateMap();
                largestBoundsYet = newBounds;
                
                if (DEBUG_BOUNDS_OPTIMIZATION) {
                    updateDebugPolygon(largestBoundsYet,1);
                }
            }
        });

        updateMap();
    });
} 

$(document).ready(function () {
    // initStylesSwitcher();
    initMap();
});