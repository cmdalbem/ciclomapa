const DEBUG_BOUNDS_OPTIMIZATION = false;

let map, popup;
let largestBoundsYet;
let hoveredCycleway, selectedCycleway;

function showPopup(e) {
    const coords = e.lngLat;
    const props = e.features[0].properties;
    const osmID = props.id;
    const prettyProps = JSON.stringify(props, null, 2)
        .replace(/(?:\r\n|\r|\n)/g, '<br/>')
        .replace(/\"|\,|\{|\}/g, '');
    
    let html;
    html += prettyProps;
    html += `
        <br>
        <hr>
        <a target="_BLANK" rel="noopener" href="https://www.openstreetmap.org/${osmID}">Editar no OSM</a>
    `;
    
    popup.setLngLat(coords)
        .setHTML(html)
        .addTo(map);
}

function hidePopup() {
    popup.remove();
}

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
            // `https://overpass-api.de/api/interpreter?data=${encodedQuery}`,
            `https://overpass.kumi.systems/api/interpreter?data=${encodedQuery}`,
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
        ).fail(function (e) {
            console.log("Deu erro! Saca só:",e);
            alert('Overpass returned an error: ',e.statusText);
        })
    });
}

function initStylesSwitcher() {
    var layerList = document.getElementById('styles-menu');
    var inputs = layerList.getElementsByTagName('input');

    function switchLayer(layer) {
        var layerId = layer.target.id;
        map.setStyle('mapbox://styles/mapbox/' + layerId);
        map.on('style.load', function() {
            initMapLayers();
        });
    }

    for (var i = 0; i < inputs.length; i++) {
        inputs[i].onclick = switchLayer;
    }
}

function initMapLayers() {
    map.addSource("osm", {
        "type": "geojson",
        "data": {
            'type': 'FeatureCollection',
            'features': []
        },
        "generateId": true
    });

    // Cycleway solid borders
    map.addLayer({
        "id": "cycleways-solidborder",
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
                ["==", ["get", "cycleway:left"], "track"], "green",
                ["==", ["get", "cycleway:right"], "track"], "green",
                ["==", ["get", "cycleway"], "opposite_track"], "green",
                ["==", ["get", "cycleway"], "segregated"], "green",
                // ["==", ["get", "bicycle"], "designated"], "green",
                ["==", ["get", "cycleway"], "lane"], "green",
                ["==", ["get", "cycleway:left"], "lane"], "green",
                ["==", ["get", "cycleway:right"], "lane"], "green",

                ["==", ["get", "cycleway"], "share_busway"], "orange",
                ["==", ["get", "cycleway"], "shared"], "orange",

                "transparent"
            ],
            "line-width": [
                "case",
                ["boolean", ["feature-state", "highlight"], false],
                12,
                5
            ]
        },
        "filter": ["==", "$type", "LineString"],
    });

    // Cycleways dashed borders
    map.addLayer({
        "id": "cycleways-dashedborder",
        "type": "line",
        "source": "osm",
        "paint": {
            "line-color": [
                "case",
                ["==", ["get", "cycleway"], "shared_lane"], "orange",
                ["==", ["get", "cycleway:left"], "shared_lane"], "orange",
                ["==", ["get", "cycleway:right"], "shared_lane"], "orange",

                "transparent"
            ],
            'line-dasharray': [1, 0.6],
            "line-width": [
                "case",
                ["boolean", ["feature-state", "highlight"], false],
                12,
                5
            ]
        },
        "filter": ["==", "$type", "LineString"],
    });

    // Cycleway solid lines
    map.addLayer({
        "id": "cycleways-lines",
        "type": "line",
        "source": "osm",
        "layout": {
            "line-join": "round",
            "line-cap": "round"
        },
        "paint": {
            "line-color": [
                "case",
                ["==", ["get", "highway"], "cycleway"], "lightgreen",
                ["==", ["get", "cycleway"], "track"], "lightgreen",
                ["==", ["get", "cycleway:left"], "track"], "lightgreen",
                ["==", ["get", "cycleway:right"], "track"], "lightgreen",
                ["==", ["get", "cycleway"], "opposite_track"], "lightgreen",
                ["==", ["get", "cycleway"], "segregated"], "lightgreen",
                ["==", ["get", "cycleway"], "lane"], "lightgreen",
                ["==", ["get", "cycleway:left"], "lane"], "lightgreen",
                ["==", ["get", "cycleway:right"], "lane"], "lightgreen", 

                ["==", ["get", "bicycle"], "designated"], "orange",
                ["==", ["get", "cycleway"], "opposite"], "orange",
                ["==", ["get", "cycleway:left"], "opposite"], "orange",
                ["==", ["get", "cycleway:right"], "opposite"], "orange",
                ["==", ["get", "cycleway"], "opposite_lane"], "orange",
                ["==", ["get", "cycleway:left"], "opposite_lane"], "orange",
                ["==", ["get", "cycleway:right"], "opposite_lane"], "orange",
                ["==", ["get", "cycleway"], "crossing"], "orange",

                ["==", ["get", "cycleway"], "shared_lane"], "yellow",
                ["==", ["get", "cycleway:left"], "shared_lane"], "yellow",
                ["==", ["get", "cycleway:right"], "shared_lane"], "yellow",
                ["==", ["get", "cycleway"], "share_busway"], "yellow",
                ["==", ["get", "cycleway"], "shared"], "yellow",

                ["==", ["get", "maxspeed"], "30"], "transparent",

                "red"
            ],
            "line-width": [
                "case",
                ["boolean", ["feature-state", "highlight"], false],
                8,
                2
            ]

        },
        "filter": ["==", "$type", "LineString"],
    });

    // Cycleway solid lines
    map.addLayer({
        "id": "cycleways-dashedlines",
        "type": "line",
        "source": "osm",
        "paint": {
            "line-color": [
                "case",
                    ["==", ["get", "maxspeed"], "30"], "orange",

                    "transparent"
            ],
            'line-dasharray': [1, 0.6],
            "line-width": [
                "case",
                ["boolean", ["feature-state", "highlight"], false],
                8,
                3
            ]

        },
        "filter": ["==", "$type", "LineString"],
    });

    map.on("mouseenter", "cycleways-lines", function (e) {
        if (e.features.length > 0) {
            selectedCycleway = null;

            // Cursor
            map.getCanvas().style.cursor = 'pointer';

            // Hover style
            if (hoveredCycleway) {
                map.setFeatureState({ source: 'osm', id: hoveredCycleway }, { highlight: false });
            }
            hoveredCycleway = e.features[0].id;
            map.setFeatureState({ source: 'osm', id: hoveredCycleway }, { highlight: true });

            showPopup(e);
        }
    });

    map.on("mouseleave", "cycleways-lines", function (e) {
        // Hover style
        if (hoveredCycleway && !selectedCycleway) {
            map.setFeatureState({ source: 'osm', id: hoveredCycleway }, { highlight: false });

            // Cursor cursor
            map.getCanvas().style.cursor = '';

            hidePopup();
        }
        hoveredCycleway = null;
    });

    map.on("click", "cycleways-lines", function (e) {
        if (e.features.length > 0) {
            selectedCycleway = e.features[0].id;

            showPopup(e);
        }
    });

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

        updateDebugPolygon(largestBoundsYet, 1);

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
            updateDebugPolygon(newBounds, 2);
        }

        // Only redo the query if we need new data
        if (!doesAContainsB(largestBoundsYet, newBounds)) {
            updateMap();
            largestBoundsYet = newBounds;

            if (DEBUG_BOUNDS_OPTIMIZATION) {
                updateDebugPolygon(largestBoundsYet, 1);
            }
        }
    });

    updateMap();
}

function initMap() {
    mapboxgl.accessToken = 'pk.eyJ1IjoiY21kYWxiZW0iLCJhIjoiY2pnbXhjZnplMDJ6MjMzbnk0OGthZGE1ayJ9.n1flNO8ndRYKQcR9wNIT9w';
    map = new mapboxgl.Map({
        container: 'map',
        // style: 'mapbox://styles/mapbox/streets-v11',
        // style: 'mapbox://styles/cmdalbem/cjwo31j95588k1cqxbs7smwd3',
        style: 'mapbox://styles/mapbox/light-v10',
        center: [-43.19663687394814, -22.968419833847065],
        // zoom: 10
        zoom: 13
    });

    map.addControl(
        new mapboxgl.NavigationControl(),
        'bottom-right'
    );
    map.addControl(new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: true
        }),
        'bottom-right'
    );
    // map.addControl(new mapboxgl.FullscreenControl({ container: document.querySelector('body') }));
    map.addControl(new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl
    }),
        'top-left'
    );

    map.on('load', function () {
        largestBoundsYet = map.getBounds();

        initMapLayers();
    });
} 

$(document).ready(function () {
    initStylesSwitcher();

    // Create a popup, but don't add it to the map yet.
    popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false
    });

    initMap();
});