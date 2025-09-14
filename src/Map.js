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
    MAP_STYLES,
    POI_ZOOM_THRESHOLD,
    COMMENTS_ZOOM_THRESHOLD,
    DIRECTIONS_LINE_WIDTH,
    DIRECTIONS_LINE_BORDER_WIDTH,
} from './constants.js'

import Analytics from './Analytics.js'
import AirtableDatabase from './AirtableDatabase.js'
import CommentModal from './CommentModal.js'
import NewCommentCursor from './NewCommentCursor.js'
import MapPopups from './MapPopups.js'
import { adjustColorBrightness } from './utils.js'

import './Map.css'

import capitalsGeojson from './brazil_capitals.geojson';

// @todo: improve this please
import commentIcon from './img/icons/poi-comment.png';

import bikeparkingIcon from './img/icons/poi-bikeparking.png';
import bikeparkingIconLight from './img/icons/poi-bikeparking--light.png';
import bikeparkingIcon2x from './img/icons/poi-bikeparking@2x.png';
import bikeparkingIconMini from './img/icons/poi-bikeparking-mini.png';
import bikeparkingIconMiniLight from './img/icons/poi-bikeparking-mini--light.png';
import bikeshopIcon from './img/icons/poi-bikeshop.png';
import bikeshopIconLight from './img/icons/poi-bikeshop--light.png';
import bikeshopIcon2x from './img/icons/poi-bikeshop@2x.png';
import bikeshopIconMini from './img/icons/poi-bikeshop-mini.png';
import bikeshopIconMiniLight from './img/icons/poi-bikeshop-mini--light.png';
import bikerentalIcon from './img/icons/poi-bikerental.png';
import bikerentalIconLight from './img/icons/poi-bikerental--light.png';
import bikerentalIcon2x from './img/icons/poi-bikerental@2x.png';
import bikerentalIconMini from './img/icons/poi-bikerental-mini.png';
import bikerentalIconMiniLight from './img/icons/poi-bikerental-mini--light.png';

const iconsMap = {
    "poi-comment": commentIcon,
    "poi-bikeparking": bikeparkingIcon,
    "poi-bikeparking--light": bikeparkingIconLight,
    "poi-bikeparking-2x": bikeparkingIcon2x,
    "poi-bikeparking-mini": bikeparkingIconMini,
    "poi-bikeparking-mini--light": bikeparkingIconMiniLight,
    "poi-bikeshop": bikeshopIcon,
    "poi-bikeshop--light": bikeshopIconLight,
    "poi-bikeshop-2x": bikeshopIcon2x,
    "poi-bikeshop-mini": bikeshopIconMini,
    "poi-bikeshop-mini--light": bikeshopIconMiniLight,
    "poi-rental": bikerentalIcon,
    "poi-rental--light": bikerentalIconLight,
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
            ),
        ];
    }

    initPOILayer(l) {
        const filters = this.convertFilterToMapboxFilter(l);

        // Base layer configuration
        const baseLayerConfig = {
            'type': 'symbol',
            'source': "osmdata",
            "filter": filters,
            "description": l.description,
            'layout': {
                'text-field': [ 'step', ['zoom'], '', POI_ZOOM_THRESHOLD, ['get', 'name'], ],
                'text-font': ['IBM Plex Sans Medium'],
                'text-letter-spacing': 0.05,
                "text-offset": [0, 1.5],
                "text-max-width": 8,
                'text-size': [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"], 
                        10, 10,
                        18, 14
                ],
                'text-variable-anchor': ['top'],
                "icon-padding": 0,
                "icon-allow-overlap": [
                    'step',
                    ['zoom'],
                    false,
                    POI_ZOOM_THRESHOLD,
                    true
                ],
                'icon-size': 1,
            },
            'paint': {
                'text-color': l.style.textColor || 'white',
                'text-halo-width': 1,
                'text-opacity': ['case',
                    ['boolean', ['feature-state', 'hover'], false],
                    0.7,
                    1.0
                ],
                'icon-opacity': ['case',
                    ['boolean', ['feature-state', 'hover'], false],
                    0.7,
                    1.0
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
                    this.props.isDarkMode ? `${l.icon}` : `${l.icon}--light`,
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
            if (e.features.length > 0) {
                // Disable POI hover effects when in route mode
                if (self.props.isInRouteMode) {
                    e.originalEvent.preventDefault();
                    return;
                }
                self.map.getCanvas().style.cursor = 'pointer';

                if (self.hoveredPOI) {
                    self.map.setFeatureState({
                        source: "osmdata",
                        id: self.hoveredPOI },
                        { hover: false });
                }
                self.hoveredPOI = e.features[0].id;
                self.map.setFeatureState({
                    source: "osmdata",
                    id: self.hoveredPOI },
                    { hover: true });
            }
            e.originalEvent.preventDefault();
        });

        this.map.on('mouseleave', l.id, e => {
            if (self.hoveredPOI) {
                self.map.getCanvas().style.cursor = '';

                self.map.setFeatureState({
                    source: "osmdata",
                    id: self.hoveredPOI },
                    { hover: false });
            }
            self.hoveredPOI = null;
        });

        this.map.on('click', l.id, e => {
            if (e && e.features && e.features.length > 0 && !e.originalEvent.defaultPrevented) {
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

    initBoundaryLayer() {
        const filters = this.convertFilterToMapboxFilter({
            filters: [
                ["boundary", "administrative"],
                ["admin_level", "6"],
                ["admin_level", "7"],
                ["admin_level", "8"],
                ["admin_level", "9"],
                ["admin_level", "10"]
            ]}
        );

        this.map.addLayer({
            'id': 'boundary-layer',
            'type': 'line',
            'source': 'osmdata',
            'name': 'Limites',
            'filter': filters,
            'paint': {
                'line-color': this.props.isDarkMode ? '#FFFFFF' : '#000000',
                'line-dasharray': [1, 1],
                'line-width': 2,
                'line-opacity': 0.3
            }
        });

        // this.updateWorldMask();
    }

    // updateWorldMask() {
    //     const boundaryData = this.props.boundaryData;
        
    //     // Remove existing mask if no boundary data
    //     if (!boundaryData || !boundaryData.features || boundaryData.features.length === 0) {
    //         if (this.map.getLayer('city-boundary-mask')) {
    //             this.map.removeLayer('city-boundary-mask');
    //         }
    //         if (this.map.getSource('worldMaskSrc')) {
    //             this.map.removeSource('worldMaskSrc');
    //         }
    //         return;
    //     }

    //     // Create world polygon with hole for city boundary
    //     const worldPolygonWithHole = {
    //         'type': 'Feature',
    //         'geometry': {
    //             'type': 'Polygon',
    //             'coordinates': [
    //                 // Outer ring - covers the entire world
    //                 [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]],
    //                 // Inner ring - hole for the city boundary
    //                 boundaryData.features[0].geometry.coordinates[0]
    //             ]
    //         }
    //     };

    //     const maskData = {
    //         'type': 'FeatureCollection',
    //         'features': [worldPolygonWithHole]
    //     };

    //     // Add or update source
    //     if (!this.map.getSource('worldMaskSrc')) {
    //         this.map.addSource('worldMaskSrc', {
    //             'type': 'geojson',
    //             'data': maskData
    //         });

    //         // Add mask layer
    //         this.map.addLayer({
    //             'id': 'city-boundary-mask',
    //             'type': 'fill',
    //             'source': 'worldMaskSrc',
    //             'paint': {
    //                 'fill-color': this.props.isDarkMode ? '#000000' : '#ffffff',
    //                 'fill-opacity': 0.5
    //             }
    //         });
    //     } else {
    //         // Update existing source
    //         this.map.getSource('worldMaskSrc').setData(maskData);
    //     }
    // }

    initCyclepathLayer(l) {
        const filters = this.convertFilterToMapboxFilter(l);
        const dashedLineStyle = { 'line-dasharray': [1, 1] };
        // Will be used as "beforeId" prop in AddLayer
        const layerUnderneathName = this.map.getLayer('road-label-small') ? 'road-label-small' : '';
        const self = this;

        // Interactive layer is wider than the actual layer to improve usability
        this.map.addLayer({
            "id": l.id + '--interactive',
            "type": "line",
            "source": "osmdata",
            "filter": filters,
            "paint": {
                "line-opacity": 0,
                "line-color": 'yellow',
                "line-width": 20
            },
        }, layerUnderneathName);

        // Normal state layer
        this.map.addLayer({
            "id": l.id,
            "type": "line",
            "source": "osmdata",
            "name": l.name,
            "description": l.description,
            "filter": filters,
            "paint": {
                "line-color": [
                    "case",
                    ["boolean", ["feature-state", "hover"], false],
                    adjustColorBrightness(l.style.lineColor, this.props.isDarkMode ? -0.3 : 0.3), // On hover
                    adjustColorBrightness(l.style.lineColor, this.props.isDarkMode ? 0 : -0.1)
                ],
                "line-offset": [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"],
                        10, [
                            "case",
                                ["has", "cycleway:right"], Math.max(1, l.style.lineWidth/4),
                                ["has", "cycleway:left"], Math.min(-1, -l.style.lineWidth/4),
                                0
                        ],
                        18, [
                            "case",
                                ["has", "cycleway:right"], l.style.lineWidth * DEFAULT_LINE_WIDTH_MULTIPLIER,
                                ["has", "cycleway:left"], -l.style.lineWidth * DEFAULT_LINE_WIDTH_MULTIPLIER,
                                0
                        ]
                    ],
                "line-width": [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"],
                        10, Math.max(1, l.style.lineWidth/4),
                        18, l.style.lineWidth * DEFAULT_LINE_WIDTH_MULTIPLIER
                    ],
                    ...(l.style.lineStyle === 'dashed' && dashedLineStyle)
                },
                "layout": (l.style.lineStyle === 'dashed') ? {} : { "line-join": "round", "line-cap": "round" },
            }, layerUnderneathName);

        // Routes-active state layer (initially hidden)
        this.map.addLayer({
            "id": l.id + '--routes-active',
            "type": "line",
            "source": "osmdata",
            "name": l.name + ' (Routes Active)',
            "description": l.description,
            "filter": filters,
            "paint": {
                "line-color": adjustColorBrightness(l.style.lineColor, this.props.isDarkMode ? -0.6 : 0.4),
                "line-width": [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"],
                        10, Math.max(1, l.style.lineWidth/4),
                        18, l.style.lineWidth * DEFAULT_LINE_WIDTH_MULTIPLIER
                    ],
                    ...(l.style.lineStyle === 'dashed' && dashedLineStyle)
                },
                "layout": {
                    ...(l.style.lineStyle === 'dashed' ? {} : { "line-join": "round", "line-cap": "round" }),
                    "visibility": "none"
                },
            }, layerUnderneathName);

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
                //     self.map.setFeatureState({ source: "osmdata", id: self.selectedCycleway }, { hover: false });
                // }
                // self.selectedCycleway = e.features[0].id;
                // self.map.setFeatureState({ source: "osmdata", id: self.selectedCycleway }, { hover: true });

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
                'icon-image': this.props.isDarkMode ? 'city-dark' : 'city',
                'icon-color': this.props.isDarkMode ? '#B6F9D1' : '#059669',
                'icon-size': 1,
                "text-allow-overlap": true,
                'text-field': ['get', 'name'],
                'text-font': ['IBM Plex Sans Bold'],
                "text-offset": [0, 0.8],
                'text-size': [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"], 
                        4, 12,
                        10, 18
                ],
                'text-variable-anchor': ['top'],
            },
            'paint': {
                'text-opacity': [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"], 
                        4, 1,
                        11, 0
                ],
                'icon-opacity': [
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

        if (!map.getSource("osmdata")) {
            map.addSource("osmdata", {
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

            this.initBoundaryLayer();

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
                        map.setFeatureState({ source: "osmdata", id: self.hoveredCycleway }, { hover: false });
                    }
                    self.hoveredCycleway = features[0].id;
                    map.setFeatureState({ source: "osmdata", id: self.hoveredCycleway }, { hover: true });
                } else {
                    // Hover style
                    if (self.hoveredCycleway && !self.selectedCycleway) {
                        map.setFeatureState({ source: "osmdata", id: self.hoveredCycleway }, { hover: false });
        
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

    createRouteLayerSet(map, sourceId, layerType) {
        const suffix = layerType === 'top' ? '-selected' : 's-unselected';
        
        // 1. Padding layer
        map.addLayer({
            id: `route-padding${suffix}`,
            type: 'line',
            source: sourceId,
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

        // 2. Border layer
        map.addLayer({
            id: `route--border${suffix}`,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': layerType === 'top' 
                    ? (this.props.isDarkMode ? '#ffffff' : '#211F1C') // Selected route border
                    : [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                            this.props.isDarkMode ? '#ffffff' : '#211F1C', // On hover
                            this.props.isDarkMode ? '#999999' : '#7A7A78', // Default
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

        // 3. Main route layer
        map.addLayer({
            id: `route${suffix}`,
            type: 'line',
            source: sourceId,
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': layerType === 'top'
                    ? (this.props.isDarkMode ? '#000000' : '#FFFFFF') // Selected route color
                    : [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                            this.props.isDarkMode ? '#000000' : '#FFFFFF', // On hover
                            this.props.isDarkMode ? '#444547' : '#C5C3C1'  // Default unselected
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
    }

    setupRouteEventHandlers(map) {
        const self = this;
        
        // Set up click handlers for both top and bottom layers
        ['route-selected', 'routes-unselected'].forEach(layerId => {
            map.on('click', layerId, (e) => {
                if (e.features && e.features.length > 0) {
                    const routeIndex = e.features[0].properties.routeIndex;
                    if (self.props.onRouteSelected) {
                        self.props.onRouteSelected(routeIndex);
                    }
                }
            });
        });

        // Track currently hovered route
        this.currentHoveredRoute = null;

        // Set up hover handlers for both top and bottom layers
        ['route-selected', 'routes-unselected'].forEach(layerId => {
            map.on('mouseenter', layerId, (e) => {
                map.getCanvas().style.cursor = 'pointer';
                
                // if (e.features && e.features.length > 0) {
                //     const routeIndex = e.features[0].properties.routeIndex;
                //     this.currentHoveredRoute = routeIndex;
                    
                //     // Determine which source this layer belongs to
                //     const sourceId = layerId === 'route-selected' ? 'route-selected' : 'routes-unselected';
                //     map.setFeatureState(
                //         { source: sourceId, id: routeIndex },
                //         { hover: true }
                //     );
                    
                //     if (self.props.onRouteHovered) {
                //         self.props.onRouteHovered(routeIndex);
                //     }
                // }
            });

            map.on('mouseleave', layerId, (e) => {
                map.getCanvas().style.cursor = '';
                
                // if (this.currentHoveredRoute !== null) {
                //     // Determine which source this layer belongs to
                //     const sourceId = layerId === 'route-selected' ? 'route-selected' : 'routes-unselected';
                //     map.setFeatureState(
                //         { source: sourceId, id: this.currentHoveredRoute },
                //         { hover: false }
                //     );
                //     this.currentHoveredRoute = null;
                // }
                
                // if (self.props.onRouteUnhovered) {
                //     self.props.onRouteUnhovered();
                // }
            });
        });
    }

    initDirectionsLayers() {
        const map = this.map;
        if (!map || map.getSource("route-selected")) return;

        const emptySource = {
            "type": "geojson",
            "data": {
                'type': 'FeatureCollection',
                'features': []
            }
        }
        map.addSource("route-selected", emptySource);
        map.addSource("routes-unselected", emptySource);
        this.createRouteLayerSet(map, 'routes-unselected', 'bottom');
        this.createRouteLayerSet(map, 'route-selected', 'top');
        this.setupRouteEventHandlers(map);
    }

    initOverlappingCyclepathsLayer() {
        const map = this.map;
        // const layerUnderneathName = this.map.getLayer('road-label-small') ? 'road-label-small' : '';
        if (!map || map.getSource("overlapping-cyclepaths")) return;

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
                    ['==', ['get', 'type'], 'Ciclorrota'], '#F6CA5D',
                    ['==', ['get', 'type'], 'Calçada compartilhada'], '#F56743',
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
            map.getSource("osmdata").setData(this.props.data);
        }


        if (this.props.style !== prevProps.style) {
            console.debug('new style', this.props.style);
            map.setStyle(this.props.style);
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
            // Use the unified layer visibility update method
            this.updateLayerVisibility();
        }

        if (this.props.isSidebarOpen !== prevProps.isSidebarOpen) {
            map.resize();
        }

        // Handle directions changes
        if (this.props.directions !== prevProps.directions) {
            this.updateDirectionsLayer(this.props.directions);
            this.updateCyclablePathsOpacity();
            this.updateRouteTooltips();
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
        if (!map.getSource('route-selected') || !map.getSource('routes-unselected')) {
            console.warn('Directions sources not yet initialized, skipping update');
            return;
        }

        if (directions && directions.routes && directions.routes.length > 0) {
            // Create GeoJSON features for all routes
            const routeFeatures = directions.routes.slice().reverse().map((route) => ({
                type: 'Feature',
                id: route.sortedIndex, // Add explicit ID for feature state
                properties: { 
                    routeIndex: route.sortedIndex,
                    distance: route.distance,
                    duration: route.duration
                },
                geometry: route.geometry
            }));

            // Progressively add all routes
            // this.progressivelyAddAllRoutes(routeFeatures, this.props.selectedRouteIndex);

            // Distribute routes between top and bottom layers based on current selection
            this.distributeRoutesBetweenLayers(routeFeatures);
            
            if (directions.bbox) { 
                map.fitBounds(directions.bbox, { padding: 100, duration: 2000 }); 
            }
        } else {
            // Clear both sources
            const emptyData = { type: 'FeatureCollection', features: [] };
            map.getSource('route-selected').setData(emptyData);
            map.getSource('routes-unselected').setData(emptyData);
        }
    }

    distributeRoutesBetweenLayers(routeFeatures) {
        const map = this.map;
        const selectedRouteIndex = this.props.selectedRouteIndex;
        
        // If there's a selected route, put it in top layer and others in bottom
        if (selectedRouteIndex !== null && selectedRouteIndex !== undefined) {
            const selectedRoute = routeFeatures.find(f => f.properties.routeIndex === selectedRouteIndex);
            const otherRoutes = routeFeatures.filter(f => f.properties.routeIndex !== selectedRouteIndex);
            
            map.getSource('route-selected').setData({
                type: 'FeatureCollection',
                features: selectedRoute ? [selectedRoute] : []
            });
            
            map.getSource('routes-unselected').setData({
                type: 'FeatureCollection',
                features: otherRoutes
            });
        } else {
            // No selection, put all routes in bottom layer
            map.getSource('route-selected').setData({
                type: 'FeatureCollection',
                features: []
            });
            
            map.getSource('routes-unselected').setData({
                type: 'FeatureCollection',
                features: routeFeatures
            });
        }
    }

    progressivelyAddAllRoutes(routeFeatures, selectedRouteIndex) {
        const map = this.map;
        let selectedFeatures = [];
        let unselectedFeatures = [];
        
        // Separate selected and unselected routes
        const selectedRoute = selectedRouteIndex !== null && selectedRouteIndex !== undefined 
            ? routeFeatures.find(f => f.properties.routeIndex === selectedRouteIndex)
            : null;
        const unselectedRoutes = routeFeatures.filter(f => f.properties.routeIndex !== selectedRouteIndex);
        
        // Create ordered list: selected route first, then unselected routes
        const orderedRoutes = selectedRoute ? [selectedRoute, ...unselectedRoutes] : unselectedRoutes;
        let currentRouteIndex = 0;
        
        const addNextRoute = () => {
            if (currentRouteIndex >= orderedRoutes.length) return;
            
            const route = orderedRoutes[currentRouteIndex];
            const isSelected = selectedRouteIndex !== null && selectedRouteIndex !== undefined && 
                             route.properties.routeIndex === selectedRouteIndex;
            
            // Create progressive geometry for this route
            this.progressivelyAddRouteGeometry(route, isSelected, selectedFeatures, unselectedFeatures, map, () => {
                // When this route is complete, move to the next one
                currentRouteIndex++;
                setTimeout(addNextRoute, 0); // Small delay between routes
            });
        };
        
        // Start with the first route (selected if available)
        addNextRoute();
    }

    progressivelyAddRouteGeometry(route, isSelected, selectedFeatures, unselectedFeatures, map, onComplete) {
        const coordinates = route.geometry.coordinates;
        const chunkSize = 10;
        const targetFPS = 60; // Target 60 FPS
        const frameDelay = 1000 / targetFPS; // ~16.67ms per frame
        let currentCoordinates = [];
        let chunkIndex = 0;
        
        const addNextChunk = () => {
            const startIndex = chunkIndex * chunkSize;
            const endIndex = Math.min(startIndex + chunkSize, coordinates.length);
            
            // Add coordinates for this chunk
            for (let i = startIndex; i < endIndex; i++) {
                currentCoordinates.push(coordinates[i]);
            }
            
            // Create updated route with current coordinates
            const progressiveRoute = {
                ...route,
                geometry: {
                    ...route.geometry,
                    coordinates: [...currentCoordinates]
                }
            };
            
            // Update the appropriate layer
            if (isSelected) {
                selectedFeatures = [progressiveRoute];
                map.getSource('route-selected').setData({
                    type: 'FeatureCollection',
                    features: selectedFeatures
                });
            } else {
                // Find and update the route in unselected features
                const existingIndex = unselectedFeatures.findIndex(f => f.properties.routeIndex === route.properties.routeIndex);
                if (existingIndex >= 0) {
                    unselectedFeatures[existingIndex] = progressiveRoute;
                } else {
                    unselectedFeatures.push(progressiveRoute);
                }
                map.getSource('routes-unselected').setData({
                    type: 'FeatureCollection',
                    features: unselectedFeatures
                });
            }
            
            chunkIndex++;
            
            // Continue if there are more coordinates
            if (endIndex < coordinates.length) {
                setTimeout(addNextChunk, frameDelay);
            } else {
                // Route is complete, call the callback
                if (onComplete) onComplete();
            }
        };
        
        // Start the progressive addition
        addNextChunk();
    }

    progressivelyAddRoutes(routes, sourceName) {
        const map = this.map;
        let currentFeatures = [];
        
        routes.forEach((route, index) => {
            setTimeout(() => {
                currentFeatures.push(route);
                map.getSource(sourceName).setData({
                    type: 'FeatureCollection',
                    features: currentFeatures
                });
            }, index * 50); // 50ms delay between each route
        });
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
        
        // Update selected state after data is loaded
        this.updateOverlappingCyclepathsSelectedState(this.props.selectedRouteIndex);
    }

    updateSelectedRoute(selectedRouteIndex) {
        const map = this.map;
        if (!map || !map.getSource('route-selected') || !map.getSource('routes-unselected')) return;

        // Get all route features from both sources
        const topFeatures = map.querySourceFeatures('route-selected');
        const bottomFeatures = map.querySourceFeatures('routes-unselected');
        const allFeatures = [...topFeatures, ...bottomFeatures];

        // Clear all hover states (no more selected states needed)
        allFeatures.forEach((feature) => {
            const sourceId = topFeatures.includes(feature) ? 'route-selected' : 'routes-unselected';
            map.setFeatureState(
                { source: sourceId, id: feature.id },
                { hover: false }
            );
        });

        // Redistribute routes between layers based on new selection
        // We need to reconstruct the route features from the original directions data
        if (this.props.directions && this.props.directions.routes) {
            const routeFeatures = this.props.directions.routes.slice().reverse().map((route) => ({
                type: 'Feature',
                id: route.sortedIndex,
                properties: { 
                    routeIndex: route.sortedIndex,
                    distance: route.distance,
                    duration: route.duration
                },
                geometry: route.geometry
            }));
            this.distributeRoutesBetweenLayers(routeFeatures);
        }

        // Update overlapping cyclepaths selected states
        this.updateOverlappingCyclepathsSelectedState(selectedRouteIndex);
        
        // Update tooltip selected states
        this.updateTooltipSelectedState(selectedRouteIndex);
    }


    clearAllHoverStates() {
        const map = this.map;
        if (!map || !map.getSource('route-selected') || !map.getSource('routes-unselected')) return;

        // Clear all hover states from both sources
        const topFeatures = map.querySourceFeatures('route-selected');
        const bottomFeatures = map.querySourceFeatures('routes-unselected');
        const allFeatures = [...topFeatures, ...bottomFeatures];
        
        allFeatures.forEach((feature) => {
            const sourceId = topFeatures.includes(feature) ? 'route-selected' : 'routes-unselected';
            map.setFeatureState(
                { source: sourceId, id: feature.id },
                { hover: false }
            );
        });
        
        // Reset tracking variable
        this.currentHoveredRoute = null;
    }

    updateHoveredRoute(hoveredRouteIndex) {
        const map = this.map;
        if (!map || !map.getSource('route-selected') || !map.getSource('routes-unselected')) return;

        // Clear all hover states first
        const topFeatures = map.querySourceFeatures('route-selected');
        const bottomFeatures = map.querySourceFeatures('routes-unselected');
        const allFeatures = [...topFeatures, ...bottomFeatures];
        
        allFeatures.forEach((feature) => {
            const sourceId = topFeatures.includes(feature) ? 'route-selected' : 'routes-unselected';
            map.setFeatureState(
                { source: sourceId, id: feature.id },
                { hover: false }
            );
        });

        // Set hover state for the specified route
        if (hoveredRouteIndex !== null && hoveredRouteIndex !== undefined) {
            // Find which source contains the hovered route
            const hoveredFeature = allFeatures.find(f => f.properties.routeIndex === hoveredRouteIndex);
            if (hoveredFeature) {
                const sourceId = topFeatures.includes(hoveredFeature) ? 'route-selected' : 'routes-unselected';
                map.setFeatureState(
                    { source: sourceId, id: hoveredRouteIndex },
                    { hover: true }
                );
            }
        }
    }

    updateLayerVisibility() {
        const map = this.map;
        if (!map) return;

        const hasRoutes = this.props.directions && 
                         this.props.directions.routes && 
                         this.props.directions.routes.length > 0;

        // Update layer visibility based on both isActive status and routes state
        this.props.layers.forEach(layer => {
            if (layer.type === 'way') {
                // Normal layer: visible if isActive AND no routes
                if (map.getLayer(layer.id)) {
                    const normalStatus = (layer.isActive && !hasRoutes) ? 'visible' : 'none';
                    map.setLayoutProperty(layer.id, 'visibility', normalStatus);
                }
                
                // Routes-active layer: visible if isActive AND has routes
                if (map.getLayer(layer.id + '--routes-active')) {
                    const routesActiveStatus = (layer.isActive && hasRoutes) ? 'visible' : 'none';
                    map.setLayoutProperty(layer.id + '--routes-active', 'visibility', routesActiveStatus);
                }
                
                // Interactive layer follows the same logic as normal layer
                if (map.getLayer(layer.id + '--interactive')) {
                    const interactiveStatus = (layer.isActive && !hasRoutes) ? 'visible' : 'none';
                    map.setLayoutProperty(layer.id + '--interactive', 'visibility', interactiveStatus);
                }
            } else if (layer.type === 'poi') {
                // Handle POI layers - hide when routes are active, show when no routes and isActive
                const status = (layer.isActive && !hasRoutes) ? 'visible' : 'none';
                
                if (map.getLayer(layer.id)) {
                    map.setLayoutProperty(layer.id, 'visibility', status);
                }
            }
        });
        
        console.debug(`Updated layer visibility - routes active: ${hasRoutes}`);
    }

    updateCyclablePathsOpacity() {
        // This method now just calls the unified visibility update
        this.updateLayerVisibility();
    }

    updateRouteTooltips() {
        if (this.popups) {
            this.popups.updateRouteTooltips(
                this.props.directions,
                this.props.routeCoverageData,
                this.props.onRouteSelected,
                this.props.selectedRouteIndex
            );
        }
    }

    updateTooltipSelectedState(selectedRouteIndex) {
        if (this.popups) {
            this.popups.updateTooltipSelectedState(selectedRouteIndex);
        }
    }

    updateOverlappingCyclepathsSelectedState(selectedRouteIndex) {
        const map = this.map;
        if (!map || !map.getSource('overlapping-cyclepaths')) {
            return;
        }

        // Get features from the source - this will be empty if data isn't loaded yet
        const features = map.querySourceFeatures('overlapping-cyclepaths');
        if (features.length === 0) {
            // Data not loaded yet, try again after a short delay
            setTimeout(() => this.updateOverlappingCyclepathsSelectedState(selectedRouteIndex), 50);
            return;
        }

        // Clear all selected states
        features.forEach((feature) => {
            map.setFeatureState(
                { source: 'overlapping-cyclepaths', id: feature.id },
                { selected: false }
            );
        });

        // Set selected state for cyclepaths belonging to the selected route
        if (selectedRouteIndex !== null && selectedRouteIndex !== undefined) {
            features.forEach((feature) => {
                if (feature.properties && feature.properties.routeIndex === selectedRouteIndex) {
                    map.setFeatureState(
                        { source: 'overlapping-cyclepaths', id: feature.id },
                        { selected: true }
                    );
                }
            });
        }
    }


    componentDidMount() {
        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;

        this.map = new mapboxgl.Map({
            container: this.mapContainer,
            style: this.props.style,
            // style: MAP_STYLES.LIGHT,
            // config: {
            //     basemap: {
            //         lightPreset: this.props.style === MAP_STYLES.DARK ? "night" : "daytime",
            //     }
            // },
            center: this.props.center,
            zoom: this.props.zoom,
            attributionControl: false,
            dragRotate: false,
            pitchWithRotate: false
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

        // Try to be sure this will only be called once
        const styleLoadHandler = () => {
            console.debug('style.load');
            this.initLayers();
            this.map.off('style.load', styleLoadHandler);
        };
        this.map.on('style.load', styleLoadHandler);

        
        // Initialize map center
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

    componentWillUnmount() {
        if (this.popups) {
            this.popups.clearRouteTooltips();
        }
        document.removeEventListener('newComment', this.newComment);
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