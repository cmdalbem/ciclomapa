import React, { Component } from 'react';
import { useDirections } from './DirectionsContext.js';

import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'
import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';

import {
    MAPBOX_ACCESS_TOKEN,
    IS_MOBILE,
    DEFAULT_ZOOM,
    ENABLE_COMMENTS,
    IS_PROD,
    DEFAULT_LINE_WIDTH_MULTIPLIER,
    LINE_WIDTH_MULTIPLIER_HOVER,
    POI_ZOOM_THRESHOLD,
    COMMENTS_ZOOM_THRESHOLD,
    DIRECTIONS_LINE_WIDTH,
    DIRECTIONS_LINE_BORDER_WIDTH,
    ROUTES_ACTIVE_OPACITY,
} from './constants.js'

import Analytics from './Analytics.js'
import AirtableDatabase from './AirtableDatabase.js'
import CommentModal from './CommentModal.js'
import NewCommentCursor from './NewCommentCursor.js'
import MapPopups from './MapPopups.js'

import './Map.css'

import capitalsGeojson from './brazil_capitals.geojson';

// @todo: improve this please
import commentIcon from './img/icons/poi-comment.png';

import bikeparkingIcon from './img/icons/poi-bikeparking.png';
import bikeparkingIcon2x from './img/icons/poi-bikeparking@2x.png';
import bikeparkingIconMini from './img/icons/poi-bikeparking-mini.png';
import bikeparkingIconMiniLight from './img/icons/poi-bikeparking-mini--light.png';
import bikeshopIcon from './img/icons/poi-bikeshop.png';
import bikeshopIcon2x from './img/icons/poi-bikeshop@2x.png';
import bikeshopIconMini from './img/icons/poi-bikeshop-mini.png';
import bikeshopIconMiniLight from './img/icons/poi-bikeshop-mini--light.png';
import bikerentalIcon from './img/icons/poi-bikerental.png';
import bikerentalIcon2x from './img/icons/poi-bikerental@2x.png';
import bikerentalIconMini from './img/icons/poi-bikerental-mini.png';
import bikerentalIconMiniLight from './img/icons/poi-bikerental-mini--light.png';

const iconsMap = {
    "poi-comment": commentIcon,
    "poi-bikeparking": bikeparkingIcon,
    "poi-bikeparking-2x": bikeparkingIcon2x,
    "poi-bikeparking-mini": bikeparkingIconMini,
    "poi-bikeparking-mini--light": bikeparkingIconMiniLight,
    "poi-bikeshop": bikeshopIcon,
    "poi-bikeshop-2x": bikeshopIcon2x,
    "poi-bikeshop-mini": bikeshopIconMini,
    "poi-bikeshop-mini--light": bikeshopIconMiniLight,
    "poi-rental": bikerentalIcon,
    "poi-rental-2x": bikerentalIcon2x,
    "poi-rental-mini": bikerentalIconMini,
    "poi-rental-mini--light": bikerentalIconMiniLight,
}

const geocodingClient = mbxGeocoding({ accessToken: MAPBOX_ACCESS_TOKEN });


class Map extends Component {
    map;
    searchBar;
    popups;
    
    selectedCycleway;
    hoveredCycleway;
    hoveredComment;
    hoveredPOI;

    airtableDatabase;
    comments;

    constructor(props) {
        super(props);

        this.onMapMoved = this.onMapMoved.bind(this);

        this.newComment = this.newComment.bind(this);
        this.initCommentsLayer = this.initCommentsLayer.bind(this);
        this.afterCommentCreate = this.afterCommentCreate.bind(this);
        this.showCommentModal = this.showCommentModal.bind(this);
        this.hideCommentModal = this.hideCommentModal.bind(this);
        document.addEventListener('newComment', this.newComment);

        if (ENABLE_COMMENTS) {
            this.airtableDatabase = new AirtableDatabase();
        }

        this.state = {
            showCommentModal: false,
            showCommentCursor: false,
            tagsList: [],
            comments: [],
        };
    }

    showCommentModal() {
        this.setState({
            showCommentModal: true,
            showCommentCursor: false
        });
    };

    hideCommentModal() {
        this.setState({
            showCommentModal: false
        });
    };

    afterCommentCreate() {
        Analytics.event('new_comment');

        this.hideCommentModal();
        this.initCommentsLayer();
    };

    // Not in use
    // southern-most latitude, western-most longitude, northern-most latitude, eastern-most longitude
    // getCurrentBBox() {
    //     const fallback = "-23.036345361742164,-43.270405878917785,-22.915284125684607,-43.1111041211104";

    //     if (this.map) {
    //         const sw = this.map.getBounds().getSouthWest();
    //         const ne = this.map.getBounds().getNorthEast();
    //         return `${sw.lat},${sw.lng},${ne.lat},${ne.lng}`;
    //     } else {
    //         return fallback;
    //     }
    // }

    reverseGeocode(lngLat) {
        if (lngLat.lat && lngLat.lng) {
            lngLat = [lngLat.lng, lngLat.lat];
        }

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
                limit: 1,
                language: ['pt-br']
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

                    this.props.onMapMoved({ area: place.place_name });
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

    convertFilterToMapboxFilter(l) {
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

    initPOILayer(l) {
        const filters = this.convertFilterToMapboxFilter(l);

        // Base layer configuration
        const baseLayerConfig = {
            'type': 'symbol',
            'source': 'osm',
            "filter": filters,
            "description": l.description,
            'layout': {
                'text-field': [ 'step', ['zoom'], '', POI_ZOOM_THRESHOLD, ['get', 'name'], ],
                'text-font': ['IBM Plex Sans Bold'],
                "text-offset": [0, 1.5],
                'text-size': [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"], 
                        10, 10,
                        18, 14
                ],
                'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
                "icon-padding": 0,
                "icon-allow-overlap": [
                    'step',
                    ['zoom'],
                    false,
                    POI_ZOOM_THRESHOLD,
                    true
                ],
                'icon-size': [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"], 
                        10, 0.5,
                        POI_ZOOM_THRESHOLD, 1
                ],
            },
            'paint': {
                'text-color': l.style.textColor || 'white',
                'text-halo-width': 1,
                'text-opacity': ['case',
                    ['boolean', ['feature-state', 'routes-active'], false],
                    ROUTES_ACTIVE_OPACITY,
                    ['case',
                        ['boolean', ['feature-state', 'hover'], false],
                        0.7,
                        1.0
                    ]
                ],
                'icon-opacity': ['case',
                    ['boolean', ['feature-state', 'routes-active'], false],
                    ROUTES_ACTIVE_OPACITY,
                    ['case',
                        ['boolean', ['feature-state', 'hover'], false],
                        0.7,
                        1.0
                    ]
                ]
            }
        };

        // Create POI layer
        this.map.addLayer({
            ...baseLayerConfig,
            'id': l.id,
            "name": l.name,
            'layout': {
                ...baseLayerConfig.layout,
                'icon-image': [
                    'step',
                    ['zoom'],
                    this.props.isDarkMode ? `${l.icon}-mini` : `${l.icon}-mini--light`,
                    POI_ZOOM_THRESHOLD,
                    l.icon
                ],
            },
            'paint': {
                ...baseLayerConfig.paint,
                'text-halo-color': this.props.isDarkMode ? '#1c1a17' : '#ffffff',
            }
        });

        // Interactions
        const self = this;

        this.map.on('mouseenter', l.id, (e) => {
            if (e.features.length > 0 && self.map.getZoom() > POI_ZOOM_THRESHOLD) {
                // Disable POI hover effects when in route mode
                if (self.props.isInRouteMode) {
                    e.originalEvent.preventDefault();
                    return;
                }
                self.map.getCanvas().style.cursor = 'pointer';

                if (self.hoveredPOI) {
                    self.map.setFeatureState({
                        source: 'osm',
                        id: self.hoveredPOI },
                        { hover: false });
                }
                self.hoveredPOI = e.features[0].id;
                self.map.setFeatureState({
                    source: 'osm',
                    id: self.hoveredPOI },
                    { hover: true });
            }
            e.originalEvent.preventDefault();
        });

        this.map.on('mouseleave', l.id, e => {
            if (self.hoveredPOI && self.map.getZoom() > POI_ZOOM_THRESHOLD) {
                self.map.getCanvas().style.cursor = '';

                self.map.setFeatureState({
                    source: 'osm',
                    id: self.hoveredPOI },
                    { hover: false });
            }
            self.hoveredPOI = null;
        });

        this.map.on('click', l.id, e => {
            if (e && e.features && e.features.length > 0 && !e.originalEvent.defaultPrevented && self.map.getZoom() > POI_ZOOM_THRESHOLD) {
                // Disable POI clicks when in route mode
                if (self.props.isInRouteMode) {
                    e.originalEvent.preventDefault();
                    return;
                }
                self.popups.showPOIPopup(e, iconsMap[l.icon+'-2x'], l.icon);
                // e.originalEvent.preventDefault();
            }
        });

    }

    initCyclepathLayer(l) {
        const filters = this.convertFilterToMapboxFilter(l);
        const dashedLineStyle = { 'line-dasharray': [1, 1] };
        // Will be used as "beforeId" prop in AddLayer
        const layerUnderneathName = this.map.getLayer('road-label-small') ? 'road-label-small' : '';
        const self = this;

        this.map.addLayer({
            "id": l.id + '--interactive',
            "type": "line",
            "source": "osm",
            "filter": filters,
            "paint": {
                "line-opacity": 0,
                "line-color": 'yellow',
                "line-width": 24
            },
        }, layerUnderneathName);

        // Check if layer has a border color set. If that's the case the logic is a
        //  little different and we'll need 2 layers, one for the line itself and 
        //  another for the line underneath which creates the illusion of a border.
        if (l.style.borderColor) {
            // Border
            this.map.addLayer({
                "id": l.id + '--border',
                "type": "line",
                "source": "osm",
                "name": l.name,
                "description": l.description,
                "filter": filters,
                "paint": {
                    "line-color": l.style.borderColor,
                    "line-opacity": [
                        "case",
                        ["boolean", ["feature-state", "routes-active"], false],
                        ROUTES_ACTIVE_OPACITY,
                        1.0
                    ],
                    "line-width": [
                        "interpolate",
                            ["exponential", 1.5],
                            ["zoom"], 
                            10, l.style.lineWidth/4,
                            18, [ 'case',
                                ['boolean', ['feature-state', 'hover'], false],
                                l.style.lineWidth*DEFAULT_LINE_WIDTH_MULTIPLIER*LINE_WIDTH_MULTIPLIER_HOVER,
                                l.style.lineWidth*DEFAULT_LINE_WIDTH_MULTIPLIER
                            ]
                    ],
                    ...(l.style.borderStyle === 'dashed' && dashedLineStyle)
                },
                "layout": (l.style.borderStyle === 'dashed') ? {} : { "line-join": "round", "line-cap": "round" },
            }, layerUnderneathName);

            // Line
            this.map.addLayer({
                "id": l.id,
                "type": "line",
                "source": "osm",
                "name": l.name,
                "description": l.description,
                "filter": filters,
                "paint": {
                    "line-color": l.style.lineColor,
                    "line-opacity": [
                        "case",
                        ["boolean", ["feature-state", "routes-active"], false],
                        ROUTES_ACTIVE_OPACITY,
                        1.0
                    ],
                    "line-width": [
                        "interpolate",
                            ["exponential", 1.5],
                            ["zoom"],
                            10, [ 'case',
                                ['boolean', ['feature-state', 'hover'], false],
                                l.style.lineWidth - l.style.borderWidth,
                                Math.max(1, (l.style.lineWidth - l.style.borderWidth)/4),
                            ],
                            18, [ 'case',
                                ['boolean', ['feature-state', 'hover'], false],
                                (l.style.lineWidth - l.style.borderWidth)*DEFAULT_LINE_WIDTH_MULTIPLIER*LINE_WIDTH_MULTIPLIER_HOVER,
                                (l.style.lineWidth - l.style.borderWidth)*DEFAULT_LINE_WIDTH_MULTIPLIER
                            ]
                    ],
                    ...(l.style.lineStyle === 'dashed' && dashedLineStyle)
                },
                "layout": (l.style.lineStyle === 'dashed') ? {} : { "line-join": "round", "line-cap": "round" },
            }, layerUnderneathName);
        } else {
            this.map.addLayer({
                "id": l.id,
                "type": "line",
                "source": "osm",
                "name": l.name,
                "description": l.description,
                "filter": filters,
                "paint": {
                    "line-color": l.style.lineColor,
                    "line-opacity": [
                        "case",
                        ["boolean", ["feature-state", "routes-active"], false],
                        ROUTES_ACTIVE_OPACITY,
                            [ 'case',
                                ['boolean', ['feature-state', 'hover'], false],
                                0.7, // On hover
                                1.0
                            ],
                    ],
                    "line-width": [
                        "interpolate",
                            ["exponential", 1.5],
                            ["zoom"],
                            10, Math.max(1, l.style.lineWidth/4),
                            18, l.style.lineWidth * DEFAULT_LINE_WIDTH_MULTIPLIER
                            // 10, [ 'case',
                            //     ['boolean', ['feature-state', 'hover'], false],
                            //     l.style.lineWidth * 1.5, // On hover
                            //     Math.max(1, l.style.lineWidth/4)
                            // ],
                            // 18, [ 'case',
                            //     ['boolean', ['feature-state', 'hover'], false],
                            //     l.style.lineWidth * DEFAULT_LINE_WIDTH_MULTIPLIER * LINE_WIDTH_MULTIPLIER_HOVER, // On hover
                            //     l.style.lineWidth * DEFAULT_LINE_WIDTH_MULTIPLIER
                            // ]
                    ],
                    ...(l.style.lineStyle === 'dashed' && dashedLineStyle)
                },
                "layout": (l.style.lineStyle === 'dashed') ? {} : { "line-join": "round", "line-cap": "round" },
            }, layerUnderneathName);
        }

        // Click interaction
        // Hover interaction is handled globally with map.on('mousemove')
        this.map.on('click', l.id + '--interactive', e => {
            if (e && e.features && e.features.length > 0 && !e.originalEvent.defaultPrevented) {
                // Disable cyclepath clicks when in route mode
                if (self.props.isInRouteMode) {
                    e.originalEvent.preventDefault();
                    return;
                }
                // if (self.selectedCycleway) {
                //     self.map.setFeatureState({ source: 'osm', id: self.selectedCycleway }, { hover: false });
                // }
                // self.selectedCycleway = e.features[0].id;
                // self.map.setFeatureState({ source: 'osm', id: self.selectedCycleway }, { hover: true });

                const layer = self.props.layers.find(l =>
                    l.id === e.features[0].layer.id.split('--')[0]
                );
                self.popups.showCyclewayPopup(e, layer);
                e.originalEvent.preventDefault();
            }
        });
    }

    async initCommentsLayer() {
        const self = this;
        if (this.state.comments.length > 0) {
            this.state.comments.forEach(c => {
                if (c.marker) {
                    c.marker.remove();
                }
            })

            this.map.removeLayer('comentarios');
        }

        this.setState(
            await this.airtableDatabase.getComments(),
            () => {
                if (this.state.comments.length > 0) {
                    this.map.getSource('commentsSrc').setData({
                        'type': 'FeatureCollection',
                        'features': this.state.comments.map(c => {
                            return {
                                'type': 'Feature',
                                'geometry': {
                                    'type': 'Point',
                                    'coordinates': c.fields.latlong.split(',').reverse()
                                },
                                'properties': c.fields
                            };
                        })
                    });
        
                    this.map.addLayer({
                        'id': 'comentarios',
                        'type': 'symbol',
                        'source': 'commentsSrc',
                        'layout': {
                            'icon-image': 'commentIcon',
                            'icon-size': [
                                "interpolate",
                                ["exponential", 1.5],
                                ["zoom"], 
                                8, 0,
                                COMMENTS_ZOOM_THRESHOLD, 1
                            ],
                            "icon-allow-overlap": [
                                'step',
                                ['zoom'],
                                false,
                                COMMENTS_ZOOM_THRESHOLD,
                                true
                            ],
                        },
                        'paint': {
                            'icon-opacity': [
                                'case',
                                ['boolean', ['feature-state', 'hover'], false],
                                .8,
                                1
                            ]
                        }
                    });
        
                    // Interactions
        
                    this.map.on('mouseenter', 'comentarios', e => {
                        if (e.features.length > 0) {
                            // Disable comment hover effects when in route mode
                            if (self.props.isInRouteMode) {
                                return;
                            }
                            self.map.getCanvas().style.cursor = 'pointer';
            
                            if (self.hoveredComment) {
                                self.map.setFeatureState({
                                    source: 'commentsSrc',
                                    id: self.hoveredComment },
                                    { hover: false });
                            }
                            self.hoveredComment = e.features[0].id;
                            self.map.setFeatureState({
                                source: 'commentsSrc',
                                id: self.hoveredComment },
                                { hover: true });
                        }
                    });
            
                    this.map.on('mouseleave', 'comentarios', e => {
                        if (self.hoveredComment) {// && !self.selectedCycleway) {
                            self.map.getCanvas().style.cursor = '';
        
                            self.map.setFeatureState({
                                source: 'commentsSrc',
                                id: self.hoveredComment },
                                { hover: false });
                        }
                        self.hoveredComment = null;
                    });
        
                    this.map.on('click', 'comentarios', e => {
                        if (e && e.features && e.features.length > 0 && !e.originalEvent.defaultPrevented) {
                            // Disable comment clicks when in route mode
                            if (self.props.isInRouteMode) {
                                e.originalEvent.preventDefault();
                                return;
                            }
                            self.popups.showCommentPopup(e);
                            e.originalEvent.preventDefault();
                        }
                    });
            }
        });
    }

    addCitiesLinksLayer() {
        this.map.addSource(
            'cities', {
            'type': 'geojson',
            'data': capitalsGeojson,
            "generateId": true
        });

        this.map.addLayer({
            'id': 'cities',
            'type': 'symbol',
            'source': 'cities',
            'layout': {
                "text-allow-overlap": true,
                'text-field': ['get', 'name'],
                'text-font': ['IBM Plex Sans Bold'],
                "text-offset": [0, 0],
                'text-size': [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"], 
                        4, 12,
                        10, 18
                ],
                'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
            },
            'paint': {
                'text-opacity': [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"], 
                        4, 1,
                        11, 0
                ],
                'text-color': this.props.isDarkMode ? '#B6F9D1' : '#059669',
                'text-halo-width': 1,
                'text-halo-color': this.props.isDarkMode ? '#1c1a17' : '#FFFFFF',
            }
        });

        this.map.on('mouseenter', 'cities', e => {
            this.map.getCanvas().style.cursor = 'pointer';
        });

        this.map.on('mouseleave', 'cities', e => {
            this.map.getCanvas().style.cursor = '';
        });

        this.map.on('click', 'cities', e => {
            if (e && e.features && e.features.length > 0) {
                const coords = e.features[0].geometry.coordinates.slice();
    
                this.map.flyTo({
                    center: coords,
                    zoom: DEFAULT_ZOOM,
                }); 
    
                this.reverseGeocode(coords);
            }
        });
    }

    // Layers need to be initialized in the paint order
    // Afterwards their data can be updated safely without messing up the order
    initGeojsonLayers(layers) {
        const map = this.map;
        const self = this;

        if (map.getLayer('mapbox-satellite')) {
            map.setLayoutProperty(
                'mapbox-satellite',
                'visibility',
                this.props.showSatellite ? 'visible' : 'none');
        }

        if (!map.getLayer('OSM')) {
            map.addSource("osm", {
                "type": "geojson",
                "data": this.props.data || {
                    'type': 'FeatureCollection',
                    'features': []
                },
                "generateId": true
            });

            // Comments layer
            map.addSource("commentsSrc", {
                "type": "geojson",
                "data": {
                    'type': 'FeatureCollection',
                    'features': []
                },
                "generateId": true
            });

            // layers.json is ordered from most to least important, but we 
            //   want the most important ones to be on top so we add in reverse.
            // Slice is used here to don't destructively reverse the original array.
            layers.slice().reverse().forEach(l => {
                if (!l.type || l.type==='way') {
                    this.initCyclepathLayer(l);
                } else if (l.type === 'poi' && l.filters) {
                    this.initPOILayer(l);
                }
            });

            if (!this.props.embedMode) {
                this.addCitiesLinksLayer();
            }
    
            map.on('mousemove', function(e) {
                const features = map.queryRenderedFeatures(e.point, {
                  layers: layers.filter(l => l.type === 'way').map(l => l.id+'--interactive')
                });
    
                if (features.length > 0) {
                    // Disable cyclepath hover effects when in route mode
                    if (self.props.isInRouteMode) {
                        return;
                    }
                    // console.debug(features);
                    map.getCanvas().style.cursor = 'pointer';
        
                    // Hover style
                    if (self.hoveredCycleway) {
                        map.setFeatureState({ source: 'osm', id: self.hoveredCycleway }, { hover: false });
                    }
                    self.hoveredCycleway = features[0].id;
                    map.setFeatureState({ source: 'osm', id: self.hoveredCycleway }, { hover: true });
                } else {
                    // Hover style
                    if (self.hoveredCycleway && !self.selectedCycleway) {
                        map.setFeatureState({ source: 'osm', id: self.hoveredCycleway }, { hover: false });
        
                        // Cursor cursor
                        map.getCanvas().style.cursor = '';
                    }
                    self.hoveredCycleway = null;
                }
            });
        } else {
            console.warn('Map layers already initialized.');
        }

    }

    initDirectionsLayers() {
        const map = this.map;
        if (!map) return;

        map.addSource("directions-route", {
            "type": "geojson",
            "data": {
                'type': 'FeatureCollection',
                'features': []
            }
        });

        // The directions route is made of 3 layers:
        // 1. A white "padding" layer to improve contrast (directions-route-padding)
        // 2. A black border layer (directions-route--border)
        // 3. The main route background layer (directions-route)
        map.addLayer({
            id: 'directions-route-padding',
            type: 'line',
            source: 'directions-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': this.props.isDarkMode ? '#2d2e30' : '#FFFFFF',
                "line-width": [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"],
                        10, Math.max(1, (DIRECTIONS_LINE_WIDTH+DIRECTIONS_LINE_BORDER_WIDTH*2)/4),
                        18, (DIRECTIONS_LINE_WIDTH+DIRECTIONS_LINE_BORDER_WIDTH*2) * DEFAULT_LINE_WIDTH_MULTIPLIER
                ]
            },
            filter: ['==', '$type', 'LineString']
        });
        map.addLayer({
            id: 'directions-route--border',
            type: 'line',
            source: 'directions-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                // 'line-color': this.props.isDarkMode ? '#ffffff' : '#211F1C',
                'line-color': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                        this.props.isDarkMode ? '#ffffff' : '#211F1C',
                    ['case',
                        ['boolean', ['feature-state', 'hover'], false],
                            this.props.isDarkMode ? '#ffffff' : '#211F1C', // On hover
                            this.props.isDarkMode ? '#999999' : '#71716F', // Default
                    ]
                ], 
                "line-width": [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"],
                        6, Math.max(1, DIRECTIONS_LINE_WIDTH/4),
                        18, DIRECTIONS_LINE_WIDTH * DEFAULT_LINE_WIDTH_MULTIPLIER
                ]
            },
            filter: ['==', '$type', 'LineString']
        });
        map.addLayer({
            id: 'directions-route',
            type: 'line',
            source: 'directions-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': [
                    'case',
                    ['boolean', ['feature-state', 'selected'], false],
                        this.props.isDarkMode ? '#2d2e30' : '#FFFFFF', // Selected color = street color
                        this.props.isDarkMode ? '#1c1a17' : '#FAFAFA'  // Default color = map color (for better contrast)
                ],
                "line-width": [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"],
                        10, Math.max(1, (DIRECTIONS_LINE_WIDTH-DIRECTIONS_LINE_BORDER_WIDTH)/4),
                        18, (DIRECTIONS_LINE_WIDTH-DIRECTIONS_LINE_BORDER_WIDTH) * DEFAULT_LINE_WIDTH_MULTIPLIER
                ]
            },
            filter: ['==', '$type', 'LineString']
        });

        map.on('click', 'directions-route', (e) => {
            if (e.features && e.features.length > 0) {
                const routeIndex = e.features[0].properties.routeIndex;
                // Call the parent component's route selection handler
                if (this.props.onRouteSelected) {
                    this.props.onRouteSelected(routeIndex);
                }
            }
        });

        // Track currently hovered route
        this.currentHoveredRoute = null;

        // Change cursor and add hover effects
        map.on('mouseenter', 'directions-route', (e) => {
            map.getCanvas().style.cursor = 'pointer';
            
            // Set hover state on the feature
            if (e.features && e.features.length > 0) {
                const routeIndex = e.features[0].properties.routeIndex;
                this.currentHoveredRoute = routeIndex;
                map.setFeatureState(
                    { source: 'directions-route', id: routeIndex },
                    { hover: true }
                );
                
                // Notify parent component about hover
                if (this.props.onRouteHovered) {
                    this.props.onRouteHovered(routeIndex);
                }
            }
        });

        map.on('mouseleave', 'directions-route', (e) => {
            map.getCanvas().style.cursor = '';
            
            // Clear hover state using tracked route index
            if (this.currentHoveredRoute !== null) {
                map.setFeatureState(
                    { source: 'directions-route', id: this.currentHoveredRoute },
                    { hover: false }
                );
                this.currentHoveredRoute = null;
                
                // Notify parent component to clear hover
                if (this.props.onRouteHovered) {
                    this.props.onRouteHovered(null);
                }
            }
        });
    }

    initOverlappingCyclepathsLayer() {
        const map = this.map;
        // const layerUnderneathName = this.map.getLayer('road-label-small') ? 'road-label-small' : '';
        if (!map) return;

        map.addSource("overlapping-cyclepaths", {
            "type": "geojson",
            "data": {
                'type': 'FeatureCollection',
                'features': []
            }
        });
        
        map.addLayer({
            id: 'overlapping-cyclepaths',
            type: 'line',
            source: 'overlapping-cyclepaths',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': [
                    'case',
                    ['==', ['get', 'type'], 'Ciclovia'], '#00A33F',
                    ['==', ['get', 'type'], 'Ciclofaixa'], '#84CC16',
                    ['==', ['get', 'type'], 'Ciclorrota'], '#D97706',
                    ['==', ['get', 'type'], 'Calçada compartilhada'], '#DC2626',
                    '#00ff00' // Default fallback color
                ],
                'line-width': [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"],
                        6, 2,
                        18, 8
                ]
            },
            filter: ['==', '$type', 'LineString']
        // }, layerUnderneathName);
        });
    }

    componentDidUpdate(prevProps) {
        const map = this.map;

        if (!map) {
            return;
        }

        if (this.props.data !== prevProps.data) {
            map.getSource('osm').setData(this.props.data);
        }

        if (this.props.style !== prevProps.style) {
            console.debug('new style', this.props.style);
            map.setStyle(this.props.style);
            // this.initLayers();
        }

        if (this.props.showSatellite !== prevProps.showSatellite) {
            map.setLayoutProperty(
                'mapbox-satellite',
                'visibility',
                this.props.showSatellite ? 'visible' : 'none');
        }


        // if (this.props.zoom !== prevProps.zoom) {
        //     map.setZoom(this.props.zoom);
        // }

        if (this.props.center !== prevProps.center) {
            map.setCenter(this.props.center);
        }

        // Compare only 'isActive' field of layers
        const currentActiveStatuses = this.props.layers.map(l => l.isActive).join();
        const prevActiveStatus = prevProps.layers.map(l => l.isActive).join();
        if (currentActiveStatuses === prevActiveStatus) {
            this.props.layers.forEach( l => {
                if (map.getLayer(l.id)) {
                    const status = l.isActive ? 'visible' : 'none';
                    map.setLayoutProperty(l.id, 'visibility', status);
                    if (l.type === 'way') {
                        map.setLayoutProperty(l.id+'--interactive', 'visibility', status);
                        if (l.style.borderColor) {
                            map.setLayoutProperty(l.id+'--border', 'visibility', status);
                        }
                    } else if (l.type === 'poi') {
                        // Handle POI layers - show/hide based on isActive only
                        const status = l.isActive ? 'visible' : 'none';
                        
                        if (map.getLayer(l.id)) {
                            map.setLayoutProperty(l.id, 'visibility', status);
                        }
                    }
                }
            })
        }

        if (this.props.isSidebarOpen !== prevProps.isSidebarOpen) {
            map.resize();
        }

        // Handle directions changes
        if (this.props.directions !== prevProps.directions) {
            this.updateDirectionsLayer(this.props.directions);
            this.updateCyclablePathsOpacity();
        }

        // Handle route coverage data changes (for showing all route overlaps)
        if (this.props.routeCoverageData !== prevProps.routeCoverageData) {
            this.updateOverlappingCyclepathsLayer(this.props.routeCoverageData);
        }

        // Handle selected route changes
        if (this.props.selectedRouteIndex !== prevProps.selectedRouteIndex) {
            this.updateSelectedRoute(this.props.selectedRouteIndex);
        }

        // Handle hovered route changes
        if (this.props.hoveredRouteIndex !== prevProps.hoveredRouteIndex) {
            this.updateHoveredRoute(this.props.hoveredRouteIndex);
        }
    }

    updateDirectionsLayer(directions) {
        const map = this.map;
        if (!map) return;

        // Check if directions sources exist (they might not be initialized yet)
        if (!map.getSource('directions-route')) {
            console.warn('Directions sources not yet initialized, skipping update');
            return;
        }

        // Update the existing layers' data
        if (directions && directions.routes && directions.routes.length > 0) {
            // Create a combined GeoJSON with all routes
            const allRoutes = {
                type: 'FeatureCollection',
                features: directions.routes.map((route, index) => ({
                    type: 'Feature',
                    id: index, // Add explicit ID for feature state
                    properties: { 
                        routeIndex: index,
                        distance: route.distance,
                        duration: route.duration
                    },
                    geometry: route.geometry
                }))
            };
            
            // Update the route layer with all routes
            map.getSource('directions-route').setData(allRoutes);
            
            if (directions.bbox) { 
                map.fitBounds(directions.bbox, { padding: 100, duration: 2000 }); 
            }
        } else {
            // Clear the directions by setting empty data
            map.getSource('directions-route').setData({ type: 'FeatureCollection', features: [] });
        }
    }

    updateOverlappingCyclepathsLayer(routeCoverageData) {
        const map = this.map;
        if (!map) return;

        // Check if overlapping cyclepaths source exists (it might not be initialized yet)
        if (!map.getSource('overlapping-cyclepaths')) {
            console.warn('Overlapping cyclepaths source not yet initialized, skipping update');
            return;
        }

        let allOverlappingCyclepaths = [];
        let featureId = 0;

        if (routeCoverageData && routeCoverageData.length > 0) {
            // Process routeCoverageData array
            routeCoverageData.forEach((routeData, routeIndex) => {
                if (routeData && routeData.overlappingCyclepaths && routeData.overlappingCyclepaths.length > 0) {
                    routeData.overlappingCyclepaths.forEach((segment) => {
                        allOverlappingCyclepaths.push({
                            type: 'Feature',
                            id: featureId++,
                            properties: {
                                ...segment.properties,
                                routeIndex: routeIndex,
                                // Use debug_cyclepath_type for styling since these are overlap segments
                                type: segment.properties.debug_cyclepath_type || 'Unknown'
                            },
                            geometry: segment.geometry
                        });
                    });
                }
            });
        }

        const cyclepathsGeoJSON = {
            type: 'FeatureCollection',
            features: allOverlappingCyclepaths
        };
        
        // Update the overlapping cyclepaths layer
        map.getSource('overlapping-cyclepaths').setData(cyclepathsGeoJSON);
    }

    updateSelectedRoute(selectedRouteIndex) {
        const map = this.map;
        if (!map || !map.getSource('directions-route')) return;

        // Clear all selected and hover states
        const features = map.querySourceFeatures('directions-route');
        features.forEach((feature, index) => {
            map.setFeatureState(
                { source: 'directions-route', id: index },
                { selected: false, hover: false }
            );
        });

        // Set the selected route
        if (selectedRouteIndex !== null && selectedRouteIndex !== undefined) {
            map.setFeatureState(
                { source: 'directions-route', id: selectedRouteIndex },
                { selected: true }
            );
        }
    }

    clearAllHoverStates() {
        const map = this.map;
        if (!map || !map.getSource('directions-route')) return;

        // Clear all hover states
        const features = map.querySourceFeatures('directions-route');
        features.forEach((feature, index) => {
            map.setFeatureState(
                { source: 'directions-route', id: index },
                { hover: false }
            );
        });
        
        // Reset tracking variable
        this.currentHoveredRoute = null;
    }

    updateHoveredRoute(hoveredRouteIndex) {
        const map = this.map;
        if (!map || !map.getSource('directions-route')) return;

        // Clear all hover states first
        const features = map.querySourceFeatures('directions-route');
        features.forEach((feature, index) => {
            map.setFeatureState(
                { source: 'directions-route', id: index },
                { hover: false }
            );
        });

        // Set hover state for the specified route
        if (hoveredRouteIndex !== null && hoveredRouteIndex !== undefined) {
            map.setFeatureState(
                { source: 'directions-route', id: hoveredRouteIndex },
                { hover: true }
            );
        }
    }

    updateCyclablePathsOpacity() {
        const map = this.map;
        if (!map) return;

        // Check if there are active directions/routes
        const hasRoutes = this.props.directions && 
                         this.props.directions.routes && 
                         this.props.directions.routes.length > 0;

        // Get all features from the OSM source
        const features = map.querySourceFeatures('osm');
        
        // Set feature state for all features in the OSM source
        features.forEach(feature => {
            map.setFeatureState(
                { source: 'osm', id: feature.id },
                { 'routes-active': hasRoutes }
            );
        });
    }

    componentDidMount() {
        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

        this.map = new mapboxgl.Map({
            container: this.mapContainer,
            style: this.props.style,
            center: this.props.center,
            zoom: this.props.zoom,
            attributionControl: false
        }).addControl(new mapboxgl.AttributionControl({
            compact: false
        }));

        // Pass the map reference to the parent component
        if (this.props.setMapRef) {
            this.props.setMapRef(this.map);
        }

        this.popups = new MapPopups(this.map, this.props.debugMode);

        
        // Native Mapbox map controls

        if (!this.props.embedMode) {
            if (!IS_MOBILE) {
                this.searchBar = new MapboxGeocoder({
                    accessToken: mapboxgl.accessToken,
                    mapboxgl: mapboxgl,
                    language: 'pt-br',
                    placeholder: 'Buscar endereços, estabelecimentos, ...',
                    countries: IS_PROD ? 'br' : '',
                    // collapsed: IS_MOBILE
                });
                this.map.addControl(this.searchBar, 'bottom-right');
            }
    
            const cityPicker = new MapboxGeocoder({
                accessToken: mapboxgl.accessToken,
                mapboxgl: mapboxgl,
                language: 'pt-br',
                placeholder: `Buscar cidades ${IS_PROD ? 'brasileiras' : 'no mundo'}`,
                countries: IS_PROD ? 'br' : '',
                types: 'place',
                marker: false,
                clearOnBlur: true,
                flyTo: false
            });
            cityPicker.on('result', result => {
                console.debug('geocoder result', result);
    
                let flyToPos;
                if (result.place_name === 'Vitória, Espírito Santo, Brasil') {
                    flyToPos = [-40.3144, -20.2944];
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
            
            
            // this.map.addControl(new mapboxgl.FullscreenControl({
            //     container: document.querySelector('body')
            // }), 'bottom-right');
        }

        this.loadImages();
        
        // Listeners

        this.map.on('style.load', () => {
            console.debug('style.load');
            this.initLayers();
        });

        
        // Initialize map data center
        
        this.reverseGeocode(this.props.center);
    }

    loadImages() {
        // Load comment icon if not already loaded
        if (!this.map.hasImage('commentIcon')) {
            this.map.loadImage( commentIcon, (error, image) => {
                if (error) throw error;
                this.map.addImage('commentIcon', image);
            });
        }

        // Load all other icons if not already loaded
        Object.keys(iconsMap).forEach(key => {
            if (!this.map.hasImage(key)) {
                this.map.loadImage( iconsMap[key], (error, image) => {
                    if (error) throw error;
                    this.map.addImage(key, image);
                });
            }
        });
    }


    initLayers() {
        // The order in which layers are initialized will define their paint order
        this.initGeojsonLayers(this.props.layers);
        this.initDirectionsLayers();
        this.initOverlappingCyclepathsLayer();
            
        if (ENABLE_COMMENTS) {
            this.initCommentsLayer();
        }

        // Restore current directions if they exist
        if (this.props.directions) {
            this.updateDirectionsLayer(this.props.directions);
            
            // Restore selected and hovered route states
            if (this.props.selectedRouteIndex !== null && this.props.selectedRouteIndex !== undefined) {
                this.updateSelectedRoute(this.props.selectedRouteIndex);
            }
            if (this.props.hoveredRouteIndex !== null && this.props.hoveredRouteIndex !== undefined) {
                this.updateHoveredRoute(this.props.hoveredRouteIndex);
            }
        }

        // Restore overlapping cyclepaths if they exist
        if (this.props.routeCoverageData && this.props.routeCoverageData.length > 0) {
            this.updateOverlappingCyclepathsLayer(this.props.routeCoverageData);
        }

        this.onMapMoved();

        // Set initial cyclable paths opacity based on current directions state
        this.updateCyclablePathsOpacity();

        this.map.on('moveend', this.onMapMoved);
    }

    newComment() {
        this.setState({ showCommentCursor: true }, () => {
            this.map.once('click', e => {
                this.newCommentCoords = e.lngLat;
                this.showCommentModal();
            });
        })
    }

    render() {
        return (
            <>
                {/* Thanks https://blog.mapbox.com/mapbox-gl-js-react-764da6cc074a */}
                <div ref={el => this.mapContainer = el}></div>

                {
                    ENABLE_COMMENTS &&
                    this.state.showCommentCursor &&
                    <NewCommentCursor/>
                }

                {
                    ENABLE_COMMENTS &&
                    <CommentModal
                        location={this.props.location}
                        visible={this.state.showCommentModal}
                        tagsList={this.state.tagsList}
                        coords={this.newCommentCoords}
                        airtableDatabase={this.airtableDatabase}
                        afterCreate={this.afterCommentCreate}
                        onCancel={this.hideCommentModal}
                    />
                }
            </>
        )
    }
}

// Wrapper component to use the directions context with the class component
const MapWrapper = (props) => {
    const directionsContext = useDirections();
    
    return (
        <Map
            {...props}
            directions={directionsContext.directions}
            selectedRouteIndex={directionsContext.selectedRouteIndex}
            hoveredRouteIndex={directionsContext.hoveredRouteIndex}
            routeCoverageData={directionsContext.routeCoverageData}
            onRouteSelected={directionsContext.selectRoute}
            onRouteHovered={directionsContext.hoverRoute}
            isInRouteMode={directionsContext.isInRouteMode}
        />
    );
};

export default MapWrapper;