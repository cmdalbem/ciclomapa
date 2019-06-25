import React, { Component } from 'react';

import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css';

import MapboxGeocoder from 'mapbox-gl-geocoder'
import 'mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'

import { doesAContainsB, downloadObjectAsJson, createPolygonFromBBox, slugify } from './utils.js'

import { DEBUG_BOUNDS_OPTIMIZATION, MAPBOX_ACCESS_TOKEN } from './constants.js'

import * as layers from './layers.json';

import './Map.css'


let map, popup;
let largestBoundsYet;
let hoveredCycleway, selectedCycleway;
let currentBBox;


class MapboxGLButtonControl {
    constructor({
        className = "",
        title = "",
        eventHandler = null
    }) {
        this._className = className;
        this._title = title;
        this._eventHandler = eventHandler;
    }

    onAdd(map) {
        this._btn = document.createElement("button");
        this._btn.className = "mapboxgl-ctrl-icon " + this._className;
        this._btn.type = "button";
        this._btn.title = this._title;
        this._btn.onclick = this._eventHandler;

        this._container = document.createElement("div");
        this._container.className = "mapboxgl-ctrl-group mapboxgl-ctrl";
        this._container.appendChild(this._btn);

        return this._container;
    }

    onRemove() {
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}

class Map extends Component {
    constructor(props) {
        super(props);

        this.onMapMoved = this.onMapMoved.bind(this);
    }

    showPopup(e) {
        const coords = e.lngLat;
        const props = e.features[0].properties;
        const osmID = props.id;
        const prettyProps = JSON.stringify(props, null, 2)
            .replace(/(?:\r\n|\r|\n)/g, '<br/>')
            .replace(/"|,|\{|\}/g, '');

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

    hidePopup() {
        popup.remove();
    }

    updateDebugPolygon(bbox, id) {
        const polygon = createPolygonFromBBox(bbox);
        console.log('polygon', polygon);

        map.getSource('debug-polygon-' + id).setData(polygon);
    }

    // southern-most latitude, western-most longitude, northern-most latitude, eastern-most longitude
    getCurrentBBox() {
        const fallback = "-23.036345361742164,-43.270405878917785,-22.915284125684607,-43.1111041211104";

        if (map) {
            const sw = map.getBounds().getSouthWest();
            const ne = map.getBounds().getNorthEast();
            return `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
        } else {
            return fallback;
        }
    }

    updateData() {
        if (!map || map.getZoom() < 10) {
            return;
        } else {
            this.props.updateData(this.getCurrentBBox());
        }
    }

    onMapMoved() {
        this.props.onMapMoved({
            lat: map.getCenter().lat,
            lng: map.getCenter().lng,
            zoom: map.getZoom()
        });

        let newBounds = map.getBounds();

        if (DEBUG_BOUNDS_OPTIMIZATION) {
            this.updateDebugPolygon(newBounds, 2);
        }

        // Only redo the query if we need new data
        if (!doesAContainsB(largestBoundsYet, newBounds)) {
            this.updateData();
            largestBoundsYet = newBounds;

            if (DEBUG_BOUNDS_OPTIMIZATION) {
                this.updateDebugPolygon(largestBoundsYet, 1);
            }
        }
    }

    addDynamicLayer(l) {
        const BORDER_WIDTH = 3;

        l.style.lineStyle = l.style.lineStyle || 'solid';
        l.id = slugify(l.name);

        let filters = l.filters.map(f => ["==", ["get", f[0]], f[1]]);
        filters.unshift('any');

        // Check if layer has a border color set. If that's the case the logic is a
        //  little different and we'll need 2 layers, one for the line itself and 
        //  another for the line underneath which creates the illusion of a border.
        if (l.style.borderColor) {
            l.style.borderStyle = l.style.borderStyle || 'solid';

            // Border
            map.addLayer({
                "id": l.id+'--border',
                "type": "line",
                "source": "osm",
                "paint": {
                    "line-color": l.style.borderColor,
                    "line-width": [
                        "case",
                        ["boolean", ["feature-state", "highlight"], false],
                        12,
                        l.style.lineWidth
                    ],
                    ...(l.style.borderStyle === 'dashed' && {'line-dasharray': [1, 0.6]})
                },
                "filter": filters,
            });

            // Line
            map.addLayer({
                "id": l.id,
                "type": "line",
                "source": "osm",
                "text-field": l.name,
                "paint": {
                    "line-color": l.style.lineColor,
                    "line-width": [
                        "case",
                        ["boolean", ["feature-state", "highlight"], false],
                        12,
                        l.style.lineWidth - BORDER_WIDTH
                    ],
                    ...(l.style.lineStyle === 'dashed' && {'line-dasharray': [1, 0.6]})
                },
                "filter": filters,
            });
        } else {
            map.addLayer({
                "id": l.id,
                "type": "line",
                "source": "osm",
                "text-field": l.name,
                "paint": {
                    "line-color": l.style.lineColor,
                    "line-width": [
                        "case",
                        ["boolean", ["feature-state", "highlight"], false],
                        12,
                        l.style.lineWidth
                    ],
                    ...(l.style.lineStyle === 'dashed' && {'line-dasharray': [1, 0.6]})
                },
                "filter": filters,
            });
        }

        map.on("mouseenter", l.id, e => {
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

                // this.showPopup(e);
            }
        });

        map.on("mouseleave", l.id, e => {
            // Hover style
            if (hoveredCycleway && !selectedCycleway) {
                map.setFeatureState({ source: 'osm', id: hoveredCycleway }, { highlight: false });

                // Cursor cursor
                map.getCanvas().style.cursor = '';

                // this.hidePopup();
            }
            hoveredCycleway = null;
        });

        map.on("click", "cycleways-lines", e => {
            if (e.features.length > 0) {
                selectedCycleway = e.features[0].id;

                this.showPopup(e);
            }
        });
    }

    initLayers() {
        map.addSource("osm", {
            "type": "geojson",
            "data": {
                'type': 'FeatureCollection',
                'features': []
            },
            "generateId": true
        });

        // In GeoJSON layers are from most important to least important, but we 
        //   want the most important ones to be on top.
        layers.default.reverse().forEach(l => {
            this.addDynamicLayer(l);
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

            this.updateDebugPolygon(largestBoundsYet, 1);

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
    }

    componentDidUpdate(prevProps) {
        if (this.props.data !== prevProps.data) {
            map.getSource('osm').setData(this.props.data);
        }
        
        if (this.props.style !== prevProps.style) {
            map.setStyle(this.props.style);
        }
        
        if (this.props.zoom !== prevProps.zoom) {
            map.setZoom(this.props.zoom);
        }
        
        if (this.props.center !== prevProps.center) {
            map.setCenter(this.props.center);
        }
    }
    
    componentDidMount() {
        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
        
        map = new mapboxgl.Map({
            container: this.mapContainer,
            style: this.props.style,
            center: this.props.center,
            zoom: this.props.zoom
        });

        
        // Native Mapbox map controls

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

        map.addControl(new MapboxGLButtonControl({
            className: "mapbox-gl-download-btn",
            title: "Download",
            eventHandler: e => {
                downloadObjectAsJson(this.props.data, `mapa-cicloviario-${currentBBox}`);
            }
        }),
            "bottom-right"
        );


        // Listeners

        map.on('load', () => {
            largestBoundsYet = map.getBounds();

            this.initLayers();

            this.updateData();

            map.on('moveend', this.onMapMoved);

            // Further chages on styles reinitilizes layers
            map.on('style.load', () => {
                this.initLayers();
            });
        });


        // Create a popup, but don't add it to the map yet.
        popup = new mapboxgl.Popup({
            closeButton: false,
            closeOnClick: false
        });
    }

    render() {
        return (
            // Thanks https://blog.mapbox.com/mapbox-gl-js-react-764da6cc074a
            <div ref={el => this.mapContainer = el}></div>
        )
    }
}

export default Map;