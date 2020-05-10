import React, { Component } from 'react';

import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css';

import turfLength from '@turf/length';

import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'

import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';

import { MAPBOX_ACCESS_TOKEN, IS_MOBILE, DEFAULT_ZOOM } from './constants.js'

import './Map.css'


const geocodingClient = mbxGeocoding({ accessToken: MAPBOX_ACCESS_TOKEN });


class Map extends Component {
    map;
    popup;
    searchBar;
    hoverPopup;
    selectedCycleway;
    hoveredCycleway;

    constructor(props) {
        super(props);

        this.onMapMoved = this.onMapMoved.bind(this);
    }

    showPopup(e) {
        const coords = e.lngLat;
        const props = e.features[0].properties;

        const layer = this.props.layers.find(l =>
            l.id === e.features[0].layer.id.split('--')[0]
        );

        let html = '';

        html += `
            <h2 style="margin-top: 1em; font-size: 22px;">
                ${props.name ? props.name : '<i style="color: gray;">Sem nome</i>'}
            </h2>`;

        html += `
            <div style="font-size: 14px">
                <div class="pill" style="background-color: ${layer.style.lineColor}">
                    ${layer.name}
                </div>
            </div>`;

        // html += `<h3>Tipo: ${layer.name}</h3>`;
        // html += `<p>${layer.description}</p>`;

        // const prettyProps = JSON.stringify(props, null, 2)
        //     .replace(/(?:\r\n|\r|\n)/g, '<br/>')
        //     .replace(/"|,|\{|\}/g, '');
        // html += prettyProps;

        html += `
            <div class="footer">
                Acha que este dado pode ser melhorado?
                <br>
                <a
                    target="_BLANK"
                    rel="noopener"
                    href="https://www.openstreetmap.org/${props.id}"
                >
                    Editar no OSM →
                </a>
            </div>
    `;

        this.popup.setLngLat(coords)
            .setHTML(html)
            .addTo(this.map);
    }

    showHoverPopup(e) {
        const coords = e.lngLat;

        const layer = this.props.layers.find(l =>
            l.id === e.features[0].layer.id.split('--')[0]
        );

        this.hoverPopup.setLngLat(coords)
            .setHTML(`<h3>${layer.name}<h3>`)
            .addTo(this.map);
    }

    hidePopup() {
        this.popup.remove();
    }

    // southern-most latitude, western-most longitude, northern-most latitude, eastern-most longitude
    getCurrentBBox() {
        const fallback = "-23.036345361742164,-43.270405878917785,-22.915284125684607,-43.1111041211104";

        if (this.map) {
            const sw = this.map.getBounds().getSouthWest();
            const ne = this.map.getBounds().getNorthEast();
            return `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
        } else {
            return fallback;
        }
    }

    reverseGeocode(lngLat) {
        console.debug('lngLat', lngLat);

        if (!lngLat || !lngLat[0] || !lngLat[1]) {
            console.error('Something wrong with lngLat passed.');
            return;
        }

        // Clear previous map panning limits
        this.map.setMaxBounds();

        geocodingClient
            .reverseGeocode({
                query: lngLat,
                types: ['place'],
                limit: 1
            })
            .send()
            .then(response => {
                const features = response.body.features;

                console.debug('reverseGeocode', features);

                if (features && features[0]) {
                    const place = features[0];

                    if (this.searchBar) {
                        this.searchBar.setBbox(place.bbox);
                    }

                    // Disabled temporarily because it had a bug that it changed the map center
                    // this.map.once('moveend', () => {
                    //     this.map.setMaxBounds([
                    //         [place.bbox[0]-0.15, place.bbox[1]-0.15], // Southwest coordinates
                    //         [place.bbox[2]+0.15, place.bbox[3]+0.15]  // Northeast coordinates
                    //     ]); 
                    // });
                    
                    this.props.onMapMoved({area: place.place_name});
                }
            })
            .catch(err => {
                console.error(err.message);
            });
    }

    onMapMoved() {
        const lat = this.map.getCenter().lat;
        const lng = this.map.getCenter().lng;
        const zoom = this.map.getZoom();

        this.props.onMapMoved({
            lat: lat,
            lng: lng,
            zoom: zoom,
        });

        // console.debug('onMapMoved');
    }

    getMapboxFilterForLayer(l) {
        return [
            "any",
            ...l.filters.map(f =>
                typeof f[0] === 'string' ?
                    ["==", ["get", f[0]], f[1]]
                    :
                    ["all",
                        ...f.map(f2 =>
                            ["==", ["get", f2[0]], f2[1]]
                        )
                    ]
            )
        ];
    }

    addDynamicLayer(l) {
        const filters = this.getMapboxFilterForLayer(l);

        // Check if layer has a border color set. If that's the case the logic is a
        //  little different and we'll need 2 layers, one for the line itself and 
        //  another for the line underneath which creates the illusion of a border.
        if (l.style.borderColor) {
            // Border
            this.map.addLayer({
                "id": l.id+'--border',
                "type": "line",
                "source": "osm",
                "name": l.name,
                "description": l.description,
                "layout": {
                    "line-join": "round",
                    "line-cap": "round"
                },
                "paint": {
                    "line-color": l.style.borderColor,
                    "line-width": [
                        "interpolate",
                            ["exponential", 1.5],
                            ["zoom"], 
                            10, 2,
                            18, [ 'case',
                                ['boolean', ['feature-state', 'hover'], false],
                                l.style.lineWidth*6,
                                l.style.lineWidth*3
                            ]
                    ],
                    ...(l.style.borderStyle === 'dashed' && {'line-dasharray': [.2, 2.5]})
                },
                "filter": filters,
            }, 'road-label-small');

            // Line
            this.map.addLayer({
                "id": l.id,
                "type": "line",
                "source": "osm",
                "name": l.name,
                "description": l.description,
                "layout": {
                    "line-join": "round",
                    "line-cap": "round"
                },
                "paint": {
                    "line-color": l.style.lineColor,
                    "line-width": [
                        "interpolate",
                            ["exponential", 1.5],
                            ["zoom"],
                            10, 2,
                            18, [ 'case',
                                ['boolean', ['feature-state', 'hover'], false],
                                (l.style.lineWidth - l.style.borderWidth)*6,
                                (l.style.lineWidth - l.style.borderWidth)*3
                            ]
                    ],
                    ...(l.style.lineStyle === 'dashed' && {'line-dasharray': [.2, 2.5]})
                },
                "filter": filters,
            }, 'road-label-small');
        } else {
            this.map.addLayer({
                "id": l.id,
                "type": "line",
                "source": "osm",
                "name": l.name,
                "description": l.description,
                "layout": {
                    "line-join": "round",
                    "line-cap": "round"
                },
                "paint": {
                    "line-color": l.style.lineColor,
                    "line-width": [
                        "interpolate",
                            ["exponential", 1.5],
                            ["zoom"],
                            10, 2,
                            18, [ 'case',
                                ['boolean', ['feature-state', 'hover'], false],
                                l.style.lineWidth*6,
                                l.style.lineWidth*3
                            ]
                    ],
                    ...(l.style.lineStyle === 'dashed' && {'line-dasharray': [.2, 2.5]})
                },
                "filter": filters,
            }, 'road-label-small');
        }

        
        // Interactions

        const interactiveId = l.style.borderColor ? 
            l.id + '--border'
            : l.id;

        this.map.on("mouseenter", interactiveId, e => {
            if (e.features.length > 0) {
                // Cursor
                this.map.getCanvas().style.cursor = 'pointer';

                // Hover style
                if (this.hoveredCycleway) {
                    this.map.setFeatureState({ source: 'osm', id: this.hoveredCycleway }, { hover: false });
                }
                this.hoveredCycleway = e.features[0].id;
                this.map.setFeatureState({ source: 'osm', id: this.hoveredCycleway }, { hover: true });

                // this.showHoverPopup(e);
            }
        });

        this.map.on("mouseleave", interactiveId, e => {
            // Hover style
            if (this.hoveredCycleway && !this.selectedCycleway) {
                this.map.setFeatureState({ source: 'osm', id: this.hoveredCycleway }, { hover: false });

                // Cursor cursor
                this.map.getCanvas().style.cursor = '';
            }
            this.hoveredCycleway = null;
        });

        this.map.on("click", interactiveId, e => {
            if (e.features.length > 0) {
                if (this.selectedCycleway) {
                    this.map.setFeatureState({ source: 'osm', id: this.selectedCycleway }, { hover: false });
                }
                this.selectedCycleway = e.features[0].id;
                this.map.setFeatureState({ source: 'osm', id: this.selectedCycleway }, { hover: true });

                this.showPopup(e);
            }
        });
    }

    calculateLayersLengths() {
        let lengths = {};
        this.props.layers.forEach(l => {
            // Obs: querySourceFeatures only considers what is visible in the screen!
            const features = this.map.querySourceFeatures('osm', { filter: this.getMapboxFilterForLayer(l) });

            let length = 0;
            features.forEach(f => {
                length += turfLength(f);
            })

            lengths[l.id] = length;
        });

        this.props.updateLengths(lengths);
    }

    initLayers() {
        console.debug('initLayers');

        this.map.setLayoutProperty(
            'satellite',
            'visibility',
            this.props.showSatellite ? 'visible' : 'none');

        this.map.addSource("osm", {
            "type": "geojson",
            "data": this.props.data || {
                'type': 'FeatureCollection',
                'features': []
            },
            "generateId": true
        });

        // In GeoJSON layers are from most important to least important, but we 
        //   want the most important ones to be on top.
        // Slice is used here to don't destructively reverse the original array.
        this.props.layers.slice().reverse().forEach(l => {
            this.addDynamicLayer(l);
        }); 

        // if (!IS_MOBILE) {
        //     this.map.on('sourcedata', e => {
        //         if (e.isSourceLoaded) {
        //             this.calculateLayersLengths();
        //         }
        //     });
        // }

        // this.map.addSource('some id', {
        //     type: 'geojson',
        //     // data: 'http://overpass-api.de/api/interpreter?data=node[amenity=school](bbox);out;(way[amenity=school](bbox);node(w););out;'
        //     // data: 'http://overpass-api.de/api/interpreter?data=node[name=%22Im Tannenbusch%22][highway=bus_stop];out+skel;'
        //     data: 'https://firebasestorage.googleapis.com/v0/b/ciclomapa-app.appspot.com/o/ciclomapa-Nitero%CC%81i%2C%20Rio%20De%20Janeiro%2C%20Brazil.json?alt=media&token=79733a19-009d-46f1-af7b-e55bb3dd9bb5'
        // });
    }

    componentDidUpdate(prevProps) {
        if (!this.map || !this.map.getSource('osm')) {
            return;
        }

        if (this.props.data !== prevProps.data) {
            this.map.getSource('osm').setData(this.props.data);
        }
        
        if (this.props.showSatellite !== prevProps.showSatellite) {
            this.map.setLayoutProperty(
                'satellite',
                'visibility',
                this.props.showSatellite ? 'visible' : 'none');
        }
        
        // if (this.props.zoom !== prevProps.zoom) {
        //     this.map.setZoom(this.props.zoom);
        // }
        
        if (this.props.center !== prevProps.center) {
            this.map.setCenter(this.props.center);
        }
        
        // Compare only 'isActive' field of layers
        if (this.props.layers.map(l => l.isActive).join() === prevProps.layers.map(l => l.isActive).join()) {
            this.props.layers.forEach( l => {
                this.map.setLayoutProperty(l.id, 'visibility', l.isActive ? 'visible' : 'none');
                if (l.style.borderColor) {
                    this.map.setLayoutProperty(l.id+'--border', 'visibility', l.isActive ? 'visible' : 'none');
                }
            })
        }
    }
    
    componentDidMount() {
        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
        
        this.map = new mapboxgl.Map({
            container: this.mapContainer,
            style: this.props.style,
            center: this.props.center,
            zoom: this.props.zoom
        });

        // Native Mapbox map controls

        if (!IS_MOBILE) {
            this.searchBar = new MapboxGeocoder({
                accessToken: mapboxgl.accessToken,
                mapboxgl: mapboxgl,
                language: 'pt-br',
                placeholder: 'Buscar endereços, estabelecimentos, ...',
                countries: 'br',
                // collapsed: IS_MOBILE
            });
            this.map.addControl(this.searchBar, 'bottom-right');
        }

        const cityPicker = new MapboxGeocoder({
            accessToken: mapboxgl.accessToken,
            mapboxgl: mapboxgl,
            language: 'pt-br',
            placeholder: 'Buscar cidades brasileiras',
            countries: 'br',
            types: 'place',
            marker: false,
            clearOnBlur: true,
            flyTo: false
        });
        cityPicker.on('result', result => {
            console.debug('geocoder result', result);

            let flyToPos;
            if (result.place_name === 'Vitória, Espírito Santo, Brasil') {
                flyToPos = [-40.3144,-20.2944];
            } else {
                flyToPos = result.result.center;
            }
            this.map.flyTo({
                center: flyToPos,
                zoom: DEFAULT_ZOOM,
                speed: 2,
                minZoom: 6
            });

            this.reverseGeocode(result.result.center);
            
            // Hide UI
            // @todo refactor this to use React state
            document.querySelector('body').classList.remove('show-city-picker');
            cityPicker.clear();
        });
        this.map.addControl(cityPicker, 'top-left');

        this.map.addControl(
            new mapboxgl.NavigationControl({
                showCompass: false
            }),
            'bottom-right'
        );
        const geolocate = new mapboxgl.GeolocateControl({
            positionOptions: {
                enableHighAccuracy: true
            },
            trackUserLocation: false
        });
        geolocate.on('geolocate', result => {
            console.debug('geolocate', result); 
            this.reverseGeocode([result.coords.longitude, result.coords.latitude]);
        });
        this.map.addControl(geolocate, 'bottom-right');
        
        
        // map.addControl(new mapboxgl.FullscreenControl({ container: document.querySelector('body') }));


        // Listeners

        this.map.on('load', () => {
            this.initLayers();
            this.onMapMoved();

            this.map.on('moveend', this.onMapMoved);

            // Further chages on styles reinitilizes layers
            // this.map.on('style.load', () => {
            //     this.initLayers();
            //     this.onMapMoved();
            // });
        });


        this.popup = new mapboxgl.Popup({
            closeOnClick: false
        });
        this.popup.on('close', e => {
            if (this.selectedCycleway) {
                this.map.setFeatureState({ source: 'osm', id: this.selectedCycleway }, { hover: false });
            }
            this.selectedCycleway = null;
        });

        this.hoverPopup = new mapboxgl.Popup({
            closeButton: false,
            className: 'hover-popup'
        });
        
        // Initialize map data center
        this.reverseGeocode(this.props.center);
    }

    render() {
        return (
            // Thanks https://blog.mapbox.com/mapbox-gl-js-react-764da6cc074a
            <div ref={el => this.mapContainer = el}></div>
        )
    }
}

export default Map;