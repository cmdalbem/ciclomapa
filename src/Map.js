import React, { Component } from 'react';
import { useDirections } from './DirectionsContext.js';

import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css';
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder'
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css'
import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';
import { PmTilesSource } from 'mapbox-pmtiles';

import {
    MAPBOX_ACCESS_TOKEN,
    IS_MOBILE,
    INTERACTIVE_LAYERS_ZOOM_THRESHOLD,
    DEFAULT_ZOOM,
    ENABLE_COMMENTS,
    IS_PROD,
    DEFAULT_LINE_WIDTH_MULTIPLIER,
    POI_ZOOM_THRESHOLD,
    COMMENTS_ZOOM_THRESHOLD,
    DIRECTIONS_LINE_WIDTH,
    DIRECTIONS_LINE_BORDER_WIDTH,
    MAP_AUTOCHANGE_AREA_ZOOM_THRESHOLD,
} from './constants.js'

import Analytics from './Analytics.js'
import AirtableDatabase from './AirtableDatabase.js'
import CommentModal from './CommentModal.js'
import NewCommentCursor from './NewCommentCursor.js'
import MapPopups from './MapPopups.js'
import { adjustColorBrightness } from './utils.js'
import debounce from 'lodash.debounce'

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
    debouncedMapStateSync;
    lastGeocodedPlaceName;

    constructor(props) {
        super(props);

        // Bind functions that'll be used as callbacks with Mapbox
        this.onMapMoveEnded = this.onMapMoveEnded.bind(this);
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

        // Create debounced map state sync function (only syncs if place name has been consistent for 3+ seconds)
        this.debouncedMapStateSync = debounce((placeName) => {
            console.debug('Syncing map state with consistent place:', placeName);
            this.syncMapState(placeName);
            document.querySelector('.city-picker span').setAttribute('style','opacity: 1');
        }, 1000);
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
            return Promise.reject(new Error('Invalid coordinates'));
        }

        return geocodingClient
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

                    return {
                        place_name: place.place_name,
                        bbox: place.bbox
                    };
                }
                
                // Reject if no valid results found
                return Promise.reject(new Error('No geocoding results found'));
            })
            .catch(err => {
                console.error('Reverse geocoding failed:', err);
                throw err;
            });
    }

    onMapMoveEnded() {
        this.syncMapState();
        
        if (this.map.getZoom() > MAP_AUTOCHANGE_AREA_ZOOM_THRESHOLD) {
            const center = this.map.getCenter();
            this.reverseGeocode([center.lng, center.lat])
                .then(result => {
                    const currentPlaceName = result.place_name;
                    console.debug('Geocoding result:', currentPlaceName);

                    if (!this.lastGeocodedPlaceName) {
                        // Initial case
                        this.lastGeocodedPlaceName = this.props.location;
                        console.debug('Initializing last geocoded place name:', this.lastGeocodedPlaceName);
                    } else {
                        // Check if this is the same place as the last geocoding result
                        if (this.lastGeocodedPlaceName === currentPlaceName) {
                            console.debug('Same place detected, not triggering debounced sync...');
                        } else {
                            console.debug('Different place detected, cancelling previous sync and starting new timer');

                            document.querySelector('.city-picker span').setAttribute('style','opacity: 0.5');

                            // Different place - cancel previous debounced call and start new timer
                            this.debouncedMapStateSync.cancel();
                            this.lastGeocodedPlaceName = currentPlaceName;
                            this.debouncedMapStateSync(currentPlaceName);
                        }
                    }
                })
                .catch(err => {
                    console.debug('Reverse geocoding failed:', err);
                });
        } else {
            console.debug('Map zoom is below auto change area zoom threshold');
            // document.querySelector('.city-picker span').setAttribute('style','opacity: 0.5');
        }
    }

    syncMapState(newArea) {
        const center = this.map.getCenter();
        const ret = {
            lat: center.lat,
            lng: center.lng,
            zoom: this.map.getZoom(),
        };

        if (newArea) {
            ret.area = newArea;
        }

        this.props.onMapMoved(ret);
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

    initPOILayerForSource(l, sourceId) {
        const filters = this.convertFilterToMapboxFilter(l);

        const sourceLayer = sourceId === 'osmdata' ? '' : 'default';
        const sourceSuffix = sourceId === 'osmdata' ? '' : '--pmtiles';
        const layerId = l.id + sourceSuffix;

        // @TODO temporary debug layer while we don't know what's wrong with Mapbox and symbol layers
        if (sourceId !== 'osmdata') {
            // this.map.addLayer({
            //     'id': layerId,
            //     "name": l.name,
            //     'source': sourceId,
            //     'source-layer': sourceLayer,
            //     "filter": filters,
            //     "description": l.description,
            //     type: 'circle',
            //     'paint': {
            //         'circle-radius': [
            //             'interpolate',
            //             ['linear'],
            //             ['zoom'],
            //             12, 2,
            //             POI_ZOOM_THRESHOLD, 7
            //         ],
            //         'circle-color': adjustColorBrightness(l.style.textColor, this.props.isDarkMode ? -0.2 : 0.2),
            //         'circle-stroke-width': [
            //             'interpolate',
            //             ['linear'],
            //             ['zoom'],
            //             12, 0,
            //             POI_ZOOM_THRESHOLD, 3
            //         ],
            //         'circle-opacity': ['case',
            //             ['boolean', ['feature-state', 'hover'], false],
            //             0.7,
            //             1.0
            //         ],
            //         'circle-stroke-color': this.props.isDarkMode ? '#000000' : '#ffffff'
            //     }
            // });
        } else {
            this.map.addLayer({
                'id': layerId,
                "name": l.name,
                'type': 'symbol',
                'source': sourceId,
                'source-layer': sourceLayer,
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
                    'icon-image': [
                        'step',
                        ['zoom'],
                        this.props.isDarkMode ? `${l.icon}-mini` : `${l.icon}-mini--light`,
                        POI_ZOOM_THRESHOLD,
                        this.props.isDarkMode ? `${l.icon}` : `${l.icon}--light`,
                    ],
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
                    ],
                    'text-halo-color': this.props.isDarkMode ? '#1c1a17' : '#ffffff',
                }
            });
        }

        // Interactions
        const self = this;

        this.map.on('mouseenter', layerId, (e) => {
            if (e.target.getZoom() < INTERACTIVE_LAYERS_ZOOM_THRESHOLD) {
                return;
            }
            if (e.features.length > 0) {
                if (self.props.isInRouteMode) {
                    e.originalEvent.preventDefault();
                    return;
                }
                self.map.getCanvas().style.cursor = 'pointer';

                if (self.hoveredPOI) {
                    self.map.setFeatureState({
                        source: sourceId,
                        sourceLayer: sourceLayer,
                        id: self.hoveredPOI },
                        { hover: false });
                }
                self.hoveredPOI = e.features[0].id;
                self.map.setFeatureState({
                    source: sourceId,
                    sourceLayer: sourceLayer,
                    id: self.hoveredPOI },
                    { hover: true });
            }
            e.originalEvent.preventDefault();
        });

        this.map.on('mouseleave', layerId, e => {
            if (self.hoveredPOI) {
                self.map.getCanvas().style.cursor = '';

                self.map.setFeatureState({
                    source: sourceId,
                    sourceLayer: sourceLayer,
                    id: self.hoveredPOI },
                    { hover: false });
            }
            self.hoveredPOI = null;
        });

        this.map.on('click', layerId, e => {
            if (e.target.getZoom() < INTERACTIVE_LAYERS_ZOOM_THRESHOLD) {
                return;
            }
            if (e && e.features && e.features.length > 0 && !e.originalEvent.defaultPrevented) {
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

    initCyclepathLayerForSource(l, sourceId) {
        const filters = this.convertFilterToMapboxFilter(l);
        const dashedLineStyle = { 'line-dasharray': [1, 1] };
        // Will be used as "beforeId" prop in AddLayer
        const layerUnderneathName = 
            this.map.getLayer('road-label-small') ? 'road-label-small'
                : this.map.getLayer('road-label') ? 'road-label'
                : '';
        const self = this;

        const sourceLayer = sourceId === 'osmdata' ? '' : 'default';

        const sourceSuffix = sourceId === 'osmdata' ? '' : '--pmtiles';
        const interactiveLayerId = l.id + '--interactive' + sourceSuffix;
        const normalLayerId = l.id + sourceSuffix;
        const routesActiveLayerId = l.id + '--routes-active' + sourceSuffix;

        console.debug('initCyclepathLayerForSource', normalLayerId);

        // Interactive layer is wider than the actual layer to improve usability
        this.map.addLayer({
            "id": interactiveLayerId,
            "type": "line",
            "source": sourceId,
            'source-layer': sourceLayer,
            "filter": filters,
            "paint": {
                "line-opacity": 0,
                "line-color": 'yellow',
                "line-width": 20
            },
        }, layerUnderneathName);

        this.map.addLayer({
            "id": normalLayerId,
            "type": "line",
            "source": sourceId,
            'source-layer': sourceLayer,
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

        this.map.addLayer({
            "id": routesActiveLayerId,
            "type": "line",
            "source": sourceId,
            'source-layer': sourceLayer,
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

        this.map.on('click', interactiveLayerId, e => {
            if (e.target.getZoom() < INTERACTIVE_LAYERS_ZOOM_THRESHOLD) {
                return;
            }
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

        // Since these structures are contiguous we need to use mousemove instead of mouseenter/mouseleave
        this.map.on('mousemove', interactiveLayerId, e => {
            if (e.features.length > 0) {
                if (e.target.getZoom() < INTERACTIVE_LAYERS_ZOOM_THRESHOLD) {
                    return;
                }
                if (self.props.isInRouteMode) {
                    return;
                }
                if (!e.features[0].id) {
                    console.error('No id found for hovered cycleway, make sure youre generating these ids either in mapbox or in the tile generation script', e.features[0]);
                    return;
                }

                self.map.getCanvas().style.cursor = 'pointer';
    
                if (self.hoveredCycleway) {
                    self.map.setFeatureState({
                        source: sourceId,
                        sourceLayer: sourceLayer,
                        id: self.hoveredCycleway
                    }, { hover: false });
                }
                self.hoveredCycleway = e.features[0].id;
                self.map.setFeatureState({
                    source: sourceId,
                    sourceLayer: sourceLayer,
                    id: self.hoveredCycleway
                }, { hover: true });
            } else {
                if (self.hoveredCycleway && !self.selectedCycleway) {
                    self.map.setFeatureState({
                        source: sourceId,
                        sourceLayer: sourceLayer,
                        id: self.hoveredCycleway
                    }, { hover: false });
    
                    self.map.getCanvas().style.cursor = '';
                }
                self.hoveredCycleway = null;
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
                        if (e.target.getZoom() < INTERACTIVE_LAYERS_ZOOM_THRESHOLD) {
                            return;
                        }
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


    async initializeDataSources() {
        if (!this.map.isStyleLoaded()) {
            await new Promise(resolve => {
                if (this.map.isStyleLoaded()) {
                    resolve();
                } else {
                    this.map.once('styledata', resolve);
                }
            });
        }

        if (!this.map.getSource("osmdata")) {
            this.map.addSource("osmdata", {
                "type": "geojson",
                "data": this.props.data || {
                    'type': 'FeatureCollection',
                    'features': []
                },
                "generateId": true
            });
        }

        try {
            const PMTILES_URL = process.env.REACT_APP_PMTILES_URL + 'all.pmtiles';
            console.log('Loading PMTiles from S3:', PMTILES_URL);
            
            const header = await PmTilesSource.getHeader(PMTILES_URL);
            console.log('PMTiles loaded - bounds:', [header.minLon, header.minLat, header.maxLon, header.maxLat], 'zoom:', header.minZoom + '-' + header.maxZoom);
            
            const bounds = [
                header.minLon,
                header.minLat,
                header.maxLon,
                header.maxLat,
            ];

            this.map.addSource('pmtiles-source', {
                type: PmTilesSource.SOURCE_TYPE,
                url: PMTILES_URL,
                minzoom: header.minZoom,
                maxzoom: header.maxZoom,
                bounds: bounds,
            });

            console.log('PMTiles source added successfully');
            this.pmtilesLoadedSuccessfully = true;
        } catch (error) {
            console.error('Error setting up PmTiles for cyclepaths:', error);
            this.pmtilesLoadedSuccessfully = false;
        }
    }

    onPMTilesLoaded() {
        this.pmtilesLoadedSuccessfully = true;

        document.querySelector('.city-picker').setAttribute('style', 'visibility: hidden;');
    }

    isPmtilesAvailable() {
        console.debug('pmtilesLoadedSuccessfully = ', this.pmtilesLoadedSuccessfully);
        if (this.pmtilesLoadedSuccessfully === undefined) {
            console.error('PmTiles loaded successfully status is undefined, this should not happen');
        }
        return this.pmtilesLoadedSuccessfully === true;
    }

    addInteractiveCapitalsLayer() {
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
    
                this.reverseGeocode(coords)
                    .then(result => {
                        this.syncMapState(result.place_name);
                    });
            }
        });
    }


    // Layers need to be initialized in the paint order
    // Afterwards their data can be updated safely without messing up the order
    async initGeojsonLayers(layers) {
        const map = this.map;

        // @todo Better way to check if layers are already initialized
        if (!map.getSource("osmdata")) {
            await this.initializeDataSources();

            if (!map.getSource("commentsSrc")) {
                map.addSource("commentsSrc", {
                    "type": "geojson",
                    "data": {
                        'type': 'FeatureCollection',
                        'features': []
                    },
                    "generateId": true
                });
            }

            this.initializeLayersForBothSources(layers);
            
            // this.initBoundaryLayer();

            if (!this.props.embedMode) {
                this.addInteractiveCapitalsLayer();
            }

        } else {
            console.warn('Map layers already initialized.');
        }

        if (map.getLayer('mapbox-satellite')) {
            map.setLayoutProperty(
                'mapbox-satellite',
                'visibility',
                this.props.showSatellite ? 'visible' : 'none');
        }
    }

    initializeLayersForBothSources(layers) {
        // layers.json is ordered from most to least important, but we 
        //   want the most important ones to be on top so we add in reverse.
        // Slice is used here to don't destructively reverse the original array.
        layers.slice().reverse().forEach(l => {
            if (!l.type || l.type === 'way') {
                if (this.pmtilesLoadedSuccessfully) {
                    this.initCyclepathLayerForSource(l, 'pmtiles-source');
                }
                
                this.initCyclepathLayerForSource(l, 'osmdata');
            } else if (l.type === 'poi' && l.filters) {
                if (this.pmtilesLoadedSuccessfully) {
                    this.initPOILayerForSource(l, 'pmtiles-source');
                }

                this.initPOILayerForSource(l, 'osmdata');
            }
        });
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
                    ['==', ['get', 'type'], 'Ciclorrota'], '#F56743',
                    ['==', ['get', 'type'], 'Calçada compartilhada'], '#F6CA5D',
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
            if (map.getSource("osmdata")) {
                map.getSource("osmdata").setData(this.props.data);
            }
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



        // Compare only 'isActive' field of layers
        const currentActiveStatuses = this.props.layers.map(l => l.isActive).join();
        const prevActiveStatus = prevProps.layers.map(l => l.isActive).join();
        if (currentActiveStatuses !== prevActiveStatus) {
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

        this.props.layers.forEach(layer => {
            if (layer.type === 'way') {
                ['', '--pmtiles'].forEach(sourceSuffix => {
                    const baseLayerId = layer.id + sourceSuffix;
                    const interactiveLayerId = layer.id + '--interactive' + sourceSuffix;
                    const routesActiveLayerId = layer.id + '--routes-active' + sourceSuffix;
                    
                    if (map.getLayer(baseLayerId)) {
                        const normalStatus = (layer.isActive && !hasRoutes) ? 'visible' : 'none';
                        map.setLayoutProperty(baseLayerId, 'visibility', normalStatus);
                    }
                    
                    if (map.getLayer(routesActiveLayerId)) {
                        const routesActiveStatus = (layer.isActive && hasRoutes) ? 'visible' : 'none';
                        map.setLayoutProperty(routesActiveLayerId, 'visibility', routesActiveStatus);
                    }
                    
                    if (map.getLayer(interactiveLayerId)) {
                        const interactiveStatus = (layer.isActive && !hasRoutes) ? 'visible' : 'none';
                        map.setLayoutProperty(interactiveLayerId, 'visibility', interactiveStatus);
                    }
                });
            } else if (layer.type === 'poi') {
                const status = (layer.isActive && !hasRoutes) ? 'visible' : 'none';
                
                ['', '--pmtiles'].forEach(sourceSuffix => {
                    const layerId = layer.id + sourceSuffix;
                    if (map.getLayer(layerId)) {
                        map.setLayoutProperty(layerId, 'visibility', status);
                    }
                });
            }
        });
        
        console.debug(`Updated layer visibility - routes active: ${hasRoutes}`);
    }

    updateCyclablePathsOpacity() {
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
        // Prevent multiple map initializations
        if (this.map) {
            console.warn('Map already initialized, skipping...');
            return;
        }

        mapboxgl.accessToken = MAPBOX_ACCESS_TOKEN;
        
        // Register PmTiles source type
        mapboxgl.Style.setSourceType(PmTilesSource.SOURCE_TYPE, PmTilesSource);
        
        try {
            console.log('Creating Mapbox map...');
            this.map = new mapboxgl.Map({
            container: this.mapContainer,
            style: this.props.style,
            // style: MAP_STYLES.LIGHT,
            // config: {
            //     basemap: {
            //         lightPreset: this.props.style === MAP_STYLES.DARK ? "night" : "daytime",
            //     }
            // },
            center: [this.props.lng, this.props.lat],
            zoom: this.props.zoom,
            attributionControl: false,
            dragRotate: false,
            pitchWithRotate: false
        }).addControl(new mapboxgl.AttributionControl({
            compact: false
        }));

        } catch (error) {
            console.error('Error creating Mapbox map:', error);
            throw error;
        }

        // Pass the map reference to the parent component
        if (this.props.setMapRef) {
            this.props.setMapRef(this.map);
        }

        this.popups = new MapPopups(this.map, this.props.debugMode);
        
        // Set up global function for popup routing button
        window.setDestinationFromPopup = (coordinates) => {
            if (this.props.directionsPanelRef && this.props.directionsPanelRef.setDestinationFromMapClick) {
                this.props.directionsPanelRef.setDestinationFromMapClick(coordinates);
                // Close all popups after setting destination
                this.popups.closeAllPopups();
            }
        };

        this.loadImages();
        
        // Initialize map after style is loaded
        this.initializeMapAfterStyleLoad();
        
        // Initialize map center
        this.reverseGeocode([this.props.lng, this.props.lat])
            .then(result => {
                this.syncMapState(result.place_name);
            });
    }

    initMapControls() {
        if (!this.props.embedMode) {
            if (!IS_MOBILE) {
                this.searchBar = new MapboxGeocoder({
                    accessToken: mapboxgl.accessToken,
                    mapboxgl: mapboxgl,
                    language: 'pt-br',
                    placeholder: 'Buscar endereços, estabelecimentos, ...',
                    countries: IS_PROD ? 'br' : '',
                    collapsed: true
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
    
                this.reverseGeocode(result.result.center)
                    .then(geocodeResult => {
                        this.syncMapState(geocodeResult.place_name);
                    });
    
                // Hide UI
                // @todo refactor this to use React state
                document.querySelector('body').classList.remove('show-city-picker');
                cityPicker.clear();
            });
            // Doesn't matter where we add this, it's customized via CSS
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
                this.reverseGeocode([result.coords.longitude, result.coords.latitude])
                    .then(geocodeResult => {
                        this.syncMapState(geocodeResult.place_name);
                    });
            });
            this.map.addControl(geolocate, 'bottom-right');
            
            
            // this.map.addControl(new mapboxgl.FullscreenControl({
            //     container: document.querySelector('body')
            // }), 'bottom-right');
        }
    }

    /**
     * Initialize map after style is fully loaded
     * Handles the complex Mapbox style loading lifecycle cleanly
     */
    initializeMapAfterStyleLoad() {
        const handleStyleReady = async () => {
            try {
                await this.initializeAfterStyleLoad();
            } catch (error) {
                console.error('Error initializing map after style load:', error);
            }
        };

        // If style is already loaded, initialize immediately
        if (this.map.isStyleLoaded()) {
            handleStyleReady();
            return;
        }

        // Otherwise, wait for style to load
        const styleLoadHandler = () => {
            console.debug('style.load');
            
            // If style data is ready, initialize immediately
            if (this.map.isStyleLoaded()) {
                handleStyleReady();
            } else {
                // Wait for style data to be ready
                this.map.once('styledata', handleStyleReady);
            }
            
            // Clean up the style.load listener
            this.map.off('style.load', styleLoadHandler);
        };

        this.map.on('style.load', styleLoadHandler);
    }

    async initializeAfterStyleLoad() {
        await this.initLayers();
        this.initMapControls();
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


    async initLayers() {
        // The order in which layers are initialized will define their paint order
        await this.initGeojsonLayers(this.props.layers);
        
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

        this.syncMapState();

        // Set initial cyclable paths opacity based on current directions state
        this.updateCyclablePathsOpacity();

        this.map.on('moveend', this.onMapMoveEnded);
    }

    componentWillUnmount() {
        if (this.popups) {
            this.popups.clearRouteTooltips();
        }
        document.removeEventListener('newComment', this.newComment);

        if (this.map) {
            // Remove all event listeners to prevent memory leaks
            this.map.off();
            
            // Remove all layers
            const style = this.map.getStyle();
            if (style && style.layers) {
                style.layers.forEach(layer => {
                    if (this.map.getLayer(layer.id)) {
                        this.map.removeLayer(layer.id);
                    }
                });
            }
            
            // Remove all sources
            if (style && style.sources) {
                Object.keys(style.sources).forEach(sourceId => {
                    if (this.map.getSource(sourceId)) {
                        this.map.removeSource(sourceId);
                    }
                });
            }
            
            // Remove the map instance
            this.map.remove();
            this.map = null;
        }
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