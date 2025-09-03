import React, { Component } from 'react';
import { Button, Input, Space, Divider, Tabs } from 'antd';
import { 
    HiOutlineMap as IconMap,
    HiOutlineLocationMarker as IconLocation,
    HiOutlineArrowRight as IconArrow,
    HiOutlineX as IconClose,
    HiOutlineTrendingUp as IconTrendingUp,
    HiOutlineTrendingDown as IconTrendingDown
} from "react-icons/hi";
import { LuBike as IconBike, LuRoute as IconRoute } from "react-icons/lu";
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import mapboxgl from 'mapbox-gl';
import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';

import directionsService from './directionsService.js';
import './DirectionsPanel.css';

import {
    MAPBOX_ACCESS_TOKEN,
    IS_PROD,
    IS_MOBILE
} from './constants.js'

const geocodingClient = mbxGeocoding({ accessToken: MAPBOX_ACCESS_TOKEN });

class DirectionsPanel extends Component {
    constructor(props) {
        super(props);
        this.state = {
            collapsed: IS_MOBILE, // Start collapsed on mobile
            fromPoint: null,
            toPoint: null,
            directions: null,
            loading: false,
            error: null,
            fromGeocoderAttached: false,
            toGeocoderAttached: false,
            hoveredRouteIndex: null, // Added for hover state
            focusedInput: null, // 'from' or 'to' or null
            selectedProvider: 'graphhopper' // Current directions provider
        };

        // Custom draggable markers
        this.fromMarker = null;
        this.toMarker = null;
        
        // Direct event listeners for input elements
        this.fromInputListeners = null;
        this.toInputListeners = null;
        
        // Timeout reference for blur handling
        this.blurTimeout = null;

        this.toggleCollapse = this.toggleCollapse.bind(this);
        this.calculateDirections = this.calculateDirections.bind(this);
        this.clearDirections = this.clearDirections.bind(this);
        this.selectRoute = this.selectRoute.bind(this);
        this.handleRouteHover = this.handleRouteHover.bind(this);
        this.handleRouteLeave = this.handleRouteLeave.bind(this);
        this.cleanupGeocoders = this.cleanupGeocoders.bind(this);
        this.handleRouteClick = this.handleRouteClick.bind(this);
        this.handleMarkerDrag = this.handleMarkerDrag.bind(this);
        this.createCustomMarker = this.createCustomMarker.bind(this);
        this.reverseGeocode = this.reverseGeocode.bind(this);
        this.setDefaultPositions = this.setDefaultPositions.bind(this);
        this.handleInputFocus = this.handleInputFocus.bind(this);
        this.handleInputBlur = this.handleInputBlur.bind(this);
        this.handleMapClick = this.handleMapClick.bind(this);
        this.attachGeocoderToDOM = this.attachGeocoderToDOM.bind(this);
        this.handleProviderChange = this.handleProviderChange.bind(this);
    }

    componentDidMount() {
        // Wait for map to be available
        this.initGeocodersInterval = setInterval(() => {
            if (this.props.map) {
                this.initGeocoders();
                this.setupMapClickListener();
                // this.setDefaultPositions();
                clearInterval(this.initGeocodersInterval);
            }
        }, 100);
    }

    componentDidUpdate(prevProps) {
        // If map becomes available, initialize geocoders
        if (this.props.map && !prevProps.map) {
            console.debug('Map became available, initializing geocoders');
            this.initGeocoders();
            this.setupMapClickListener();
        }
    }

    componentWillUnmount() {
        if (this.initGeocodersInterval) {
            clearInterval(this.initGeocodersInterval);
        }
        // Clean up blur timeout
        if (this.blurTimeout) {
            clearTimeout(this.blurTimeout);
            this.blurTimeout = null;
        }
        // Clean up geocoders when component unmounts
        this.cleanupGeocoders();
        // Clean up map click listener
        this.removeMapClickListener();
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
            marker: false, // Disable default marker
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
            marker: false, // Disable default marker
            useBrowserFocus: true
        });

        // Add event listeners
        this.fromGeocoder.on('result', (result) => {
            console.debug('From point selected:', result);
            
            // Remove existing from marker
            if (this.fromMarker) {
                this.fromMarker.remove();
            }
            
            // Create new custom marker
            this.fromMarker = this.createCustomMarker(result.result.center, 'from');
            this.fromMarker.addTo(this.props.map);
            
            // Add drag event listener
            this.fromMarker.on('dragend', () => {
                this.handleMarkerDrag(this.fromMarker, 'from');
            });
            
            this.setState({ fromPoint: result }, () => {
                this.calculateDirections();
                
                // Auto-focus destination input if no destination is set yet
                if (!this.state.toPoint && this.toGeocoderElement) {
                    const destinationInput = this.toGeocoderElement.querySelector('input');
                    if (destinationInput) {
                        // Clear any existing blur timeout to prevent it from overriding our focus
                        if (this.blurTimeout) {
                            clearTimeout(this.blurTimeout);
                            this.blurTimeout = null;
                        }
                        
                        // Small delay to ensure the state update is complete
                        setTimeout(() => {
                            destinationInput.focus();
                            // Set focusedInput state to 'to' so map clicks work for destination
                            this.setState({ focusedInput: 'to' });
                            console.debug('Auto-focused destination input after origin was set');
                        }, 100);
                    }
                }
            });
        });

        // Store the geocoder element for later use when attaching to DOM
        this.fromGeocoderElement = null;

        this.toGeocoder.on('result', (result) => {
            console.debug('To point selected:', result);
            
            // Remove existing to marker
            if (this.toMarker) {
                this.toMarker.remove();
            }
            
            // Create new custom marker
            this.toMarker = this.createCustomMarker(result.result.center, 'to');
            this.toMarker.addTo(this.props.map);
            
            // Add drag event listener
            this.toMarker.on('dragend', () => {
                this.handleMarkerDrag(this.toMarker, 'to');
            });
            
            this.setState({ toPoint: result }, () => {
                this.calculateDirections();
            });
        });

        // Store the geocoder element for later use when attaching to DOM
        this.toGeocoderElement = null;

        // Clear results when clearing
        this.fromGeocoder.on('clear', () => {
            if (this.fromMarker) {
                this.fromMarker.remove();
                this.fromMarker = null;
            }
            this.setState({ fromPoint: null });
        });

        this.toGeocoder.on('clear', () => {
            if (this.toMarker) {
                this.toMarker.remove();
                this.toMarker = null;
            }
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

        // Remove custom markers
        if (this.fromMarker) {
            this.fromMarker.remove();
            this.fromMarker = null;
        }
        if (this.toMarker) {
            this.toMarker.remove();
            this.toMarker = null;
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

        // Clean up direct input event listeners
        if (this.fromInputListeners) {
            this.fromInputListeners.element.removeEventListener('focus', this.fromInputListeners.focus);
            this.fromInputListeners.element.removeEventListener('blur', this.fromInputListeners.blur);
            this.fromInputListeners = null;
        }
        
        if (this.toInputListeners) {
            this.toInputListeners.element.removeEventListener('focus', this.toInputListeners.focus);
            this.toInputListeners.element.removeEventListener('blur', this.toInputListeners.blur);
            this.toInputListeners = null;
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

    handleProviderChange(provider) {
        this.setState({ selectedProvider: provider });
        
        // If we have origin and destination points, recalculate with new provider
        if (this.state.fromPoint && this.state.toPoint) {
            // Clear current directions and recalculate with new provider
            this.setState({ 
                directions: null, 
                error: null
            }, () => {
                // Clear selected route and recalculate directions with the new provider
                if (this.props.onRouteSelected) {
                    this.props.onRouteSelected(null);
                }
                this.calculateDirections();
            });
        }
    }

    async calculateDirections() {
        if (this.state.fromPoint && this.state.toPoint) {
            this.setState({ loading: true, error: null, directions: null });

            try {
                // Extract coordinates from geocoder results
                // Mapbox geocoder returns [longitude, latitude] which is what we need
                const fromCoords = this.state.fromPoint.result.center;
                const toCoords = this.state.toPoint.result.center;
                
                console.debug('Calculating directions from:', fromCoords, 'to:', toCoords, 'using provider:', this.state.selectedProvider);
                
                // Switch to the selected provider and get directions
                directionsService.setProvider(this.state.selectedProvider);
                const directions = await directionsService.getCyclingDirections(fromCoords, toCoords);
                
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
            toPoint: null
        });
        // Clear selected route in parent
        if (this.props.onRouteSelected) {
            this.props.onRouteSelected(null);
        }
        
        // Clean up geocoders properly
        this.cleanupGeocoders();
        
        // Notify parent to clear the route from the map
        if (this.props.onDirectionsCleared) {
            this.props.onDirectionsCleared();
        }
    }

    selectRoute(index) {
        if (this.props.onRouteSelected) {
            this.props.onRouteSelected(index);
        }
    }

    handleRouteHover(routeIndex) {
        if (this.props.onRouteHovered) {
            this.props.onRouteHovered(routeIndex);
        }
    }

    handleRouteLeave() {
        if (this.props.onRouteHovered) {
            this.props.onRouteHovered(null);
        }
    }

    handleRouteClick(routeIndex) {
        console.debug('Route clicked:', routeIndex);
        this.selectRoute(routeIndex);
    }

    createCustomMarker(coordinates, type) {
        // Create a custom marker element
        const el = document.createElement('div');
        el.className = `custom-marker custom-marker--${type}`;
        el.innerHTML = type === 'from' ? 'A' : 'B';

        // Add drag event listeners for visual feedback
        el.addEventListener('mousedown', () => {
            el.classList.add('custom-marker--dragging');
        });

        el.addEventListener('mouseup', () => {
            el.classList.remove('custom-marker--dragging');
        });

        el.addEventListener('mouseleave', () => {
            el.classList.remove('custom-marker--dragging');
        });

        // Create the marker
        const marker = new mapboxgl.Marker({
            element: el,
            draggable: true
        }).setLngLat(coordinates);

        return marker;
    }

    handleMarkerDrag(marker, type) {
        const coordinates = marker.getLngLat();
        console.debug(`${type} marker dragged to:`, coordinates);

        // Show loading state
        this.setState({ loading: true });

        // Update the state with new coordinates
        const newPoint = {
            result: {
                center: [coordinates.lng, coordinates.lat],
                place_name: 'Arrastado para nova posição'
            }
        };

        if (type === 'from') {
            this.setState({ fromPoint: newPoint }, () => {
                this.reverseGeocode(coordinates, 'from');
                this.calculateDirections();
            });
        } else {
            this.setState({ toPoint: newPoint }, () => {
                this.reverseGeocode(coordinates, 'to');
                this.calculateDirections();
            });
        }
    }

    reverseGeocode(coordinates, type) {
        if (!coordinates) return;

        // Convert coordinates to the format expected by the geocoding API
        const lngLat = [coordinates.lng, coordinates.lat];

        geocodingClient
            .reverseGeocode({
                query: lngLat,
                types: ['address', 'poi', 'place'],
                limit: 1,
                language: ['pt-br']
            })
            .send()
            .then(response => {
                const features = response.body.features;
                console.debug('Reverse geocode result:', features);

                if (features && features[0]) {
                    const place = features[0];
                    const address = place.place_name || place.text || 'Nova posição';
                    
                    // Update the geocoder input with the actual address
                    const geocoder = type === 'from' ? this.fromGeocoder : this.toGeocoder;
                    if (geocoder && geocoder.setInput) {
                        geocoder.setInput(address);
                    }

                    // Update the state with the full result for consistency
                    const newPoint = {
                        result: {
                            center: lngLat,
                            place_name: address,
                            ...place
                        }
                    };

                    if (type === 'from') {
                        this.setState({ fromPoint: newPoint });
                    } else {
                        this.setState({ toPoint: newPoint });
                    }
                } else {
                    // Fallback if no address found
                    const geocoder = type === 'from' ? this.fromGeocoder : this.toGeocoder;
                    if (geocoder && geocoder.setInput) {
                        geocoder.setInput('Nova posição');
                    }
                }
            })
            .catch(err => {
                console.error('Reverse geocoding error:', err);
                // Fallback on error
                const geocoder = type === 'from' ? this.fromGeocoder : this.toGeocoder;
                if (geocoder && geocoder.setInput) {
                    geocoder.setInput('Nova posição');
                }
            });
    }

    setDefaultPositions() {
        // Only set default positions if no points are already set
        if (this.state.fromPoint || this.state.toPoint) {
            console.debug('Points already set, skipping default positions');
            return;
        }

        // Default coordinates for testing
        const defaultOrigin = [-46.691189278307775, -23.611870922598996];
        const defaultDestination = [-46.673828, -23.583401];

        console.debug('Setting default positions for testing');

        // Create default points
        const fromPoint = {
            result: {
                center: defaultOrigin,
                place_name: 'Origem padrão'
            }
        };

        const toPoint = {
            result: {
                center: defaultDestination,
                place_name: 'Destino padrão'
            }
        };

        // Set the state with default points
        this.setState({ 
            fromPoint: fromPoint,
            toPoint: toPoint
        }, () => {
            // Create custom markers for default positions
            this.fromMarker = this.createCustomMarker(defaultOrigin, 'from');
            this.fromMarker.addTo(this.props.map);
            this.fromMarker.on('dragend', () => {
                this.handleMarkerDrag(this.fromMarker, 'from');
            });

            this.toMarker = this.createCustomMarker(defaultDestination, 'to');
            this.toMarker.addTo(this.props.map);
            this.toMarker.on('dragend', () => {
                this.handleMarkerDrag(this.toMarker, 'to');
            });

            // Update geocoder input fields
            if (this.fromGeocoder && this.fromGeocoder.setInput) {
                this.fromGeocoder.setInput('Origem padrão');
            }
            if (this.toGeocoder && this.toGeocoder.setInput) {
                this.toGeocoder.setInput('Destino padrão');
            }

            // Calculate directions with default positions
            this.calculateDirections();
        });
    }

    setupMapClickListener() {
        if (!this.props.map) {
            console.debug('Map not available for click listener setup');
            return;
        }
        
        console.debug('Setting up map click listener');
        // Remove any existing click listener
        this.removeMapClickListener();
        
        // Add new click listener
        this.mapClickListener = (e) => {
            // console.debug("Map clicked");
            if (this.state.focusedInput) {
                this.handleMapClick(e);
            }
        };
        
        this.props.map.on('click', this.mapClickListener);
        console.debug('Map click listener attached');
    }

    removeMapClickListener() {
        if (this.props.map && this.mapClickListener) {
            console.debug('Removing map click listener');
            this.props.map.off('click', this.mapClickListener);
            this.mapClickListener = null;
        }
    }

    handleInputFocus(inputType) {
        console.debug(`Input focused: ${inputType}`);
        this.setState({ focusedInput: inputType });

        if (this[`${inputType}GeocoderElement`]) {
            this[`${inputType}GeocoderElement`].querySelector('input').placeholder = 'Digite ou clique no mapa';
        }
        
        // Update cursor style to indicate map clicking is active
        // if (this.props.map) {
        //     this.props.map.getCanvas().style.cursor = 'crosshair';
        //     console.debug('Map cursor changed to crosshair');
        // }
    }

    handleInputBlur(inputType) {
        console.debug(`Input blurred: ${inputType}, current focused: ${this.state.focusedInput}`);
        
        // Clear any existing blur timeout
        if (this.blurTimeout) {
            clearTimeout(this.blurTimeout);
            this.blurTimeout = null;
        }
        
        // Only clear focus if it's the same input that's being blurred
        if (this.state.focusedInput === inputType) {
            // Delay to make sure that if the next click was on the map, it'll set the point
            this.blurTimeout = setTimeout(() => {
                this.setState({ focusedInput: null });
                console.debug('Focus cleared, resetting cursor');
                
                // Reset cursor style
                if (this.props.map) {
                    this.props.map.getCanvas().style.cursor = '';
                }
                this.blurTimeout = null;
            }, 500);
        } else {
            console.debug('Blur ignored - different input is focused');
        }

        if (this[`${inputType}GeocoderElement`]) {
            this[`${inputType}GeocoderElement`].querySelector('input').placeholder = inputType === 'from' ? 'Origem' : 'Destino';
        }
    }

    handleMapClick(e) {
        // console.debug('Map clicked, focused input:', this.state.focusedInput);
        if (!this.state.focusedInput) {
            console.debug('No input focused, ignoring map click');
            return;
        }
        
        const coordinates = [e.lngLat.lng, e.lngLat.lat];
        console.debug(`${this.state.focusedInput} point set by map click:`, coordinates);
        
        // Create a point object similar to geocoder result
        const newPoint = {
            result: {
                center: coordinates,
                place_name: 'Ponto selecionado no mapa'
            }
        };
        
        if (this.state.focusedInput === 'from') {
            console.debug('Setting FROM point via map click');
            // Remove existing from marker
            if (this.fromMarker) {
                this.fromMarker.remove();
            }
            
            // Create new custom marker
            this.fromMarker = this.createCustomMarker(coordinates, 'from');
            this.fromMarker.addTo(this.props.map);
            
            // Add drag event listener
            this.fromMarker.on('dragend', () => {
                this.handleMarkerDrag(this.fromMarker, 'from');
            });
            
            this.setState({ fromPoint: newPoint }, () => {
                this.reverseGeocode(e.lngLat, 'from');
                this.calculateDirections();
                
                // Auto-focus destination input if no destination is set yet
                if (!this.state.toPoint && this.toGeocoderElement) {
                    const destinationInput = this.toGeocoderElement.querySelector('input');
                    if (destinationInput) {
                        // Clear any existing blur timeout to prevent it from overriding our focus
                        if (this.blurTimeout) {
                            clearTimeout(this.blurTimeout);
                            this.blurTimeout = null;
                        }
                        
                        // Small delay to ensure the state update is complete
                        setTimeout(() => {
                            destinationInput.focus();
                            // Set focusedInput state to 'to' so map clicks work for destination
                            this.setState({ focusedInput: 'to' });
                            console.debug('Auto-focused destination input after origin was set via map click');
                        }, 100);
                    }
                }
            });
        } else if (this.state.focusedInput === 'to') {
            console.debug('Setting TO point via map click');
            // Remove existing to marker
            if (this.toMarker) {
                this.toMarker.remove();
            }
            
            // Create new custom marker
            this.toMarker = this.createCustomMarker(coordinates, 'to');
            this.toMarker.addTo(this.props.map);
            
            // Add drag event listener
            this.toMarker.on('dragend', () => {
                this.handleMarkerDrag(this.toMarker, 'to');
            });
            
            this.setState({ toPoint: newPoint }, () => {
                this.reverseGeocode(e.lngLat, 'to');
                this.calculateDirections();
            });
        }
        
        // Clear focus after setting a point
        console.debug('Clearing focus after setting point');
        this.setState({ focusedInput: null });
        if (this.props.map) {
            this.props.map.getCanvas().style.cursor = '';
        }
    }

    attachGeocoderToDOM(geocoder, geocoderType, containerId, attachedStateKey) {
        return (el) => {
            if (el && geocoder && !el.hasChildNodes() && !this.state[attachedStateKey]) {
                console.debug(`Attaching ${geocoderType} geocoder to DOM`);
                try {
                    const geocoderElement = geocoder.onAdd(this.props.map);
                    el.appendChild(geocoderElement);
                    
                    // Store the geocoder element
                    this[`${geocoderType}GeocoderElement`] = geocoderElement;
                    
                    // Add focus/blur listeners to the input element
                    const input = geocoderElement.querySelector('input');
                    if (input) {
                        console.debug(`Found ${geocoderType.toUpperCase()} input element, adding event listeners`);
                        
                        const focusHandler = () => {
                            console.debug(`${geocoderType.toUpperCase()} input focus event triggered`);
                            this.handleInputFocus(geocoderType);
                        };
                        const blurHandler = () => {
                            console.debug(`${geocoderType.toUpperCase()} input blur event triggered`);
                            this.handleInputBlur(geocoderType);
                        };
                        
                        input.addEventListener('focus', focusHandler);
                        input.addEventListener('blur', blurHandler);
                        
                        // Store references for cleanup
                        this[`${geocoderType}InputListeners`] = {
                            element: input,
                            focus: focusHandler,
                            blur: blurHandler
                        };
                    }
                    
                    this.setState({ [attachedStateKey]: true });
                } catch (error) {
                    console.debug(`Error attaching ${geocoderType} geocoder:`, error);
                }
            }
        };
    }

    render() {
        const { directions, loading, error } = this.state;
        
        return (
            <>
                {
                    IS_MOBILE &&
                        <div
                            id="directionsPanelMobileButton"
                            className={`directions-panel-mobile-button ${this.state.collapsed ? 'collapsed' : 'expanded'}`}
                            onClick={this.toggleCollapse}
                        >
                            <IconRoute/>
                        </div>
                }
                <div
                    id="directionsPanel"
                    className={`
                        fixed text-white cursor-pointer
                        ${IS_MOBILE && this.state.collapsed ? 'hidden' : ''}
                    `}
                >
                    <div className="p-4">
                        <div className="flex justify-between mb-2">
                            <h3 className="text-lg font-semibold flex items-center">
                                <IconRoute className="mr-2" />
                                Rotas
                                <span className="bg-white opacity-75 ml-2 px-1 py-0 rounded-full text-black text-xs tracking-wider" style={{fontSize: 10}}>
                                    BETA
                                </span>
                            </h3>

                            <div className="flex gap-2">
                                {directions && (
                                    <Button
                                    onClick={this.clearDirections}
                                    type="text" 
                                    size="small" 
                                    >
                                        Limpar
                                    </Button>
                                )}
                                {IS_MOBILE && (
                                    <Button
                                        onClick={this.toggleCollapse}
                                        type="link" 
                                        size="small"
                                        icon={<IconClose />}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Provider Selector */}
                        <Tabs
                            size="small"
                            activeKey={this.state.selectedProvider}
                            onChange={this.handleProviderChange}
                            items={[
                                {
                                    key: 'graphhopper',
                                    label: 'GraphHopper',
                                },
                                {
                                    key: 'mapbox',
                                    label: 'Mapbox',
                                },
                                {
                                    key: 'openrouteservice',
                                    label: 'OpenRouteService',
                                }
                            ]}
                        />

                        <Space direction="vertical" size="small" className="w-full">
                            <div 
                                id="fromGeocoder"
                                className='flex'
                                ref={this.attachGeocoderToDOM(this.fromGeocoder, 'from', 'fromGeocoder', 'fromGeocoderAttached')}
                            />

                            <div 
                                id="toGeocoder"
                                className='flex'
                                ref={this.attachGeocoderToDOM(this.toGeocoder, 'to', 'toGeocoder', 'toGeocoderAttached')}
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

                        {/* {loading && (
                            <div className="mt-3 p-2 bg-blue-600 bg-opacity-20 border border-blue-500 rounded text-blue-200 text-sm flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-200 mr-2"></div>
                                Recalculando rota...
                            </div>
                        )} */}

                        {error && (
                            <div className="mt-3 p-2 bg-red-600 bg-opacity-20 border border-red-500 rounded text-red-200 text-sm">
                                Erro: {error}
                            </div>
                        )}

                        {directions && (
                            <div id="directionsPanel--results" className="mt-5">
                                <div className="space-y-1">
                                    {directions.routes && directions.routes.map((route, index) => (
                                        <div
                                            key={index}
                                            className={`rounded-lg p-2 cursor-pointer transition-colors ${
                                                this.props.selectedRouteIndex === index ? 'bg-white bg-opacity-20 border-opacity-60' : ''
                                            } ${
                                                this.props.hoveredRouteIndex === index ? 'bg-white bg-opacity-10' : ''
                                            }`}
                                            onMouseEnter={() => this.handleRouteHover(index)}
                                            onMouseLeave={this.handleRouteLeave}
                                            onClick={() => this.handleRouteClick(index)}
                                        >
                                            <div className="flex justify-between mb-2">
                                                <div className="flex">
                                                    <IconBike className="mt-1 mr-3" />
                                                    <div className="flex flex-col flex-end">
                                                        <span className="directions--legLabel text-sm mb-1">
                                                            {
                                                            route.legs && route.legs.length > 0 ?
                                                                route.legs[0].summary
                                                            : `Opção ${index + 1}`
                                                            }
                                                        </span>
                                                        {(route.ascend !== undefined || route.descend !== undefined) && (
                                                            <span className="flex flex-row font-normal items-center text-gray-400">
                                                                {route.ascend !== undefined && 
                                                                    <span className="flex items-center mr-2">
                                                                        <IconTrendingUp className="mr-1"/>{Math.round(route.ascend)}m
                                                                    </span>
                                                                }
                                                                {route.descend !== undefined && 
                                                                    <span className="flex items-center">
                                                                        <IconTrendingDown className="mr-1"/>{Math.round(route.descend)}m
                                                                    </span>
                                                                }
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col flex-end">
                                                    <span className="text-sm text-right mb-1">
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
                                
                                {/* Disclaimer */}
                                <div className="mt-3 p-2 text-gray-400 text-xs">
                                    <span>
                                        As rotas são sugestões automáticas. Sempre verifique as condições das vias, sinalização e segurança antes de pedalar :)
                                    </span>
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
