import React, { Component } from 'react';

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
} from './constants.js'

import AirtableDatabase from './AirtableDatabase.js'
import CommentModal from './CommentModal.js'
import NewCommentCursor from './NewCommentCursor.js'
import MapPopups from './MapPopups.js'

import './Map.css'

// @todo: improve this please
import commentIcon from './img/icons/poi-comment.png';

import bikeparkingIcon from './img/icons/poi-bikeparking.png';
import bikeparkingIcon2x from './img/icons/poi-bikeparking@2x.png';
import bikeparkingIconMini from './img/icons/poi-bikeparking-mini.png';
import bikeshopIcon from './img/icons/poi-bikeshop.png';
import bikeshopIcon2x from './img/icons/poi-bikeshop@2x.png';
import bikeshopIconMini from './img/icons/poi-bikeshop-mini.png';
import bikerentalIcon from './img/icons/poi-bikerental.png';
import bikerentalIcon2x from './img/icons/poi-bikerental@2x.png';
import bikerentalIconMini from './img/icons/poi-bikerental-mini.png';

const iconsMap = {
    "poi-comment": commentIcon,
    "poi-bikeparking": bikeparkingIcon,
    "poi-bikeparking-2x": bikeparkingIcon2x,
    "poi-bikeparking-mini": bikeparkingIconMini,
    "poi-bikeshop": bikeshopIcon,
    "poi-bikeshop-2x": bikeshopIcon2x,
    "poi-bikeshop-mini": bikeshopIconMini,
    "poi-rental": bikerentalIcon,
    "poi-rental-2x": bikerentalIcon2x,
    "poi-rental-mini": bikerentalIconMini,
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
        this.addCommentsLayers = this.addCommentsLayers.bind(this);
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
        this.hideCommentModal();
        this.addCommentsLayers();
    };

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

    addLayerPoi(l) {
        const filters = this.convertFilterToMapboxFilter(l);

        this.map.addLayer({
            'id': l.id,
            'type': 'symbol',
            'source': 'osm',
            "filter": filters,
            "name": l.name,
            "description": l.description,
            'layout': {
                "icon-padding": 0,
                "icon-allow-overlap": [
                    'step',
                    ['zoom'],
                    false,
                    14,
                    true
                ],
                'icon-image': [
                    'step',
                    ['zoom'],
                    `${l.icon}-mini`,
                    14,
                    l.icon
                ],
                'icon-size': [
                    "interpolate",
                        ["exponential", 1.5],
                        ["zoom"], 
                        10, 0.5,
                        14, 1
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

        this.map.on("mouseenter", l.id, e => {
            if (e.features.length > 0) {
                this.map.getCanvas().style.cursor = 'pointer';

                if (this.hoveredPOI) {
                    this.map.setFeatureState({
                        source: 'osm',
                        id: this.hoveredPOI },
                        { hover: false });
                }
                this.hoveredPOI = e.features[0].id;
                this.map.setFeatureState({
                    source: 'osm',
                    id: this.hoveredPOI },
                    { hover: true });
            }
        });

        this.map.on("mouseleave", l.id, e => {
            if (this.hoveredPOI) {
                this.map.getCanvas().style.cursor = '';

                this.map.setFeatureState({
                    source: 'osm',
                    id: this.hoveredPOI },
                    { hover: false });
            }
            this.hoveredPOI = null;
        });

        this.map.on('click', l.id, e => {
            if (e.features.length > 0) {
                this.popups.showPOIPopup(e, iconsMap[l.icon+'-2x']);
            }
        });
    }

    addLayerWay(l) {
        const filters = this.convertFilterToMapboxFilter(l);

        const dashedLineStyle = { 'line-dasharray': [1, 1] };

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
                "filter": filters,
                "paint": {
                    "line-color": l.style.borderColor,
                    "line-width": [
                        "interpolate",
                            ["exponential", 1.5],
                            ["zoom"], 
                            10, Math.max(1, l.style.lineWidth/4),
                            18, [ 'case',
                                ['boolean', ['feature-state', 'hover'], false],
                                l.style.lineWidth*6,
                                l.style.lineWidth*3
                            ]
                    ],
                    ...(l.style.borderStyle === 'dashed' && dashedLineStyle)
                },
                "layout": (l.style.borderStyle === 'dashed') ? {} : { "line-join": "round", "line-cap": "round" },
            }, 'road-label-small');

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
                    "line-width": [
                        "interpolate",
                            ["exponential", 1.5],
                            ["zoom"],
                            10, Math.max(1, (l.style.lineWidth - l.style).borderWidth)/4,
                            18, [ 'case',
                                ['boolean', ['feature-state', 'hover'], false],
                                (l.style.lineWidth - l.style.borderWidth)*6,
                                (l.style.lineWidth - l.style.borderWidth)*3
                            ]
                    ],
                    ...(l.style.lineStyle === 'dashed' && dashedLineStyle)
                },
                "layout": (l.style.lineStyle === 'dashed') ? {} : { "line-join": "round", "line-cap": "round" },
            }, 'road-label-small');
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
                    "line-width": [
                        "interpolate",
                            ["exponential", 1.5],
                            ["zoom"],
                            10, Math.max(1, l.style.lineWidth/4),
                            18, [ 'case',
                                ['boolean', ['feature-state', 'hover'], false],
                                l.style.lineWidth*6,
                                l.style.lineWidth*3
                            ]
                    ],
                    ...(l.style.lineStyle === 'dashed' && dashedLineStyle)
                },
                "layout": (l.style.lineStyle === 'dashed') ? {} : { "line-join": "round", "line-cap": "round" },
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

                const layer = this.props.layers.find(l =>
                    l.id === e.features[0].layer.id.split('--')[0]
                );
                this.popups.showCyclewayPopup(e, layer);
            }
        });
    }

    async addCommentsLayers() {
        if (this.state.comments.length > 0) {
            this.state.comments.forEach(c => {
                if (c.marker) {
                    c.marker.remove();
                }
            })

            this.map.removeLayer('comentarios');
        }

        this.setState(await this.airtableDatabase.getComments());
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
                        0, 0,
                        15, 1
                    ],
                    "icon-allow-overlap": true
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

            this.map.on("mouseenter", 'comentarios', e => {
                if (e.features.length > 0) {
                    this.map.getCanvas().style.cursor = 'pointer';
    
                    if (this.hoveredComment) {
                        this.map.setFeatureState({
                            source: 'commentsSrc',
                            id: this.hoveredComment },
                            { hover: false });
                    }
                    this.hoveredComment = e.features[0].id;
                    this.map.setFeatureState({
                        source: 'commentsSrc',
                        id: this.hoveredComment },
                        { hover: true });
                }
            });
    
            this.map.on("mouseleave", 'comentarios', e => {
                if (this.hoveredComment) {// && !this.selectedCycleway) {
                    this.map.getCanvas().style.cursor = '';

                    this.map.setFeatureState({
                        source: 'commentsSrc',
                        id: this.hoveredComment },
                        { hover: false });
                }
                this.hoveredComment = null;
            });

            this.map.on('click', 'comentarios', e => {
                if (e.features.length > 0) {
                    this.popups.showCommentPopup(e);
                }
            });
        }
    }

    initGeojsonLayers(layers) {
        const map = this.map;

        map.setLayoutProperty(
            'satellite',
            'visibility',
            this.props.showSatellite ? 'visible' : 'none');

        map.addSource("osm", {
            "type": "geojson",
            "data": this.props.data || {
                'type': 'FeatureCollection',
                'features': []
            },
            "generateId": true
        });

        map.addSource("commentsSrc", {
            "type": "geojson",
            "data": {
                'type': 'FeatureCollection',
                'features': []
            },
            "generateId": true
        });

        // In GeoJSON layers are from most important to least important, but we 
        //   want the most important ones to be on top.
        // Slice is used here to don't destructively reverse the original array.
        layers.slice().reverse().forEach(l => {
            if (!l.type || l.type==='way') {
                this.addLayerWay(l);
            } else if (l.type === 'poi' && l.filters) {
                this.addLayerPoi(l);
            }
        }); 
    }

    componentDidUpdate(prevProps) {
        const map = this.map;

        if (!map || !map.getSource('osm')) {
            return;
        }

        if (this.props.data !== prevProps.data) {
            map.getSource('osm').setData(this.props.data);
        }
        
        if (this.props.showSatellite !== prevProps.showSatellite) {
            map.setLayoutProperty(
                'satellite',
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
                    map.setLayoutProperty(l.id, 'visibility', l.isActive ? 'visible' : 'none');
                    if (l.type === 'way' && l.style.borderColor) {
                        map.setLayoutProperty(l.id+'--border', 'visibility', l.isActive ? 'visible' : 'none');
                    }
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

        this.popups = new MapPopups(this.map);

        
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
        
        
        this.map.addControl(new mapboxgl.FullscreenControl({
            container: document.querySelector('body')
        }), 'bottom-right');

        
        // Listeners

        this.map.on('load', () => {
            this.initGeojsonLayers(this.props.layers);
            
            if (ENABLE_COMMENTS) {
                this.addCommentsLayers();
            }

            this.onMapMoved();

            this.map.on('moveend', this.onMapMoved);

            Object.keys(iconsMap).forEach(key => {
                this.map.loadImage( iconsMap[key], (error, image) => {
                    if (error) throw error;
                    this.map.addImage(key, image);
                });
            });
        });

        
        // Initialize map data center
        
        this.reverseGeocode(this.props.center);
    }

    newComment() {
        this.setState({ showCommentCursor: true });
        this.map.once('click', e => {
            this.newCommentCoords = e.lngLat;
            this.showCommentModal();
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

export default Map;