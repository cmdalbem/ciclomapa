import React, { Component } from 'react';
import { Button, Input, Space, Divider } from 'antd';
import { 
    HiOutlineMap as IconMap,
    HiOutlineLocationMarker as IconLocation,
    HiOutlineArrowRight as IconArrow,
    HiOutlineX as IconClose
} from "react-icons/hi";
import { LuBike as IconBike, LuRoute as IconRoute } from "react-icons/lu";
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import mapboxgl from 'mapbox-gl';

import { testMapboxDirections } from './testDirections.js';
import './DirectionsPanel.css';

import {
    MAPBOX_ACCESS_TOKEN,
    IS_PROD
} from './constants.js'

class DirectionsPanel extends Component {
    constructor(props) {
        super(props);
        this.state = {
            collapsed: false,
            fromPoint: null,
            toPoint: null,
            directions: null,
            loading: false,
            error: null,
            fromGeocoderAttached: false,
            toGeocoderAttached: false,
            hoveredRouteIndex: null, // Added for hover state
            selectedRouteIndex: null // Added for selection state
        };

        this.toggleCollapse = this.toggleCollapse.bind(this);
        this.calculateDirections = this.calculateDirections.bind(this);
        this.clearDirections = this.clearDirections.bind(this);
        this.selectRoute = this.selectRoute.bind(this);
        this.handleRouteHover = this.handleRouteHover.bind(this);
        this.handleRouteLeave = this.handleRouteLeave.bind(this);
        this.cleanupGeocoders = this.cleanupGeocoders.bind(this);
        this.handleRouteClick = this.handleRouteClick.bind(this);
    }

    componentDidMount() {
        // Wait for map to be available
        this.initGeocodersInterval = setInterval(() => {
            if (this.props.map) {
                this.initGeocoders();
                clearInterval(this.initGeocodersInterval);
            }
        }, 100);
    }

    componentDidUpdate(prevProps) {
        // If map becomes available, initialize geocoders
        if (this.props.map && !prevProps.map) {
            console.debug('Map became available, initializing geocoders');
            this.initGeocoders();
        }
    }

    componentWillUnmount() {
        if (this.initGeocodersInterval) {
            clearInterval(this.initGeocodersInterval);
        }
        // Clean up geocoders when component unmounts
        this.cleanupGeocoders();
    }

    initGeocoders() {
        // Wait for map to be available
        if (!this.props.map) {
            console.debug('Map not available yet, waiting...');
            return;
        }

        console.debug('Initializing geocoders with map:', this.props.map);

        // Clean up any existing geocoders first
        this.cleanupGeocoders();

        // Initialize "From" geocoder
        this.fromGeocoder = new MapboxGeocoder({
            accessToken: MAPBOX_ACCESS_TOKEN,
            mapboxgl: mapboxgl,
            placeholder: 'Origem',
            language: 'pt-BR',
            flyTo: false,
            countries: IS_PROD ? 'br' : '',
            marker: true,
            useBrowserFocus: true,
            enableGeolocation: true
        });

        // Initialize "To" geocoder
        this.toGeocoder = new MapboxGeocoder({
            accessToken: MAPBOX_ACCESS_TOKEN,
            mapboxgl: mapboxgl,
            placeholder: 'Destino',
            language: 'pt-BR',
            flyTo: false,
            countries: IS_PROD ? 'br' : '',
            marker: true,
            useBrowserFocus: true
        });

        // Add event listeners
        this.fromGeocoder.on('result', (result) => {
            console.debug('From point selected:', result);
            this.setState({ fromPoint: result }, () => {
                this.calculateDirections();
            });
        });

        this.toGeocoder.on('result', (result) => {
            console.debug('To point selected:', result);
            this.setState({ toPoint: result }, () => {
                this.calculateDirections();
            });
        });

        // Clear results when clearing
        this.fromGeocoder.on('clear', () => {
            this.setState({ fromPoint: null });
        });

        this.toGeocoder.on('clear', () => {
            this.setState({ toPoint: null });
        });

        // Reset attachment flags
        this.setState({
            fromGeocoderAttached: false,
            toGeocoderAttached: false
        });

        // Geocoders will be attached via ref callbacks in render
    }

    cleanupGeocoders() {
        // Remove geocoders from map if they exist
        if (this.fromGeocoder && this.props.map) {
            try {
                this.fromGeocoder.onRemove(this.props.map);
            } catch (error) {
                console.debug('Error removing from geocoder:', error);
            }
        }
        
        if (this.toGeocoder && this.props.map) {
            try {
                this.toGeocoder.onRemove(this.props.map);
            } catch (error) {
                console.debug('Error removing to geocoder:', error);
            }
        }

        // Clear DOM containers
        const fromContainer = document.getElementById('fromGeocoder');
        const toContainer = document.getElementById('toGeocoder');
        
        if (fromContainer) {
            fromContainer.innerHTML = '';
        }
        if (toContainer) {
            toContainer.innerHTML = '';
        }

        // Reset state
        this.setState({
            fromGeocoderAttached: false,
            toGeocoderAttached: false
        });
    }

    toggleCollapse() {
        this.setState({
            collapsed: !this.state.collapsed
        });
    }

    async calculateDirections() {
        if (this.state.fromPoint && this.state.toPoint) {
            this.setState({ loading: true, error: null, directions: null });

            try {
                // Extract coordinates from geocoder results
                // Mapbox geocoder returns [longitude, latitude] which is what we need
                const fromCoords = this.state.fromPoint.result.center;
                const toCoords = this.state.toPoint.result.center;
                
                console.debug('Calculating directions from:', fromCoords, 'to:', toCoords);
                
                const directions = await testMapboxDirections(fromCoords, toCoords);
                this.setState({ 
                    directions, 
                    loading: false 
                });
                
                // Pass the directions data to the parent component
                if (this.props.onDirectionsCalculated) {
                    this.props.onDirectionsCalculated(directions);
                }
                
                console.debug('Directions calculated:', directions);
            } catch (error) {
                this.setState({ 
                    error: error.message, 
                    loading: false 
                });
                console.error('Directions error:', error);
            }
        }
    }

    clearDirections() {
        this.setState({ 
            directions: null, 
            error: null,
            fromPoint: null,
            toPoint: null,
            selectedRouteIndex: null
        });
        
        // Clean up geocoders properly
        this.cleanupGeocoders();
        
        // Notify parent to clear the route from the map
        if (this.props.onDirectionsCleared) {
            this.props.onDirectionsCleared();
        }
    }

    selectRoute(index) {
        // No longer needed since we show all routes
        console.debug('Route selection disabled - showing all routes');
    }

    handleRouteHover(routeIndex) {
        this.setState({ hoveredRouteIndex: routeIndex });
        if (this.props.map) {
            if (this.state.directions && this.state.directions.routes) {
                this.state.directions.routes.forEach((route, index) => {
                    this.props.map.setFeatureState(
                        { source: 'directions-route', id: index },
                        { hover: false }
                    );
                });
            }
            this.props.map.setFeatureState(
                { source: 'directions-route', id: routeIndex },
                { hover: true }
            );
        } else {
        }
    }

    handleRouteLeave() {
        this.setState({ hoveredRouteIndex: null });
        if (this.props.map && this.state.directions && this.state.directions.routes) {
            this.state.directions.routes.forEach((route, index) => {
                this.props.map.setFeatureState(
                    { source: 'directions-route', id: index },
                    { hover: false }
                );
            });
        }
    }

    handleRouteClick(routeIndex) {
        console.debug('Route clicked:', routeIndex);
        this.setState({ selectedRouteIndex: routeIndex });
        
        if (this.props.map && this.state.directions && this.state.directions.routes) {
            // Clear selection state on all routes first
            this.state.directions.routes.forEach((route, index) => {
                this.props.map.setFeatureState(
                    { source: 'directions-route', id: index },
                    { selected: false }
                );
            });
            
            // Set selection state on the clicked route
            this.props.map.setFeatureState(
                { source: 'directions-route', id: routeIndex },
                { selected: true }
            );
        }
    }

    render() {
        const { directions, loading, error } = this.state;
        
        return (
            <>
                <div
                    id="directionsPanel"
                    className="fixed text-white cursor-pointer"
                >
                    <div className="p-4">
                        <div className="flex justify-between mb-2">
                            <h3 className="text-lg font-semibold flex items-center">
                                <IconRoute className="mr-2" />
                                Rotas
                                <span 
                                    className="bg-white opacity-75 ml-2 px-1 py-0 rounded-full text-black text-xs"
                                    style={{fontSize: 10}}
                                >
                                    BETA
                                </span>
                            </h3>

                            {directions && (
                                <Button
                                    onClick={this.clearDirections}
                                    type="text" 
                                    size="small" 
                                >
                                    Limpar
                                </Button>
                            )}
                        </div>

                        <Space direction="vertical" size="small" className="w-full">
                            <div 
                                id="fromGeocoder"
                                className='flex'
                                ref={el => {
                                    if (el && this.fromGeocoder && !el.hasChildNodes() && !this.state.fromGeocoderAttached) {
                                        console.debug('Attaching from geocoder to DOM');
                                        try {
                                            const geocoderElement = this.fromGeocoder.onAdd(this.props.map);
                                            el.appendChild(geocoderElement);
                                            this.setState({ fromGeocoderAttached: true });
                                        } catch (error) {
                                            console.debug('Error attaching from geocoder:', error);
                                        }
                                    }
                                }}
                            />

                            <div 
                                id="toGeocoder"
                                className='flex'
                                ref={el => {
                                    if (el && this.toGeocoder && !el.hasChildNodes() && !this.state.toGeocoderAttached) {
                                        console.debug('Attaching to geocoder to DOM');
                                        try {
                                            const geocoderElement = this.toGeocoder.onAdd(this.props.map);
                                            el.appendChild(geocoderElement);
                                            this.setState({ toGeocoderAttached: true });
                                        } catch (error) {
                                            console.debug('Error attaching to geocoder:', error);
                                        }
                                    }
                                }}
                            />

                            {/* <Button
                                type="primary"
                                onClick={this.calculateDirections}
                                loading={loading}
                                disabled={!this.state.fromPoint || !this.state.toPoint}
                                block
                                // size="large"
                                className="mt-2 bg-green-600 hover:bg-green-700"
                            >
                                Calcular rota
                            </Button> */}
                        </Space>

                        {error && (
                            <div className="mt-3 p-2 bg-red-600 bg-opacity-20 border border-red-500 rounded text-red-200 text-sm">
                                Erro: {error}
                            </div>
                        )}

                        {directions && (
                            <div className="mt-5">
                                <div className="space-y-1">
                                    {directions.routes && directions.routes.map((route, index) => (
                                        <div
                                            key={index}
                                            className={`rounded-lg p-2 cursor-pointer hover:bg-white hover:bg-opacity-10 transition-colors ${
                                                this.state.selectedRouteIndex === index ? 'bg-white bg-opacity-20 border-opacity-60' : ''
                                            }`}
                                            onMouseEnter={() => this.handleRouteHover(index)}
                                            onMouseLeave={this.handleRouteLeave}
                                            onClick={() => this.handleRouteClick(index)}
                                        >
                                            <div className="flex justify-between mb-2">
                                                <div className="flex">
                                                    <IconBike className="mt-1 mr-3" />
                                                    <span className="directions--legLabel text-sm font-medium align-left">
                                                        {route.legs && route.legs.length > 0 && route.legs[0].summary}
                                                    </span>
                                                </div>
                                                <div className="flex flex-col flex-end">
                                                    <span className="text-sm text-right">
                                                        {route.duration ? `${Math.round(route.duration / 60)} min` : 'N/A'}
                                                    </span>
                                                    <span className="text-sm text-gray-300 text-right">
                                                        {route.distance ? `${(route.distance / 1000).toFixed(1)} km` : 'N/A'}
                                                    </span>
                                                </div>
                                            </div>
                                            {route.legs && route.legs[0] && (
                                                <div className="text-xs text-gray-400 space-y-1">
                                                    {route.legs[0].steps && route.legs[0].steps.length > 0 && (
                                                        <div className="flex">
                                                            <span className="mr-2">🚴</span>
                                                            <span>{route.legs[0].steps.length} etapas</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </>
        )
    }
}

export default DirectionsPanel;
