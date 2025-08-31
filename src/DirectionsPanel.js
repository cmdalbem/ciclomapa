import React, { Component } from 'react';
import { Button, Input, Space, Divider } from 'antd';
import { 
    HiOutlineMap as IconMap,
    HiOutlineLocationMarker as IconLocation,
    HiOutlineArrowRight as IconArrow,
    HiOutlineX as IconClose
} from "react-icons/hi";
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import mapboxgl from 'mapbox-gl';

import { testMapboxDirections } from './testDirections.js';
import './DirectionsPanel.css';

import {
    IS_MOBILE,
    IS_PROD,
    MAPBOX_ACCESS_TOKEN
} from './constants.js'

const { TextArea } = Input;

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
            hoveredRouteIndex: null // Added for hover state
        };

        this.toggleCollapse = this.toggleCollapse.bind(this);
        this.calculateDirections = this.calculateDirections.bind(this);
        this.clearDirections = this.clearDirections.bind(this);
        this.selectRoute = this.selectRoute.bind(this);
        this.handleRouteHover = this.handleRouteHover.bind(this);
        this.handleRouteLeave = this.handleRouteLeave.bind(this);
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
            console.log('Map became available, initializing geocoders');
            this.initGeocoders();
        }
    }

    componentWillUnmount() {
        if (this.initGeocodersInterval) {
            clearInterval(this.initGeocodersInterval);
        }
    }

    initGeocoders() {
        // Wait for map to be available
        if (!this.props.map) {
            console.log('Map not available yet, waiting...');
            return;
        }

        console.log('Initializing geocoders with map:', this.props.map);

        // Initialize "From" geocoder
        this.fromGeocoder = new MapboxGeocoder({
            accessToken: MAPBOX_ACCESS_TOKEN,
            mapboxgl: mapboxgl,
            placeholder: 'Digite o ponto de partida...',
            language: 'pt-BR',
            countries: 'br',
            marker: true,
        });

        // Initialize "To" geocoder
        this.toGeocoder = new MapboxGeocoder({
            accessToken: MAPBOX_ACCESS_TOKEN,
            mapboxgl: mapboxgl,
            placeholder: 'Digite o destino...',
            language: 'pt-BR',
            countries: 'br',
            marker: true,
        });

        // Add event listeners
        this.fromGeocoder.on('result', (result) => {
            this.setState({ fromPoint: result });
            console.log('From point selected:', result);
        });

        this.toGeocoder.on('result', (result) => {
            this.setState({ toPoint: result });
            console.log('To point selected:', result);
        });

        // Clear results when clearing
        this.fromGeocoder.on('clear', () => {
            this.setState({ fromPoint: null });
        });

        this.toGeocoder.on('clear', () => {
            this.setState({ toPoint: null });
        });

        // Geocoders will be attached via ref callbacks in render
    }

    toggleCollapse() {
        this.setState({
            collapsed: !this.state.collapsed
        });
    }

    async calculateDirections() {
        this.setState({ loading: true, error: null, directions: null });
        
        try {
            // Check if both points are selected
            if (!this.state.fromPoint || !this.state.toPoint) {
                throw new Error('Por favor, selecione os pontos de partida e destino');
            }
            
            // Extract coordinates from geocoder results
            // Mapbox geocoder returns [longitude, latitude] which is what we need
            const fromCoords = this.state.fromPoint.result.center;
            const toCoords = this.state.toPoint.result.center;
            
            console.log('Calculating directions from:', fromCoords, 'to:', toCoords);
            
            const directions = await testMapboxDirections(fromCoords, toCoords);
            this.setState({ 
                directions, 
                loading: false 
            });
            
            // Pass the directions data to the parent component
            if (this.props.onDirectionsCalculated) {
                this.props.onDirectionsCalculated(directions);
            }
            
            console.log('Directions calculated:', directions);
        } catch (error) {
            this.setState({ 
                error: error.message, 
                loading: false 
            });
            console.error('Directions error:', error);
        }
    }

    clearDirections() {
        this.setState({ 
            directions: null, 
            error: null,
            fromPoint: null,
            toPoint: null
        });
        
        // Safely clear the geocoder inputs
        try {
            if (this.fromGeocoder && this.state.fromGeocoderAttached) {
                this.fromGeocoder.clear();
            }
            if (this.toGeocoder && this.state.toGeocoderAttached) {
                this.toGeocoder.clear();
            }
        } catch (error) {
            console.warn('Error clearing geocoders:', error);
            // If clearing fails, just reset the state
        }
        
        // Reset attachment flags so geocoders can be re-attached if needed
        this.setState({
            fromGeocoderAttached: false,
            toGeocoderAttached: false
        });
        
        // Notify parent to clear the route from the map
        if (this.props.onDirectionsCleared) {
            this.props.onDirectionsCleared();
        }
    }

    selectRoute(index) {
        // No longer needed since we show all routes
        console.log('Route selection disabled - showing all routes');
    }

    handleRouteHover(routeIndex) {
        console.log('🖱️ Route hover:', routeIndex);
        this.setState({ hoveredRouteIndex: routeIndex });
        // Set hover state on the specific route in the map
        if (this.props.map) {
            console.log('🗺️ Map available, setting feature state');
            // Clear hover state on all routes first
            if (this.state.directions && this.state.directions.routes) {
                this.state.directions.routes.forEach((route, index) => {
                    console.log(`🔄 Clearing hover state for route ${index}`);
                    this.props.map.setFeatureState(
                        { source: 'directions-route', id: index },
                        { hover: false }
                    );
                });
            }
            // Set hover state on the hovered route
            console.log(`✨ Setting hover state for route ${routeIndex}`);
            this.props.map.setFeatureState(
                { source: 'directions-route', id: routeIndex },
                { hover: true }
            );
        } else {
            console.log('❌ Map not available');
        }
    }

    handleRouteLeave() {
        console.log('🚫 Route leave, clearing hover states');
        this.setState({ hoveredRouteIndex: null });
        // Clear hover state on all routes in the map
        if (this.props.map && this.state.directions && this.state.directions.routes) {
            this.state.directions.routes.forEach((route, index) => {
                console.log(`🔄 Clearing hover state for route ${index}`);
                this.props.map.setFeatureState(
                    { source: 'directions-route', id: index },
                    { hover: false }
                );
            });
        }
    }

    render() {
        const { embedMode } = this.props;
        const { collapsed, fromPoint, toPoint, directions, loading, error } = this.state;
        
        if (embedMode) {
            return null;
        }

        return (
            <>
                {
                    IS_MOBILE &&
                        <div
                            id="directionsPanelMobileButton"
                            className={`
                                p-4 border border-white border-opacity-20 rounded text-lg fixed
                                ${collapsed ? 'text-gray-300' : 'text-gray-900 bg-gray-100'}`}
                            onClick={this.toggleCollapse}
                            style={{
                                bottom: 30,
                                right: 8,
                                background: collapsed ? '#1c1717' : ''
                            }}
                        >
                            <IconMap/>
                        </div>
                }
                <div
                    id="directionsPanel"
                    className={`
                        fixed text-white 
                        ${IS_MOBILE && 'rounded border border-white border-opacity-20 shadow-lg divide-y divide-white divide-opacity-10'}
                        ${IS_MOBILE && collapsed ? 'hidden ' : ''}
                        ${embedMode ? 'pointer-events-none ' : 'cursor-pointer '}
                    `}
                    style={{
                        top: IS_MOBILE ? 100 : 90,
                        left: 24,
                        background: IS_MOBILE && '#1c1717',
                        minWidth: '300px'
                    }}
                >
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-lg font-semibold flex items-center">
                                <IconMap className="mr-2" />
                                Rotas
                            </h3>
                            <Button 
                                type="text" 
                                size="small" 
                                icon={<IconClose />}
                                onClick={this.toggleCollapse}
                                className="text-white hover:text-gray-300"
                            />
                        </div>

                        <Space direction="vertical" size="small" className="w-full">
                            <div>
                                <label className="block text-sm mb-1">De</label>
                                <div 
                                    ref={el => {
                                        if (el && this.fromGeocoder && !el.hasChildNodes() && !this.state.fromGeocoderAttached) {
                                            console.log('Attaching from geocoder to DOM');
                                            const geocoderElement = this.fromGeocoder.onAdd(this.props.map);
                                            el.appendChild(geocoderElement);
                                            this.setState({ fromGeocoderAttached: true });
                                        }
                                    }}
                                    className="geocoder-container"
                                />
                            </div>

                            <div>
                                <label className="block text-sm mb-1">Para</label>
                                <div 
                                    ref={el => {
                                        if (el && this.toGeocoder && !el.hasChildNodes() && !this.state.toGeocoderAttached) {
                                            console.log('Attaching to geocoder to DOM');
                                            const geocoderElement = this.toGeocoder.onAdd(this.props.map);
                                            el.appendChild(geocoderElement);
                                            this.setState({ toGeocoderAttached: true });
                                        }
                                    }}
                                    className="geocoder-container"
                                />
                            </div>

                            <Button
                                type="primary"
                                onClick={this.calculateDirections}
                                loading={loading}
                                disabled={!this.state.fromPoint || !this.state.toPoint}
                                block
                                className="bg-green-600 hover:bg-green-700"
                            >
                                Calcular rota
                            </Button>

                            {directions && (
                                <Button
                                    onClick={this.clearDirections}
                                    block
                                    className="text-white border-white hover:bg-white hover:text-black"
                                >
                                    Limpar resultados
                                </Button>
                            )}
                        </Space>

                        {error && (
                            <div className="mt-3 p-2 bg-red-600 bg-opacity-20 border border-red-500 rounded text-red-200 text-sm">
                                Erro: {error}
                            </div>
                        )}

                        {directions && (
                            <div className="mt-3">
                                <h4 className="font-semibold text-green-300 mb-2">Rotas disponíveis</h4>
                                <div className="space-y-2">
                                    {directions.routes && directions.routes.map((route, index) => (
                                        <div
                                            key={index}
                                            className="bg-white bg-opacity-10 border border-white border-opacity-20 rounded-lg p-3 cursor-pointer hover:bg-opacity-20 transition-colors"
                                            onMouseEnter={() => this.handleRouteHover(index)}
                                            onMouseLeave={this.handleRouteLeave}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center">
                                                    <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold text-white mr-2">
                                                        {index + 1}
                                                    </div>
                                                    <span className="text-sm font-medium">
                                                        {route.distance ? `${(route.distance / 1000).toFixed(1)} km` : 'N/A'}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-gray-300">
                                                    {route.duration ? `${Math.round(route.duration / 60)} min` : 'N/A'}
                                                </div>
                                            </div>
                                            {route.legs && route.legs[0] && (
                                                <div className="text-xs text-gray-400 space-y-1">
                                                    {route.legs[0].steps && route.legs[0].steps.length > 0 && (
                                                        <div className="flex items-center">
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
