import React, { Component } from 'react';
import { useDirections } from './DirectionsContext.js';
import { Button, Input, Space, Divider, Tabs, Select } from 'antd';
import { 
    HiOutlineTrendingUp as IconTrendingUp,
    HiOutlineTrendingDown as IconTrendingDown
} from "react-icons/hi";
import { HiX as IconClose, HiOutlineArrowLeft as IconBack } from "react-icons/hi";
import { LuBike as IconBike } from "react-icons/lu";
import { FaDirections as IconRoute } from "react-icons/fa";
import { HiOutlineArrowsUpDown as IconSwap, HiTrash as IconTrash, HiOutlineExclamationTriangle as IconNoData } from "react-icons/hi2";
import { HiCog as IconCog } from "react-icons/hi";
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import mapboxgl from 'mapbox-gl';
import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';
import { Popover } from 'antd';


import './DirectionsPanel.css';

import { 
    MAPBOX_ACCESS_TOKEN,
    IS_PROD,
    IS_MOBILE,
    HYBRID_MAX_RESULTS
} from './constants.js'
import DirectionsManager from './DirectionsManager.js'
import { formatDistance, formatDuration } from './routeUtils.js'

const geocodingClient = mbxGeocoding({ accessToken: MAPBOX_ACCESS_TOKEN });

class DirectionsPanel extends Component {
    constructor(props) {
        super(props);
        this.state = {
            collapsed: IS_MOBILE,
            fromGeocoderAttached: false,
            toGeocoderAttached: false,
            focusedInput: null,
            selectedProvider: 'hybrid',
            settingsVisible: false
        };

        this.fromMarker = null;
        this.toMarker = null;
        this.fromGeocoder = null;
        this.toGeocoder = null;
        this.blurTimeout = null;
        this.geocodersInitialized = false;

        this.toggleCollapse = this.toggleCollapse.bind(this);
        this.clearDirections = this.clearDirections.bind(this);
        this.selectRoute = this.selectRoute.bind(this);
        this.handleRouteHover = this.handleRouteHover.bind(this);
        this.handleRouteLeave = this.handleRouteLeave.bind(this);
        this.handleRouteClick = this.handleRouteClick.bind(this);
        this.handleMarkerDrag = this.handleMarkerDrag.bind(this);
        this.handleInputFocus = this.handleInputFocus.bind(this);
        this.handleInputBlur = this.handleInputBlur.bind(this);
        this.handleMapClick = this.handleMapClick.bind(this);
        this.attachMapboxGeocoderToDOM = this.attachMapboxGeocoderToDOM.bind(this);
        this.calculateDirections = this.calculateDirections.bind(this);
        this.swapOriginDestination = this.swapOriginDestination.bind(this);
        this.handleProviderChange = this.handleProviderChange.bind(this);
        this.toggleSettings = this.toggleSettings.bind(this);
    }

    componentDidMount() {
        this.initGeocodersInterval = setInterval(() => {
            if (this.props.map && !this.geocodersInitialized) {
                this.initGeocoders();
                this.setupMapClickListener();
                clearInterval(this.initGeocodersInterval);
            }
        }, 100);

        // Store initial points for later processing after geocoders are attached
        this.pendingInitialPoints = {
            from: this.props.fromPoint,
            to: this.props.toPoint
        };

        // Notify parent component about initial panel state
        if (this.props.onDirectionsPanelToggle) {
            this.props.onDirectionsPanelToggle(!this.state.collapsed);
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.map && !prevProps.map && !this.geocodersInitialized) {
            console.debug('Map became available, initializing geocoders');
            this.initGeocoders();
            this.setupMapClickListener();
        }
        
        if (this.props.map && prevProps.map && this.props.map !== prevProps.map) {
            console.debug('Map reference changed, reattaching markers and click listener');
            this.reattachMarkers();
            this.setupMapClickListener();
        }
        
        // Ensure map click listener is always attached when map is available
        if (this.props.map && !this.mapClickListener) {
            console.debug('Map available but no click listener, setting up');
            this.setupMapClickListener();
        }

        // Sync markers when points change
        const pointsChanged = this.props.fromPoint !== prevProps.fromPoint || 
                             this.props.toPoint !== prevProps.toPoint;
        if (pointsChanged && this.props.map) {
            console.debug('From or to point changed, syncing markers');
            this.syncMarkersWithProps();
        }

        // Calculate directions only when both points exist and either:
        // 1. Points changed, or
        // 2. GeoJson just became available
        const shouldCalculateDirections = (
            this.props.fromPoint && 
            this.props.toPoint && 
            this.props.geoJson &&
            (pointsChanged || (this.props.geoJson && !prevProps.geoJson))
        );

        if (shouldCalculateDirections) {
            console.debug('Conditions met for directions calculation');
            this.requestDirectionsCalculation();
        }
    }

    componentWillUnmount() {
        if (this.initGeocodersInterval) {
            clearInterval(this.initGeocodersInterval);
        }
        if (this.blurTimeout) {
            clearTimeout(this.blurTimeout);
            this.blurTimeout = null;
        }
        this.cleanup();
        this.removeMapClickListener();
    }

    syncMarkersWithProps() {
        if (!this.props.map) return;

        const { fromPoint, toPoint } = this.props;
        if (fromPoint) {
            const fromCoords = fromPoint.result.center;
            if (this.fromMarker) {
                this.fromMarker.setLngLat(fromCoords).addTo(this.props.map);
            } else {
                this.addMarker('from', fromCoords);
            }
        } else {
            this.removeMarker('from');
        }

        if (toPoint) {
            const toCoords = toPoint.result.center;
            if (this.toMarker) {
                this.toMarker.setLngLat(toCoords).addTo(this.props.map);
            } else {
                this.addMarker('to', toCoords);
            }
        } else {
            this.removeMarker('to');
        }
    }


    initGeocoders() {
        if (!this.props.map) {
            console.debug('Map not available yet, waiting...');
            return;
        }

        // Check if geocoders are already properly initialized
        if (this.fromGeocoder && this.toGeocoder && 
            this.fromGeocoderElement && this.toGeocoderElement) {
            console.debug('Geocoders already initialized, skipping reinit');
            return;
        }

        console.debug('Initializing geocoders with map:', this.props.map);

        this.cleanup(false); // Don't remove map listener during geocoder reinit

        // Initialize "From" geocoder
        this.fromGeocoder = new MapboxGeocoder({
            accessToken: MAPBOX_ACCESS_TOKEN,
            mapboxgl: mapboxgl,
            placeholder: 'Origem',
            language: 'pt-BR',
            flyTo: false,
            countries: IS_PROD ? 'br' : '',
            marker: false,
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
            marker: false,
            useBrowserFocus: true
        });

        // Add event listeners
        this.fromGeocoder.on('result', (result) => {
            console.debug('From point selected:', result);
            this.handleGeocoderResult(result, 'from');
        });

        this.toGeocoder.on('result', (result) => {
            console.debug('To point selected:', result);
            this.handleGeocoderResult(result, 'to');
        });

        this.fromGeocoder.on('clear', () => {
            this.removeMarker('from');
            this.props.onFromPointChange(null);
        });

        this.toGeocoder.on('clear', () => {
            this.removeMarker('to');
            this.props.onToPointChange(null);
        });

        this.setState({
            fromGeocoderAttached: false,
            toGeocoderAttached: false
        });

        // If we have pending initial points, store them for processing after DOM attachment
        if (!this.pendingInitialPoints) {
            this.pendingInitialPoints = {
                from: this.props.fromPoint,
                to: this.props.toPoint
            };
        }

        // Mark geocoders as initialized
        this.geocodersInitialized = true;
    }

    handleGeocoderResult(result, type) {
        if (type === 'from') {
            this.props.onFromPointChange(result);
        } else {
            this.props.onToPointChange(result);
        }
        
        if (type === 'from' && !this.props.toPoint) {
            this.autoFocusDestinationInput();
        }
    }

    autoFocusDestinationInput() {
        // Wait for the geocoder to be attached to DOM
        const tryFocus = () => {
            const toGeocoderElement = this.toGeocoderElement;
            if (toGeocoderElement) {
                const destinationInput = toGeocoderElement.querySelector('input');
                if (destinationInput) {
                    if (this.blurTimeout) {
                        clearTimeout(this.blurTimeout);
                        this.blurTimeout = null;
                    }
                    
                    destinationInput.focus();
                    this.setState({ focusedInput: 'to' });
                    console.debug('Auto-focused destination input after origin was set');
                    return true;
                }
            }
            return false;
        };

        // Try immediately first
        if (!tryFocus()) {
            // If not available, try again after a short delay
            setTimeout(() => {
                if (!tryFocus()) {
                    console.debug('Could not focus destination input - geocoder not ready');
                }
            }, 200);
        }
    }

    addMarker(type, coordinates) {
        this.removeMarker(type);
        
        const el = document.createElement('div');
        el.className = `origin-destination-marker bg-white border border-white flex items-center justify-center rounded-full text-base text-black`;
        el.innerHTML = type === 'from' ? 'A' : 'B';

        el.addEventListener('mousedown', () => {
            el.classList.add('custom-marker--dragging');
        });

        el.addEventListener('mouseup', () => {
            el.classList.remove('custom-marker--dragging');
        });

        el.addEventListener('mouseleave', () => {
            el.classList.remove('custom-marker--dragging');
        });

        const marker = new mapboxgl.Marker({
            element: el,
            draggable: true
        }).setLngLat(coordinates);

        marker.addTo(this.props.map);
        marker.on('dragend', () => this.handleMarkerDrag(marker, type));
        
        this[`${type}Marker`] = marker;
    }

    removeMarker(type) {
        const marker = this[`${type}Marker`];
        if (marker) {
            marker.remove();
            this[`${type}Marker`] = null;
        }
    }

    reattachMarkers() {
        if (!this.props.map) return;

        if (this.fromMarker) {
            this.fromMarker.addTo(this.props.map);
        }
        if (this.toMarker) {
            this.toMarker.addTo(this.props.map);
        }
    }

    cleanup(removeMapListener = true) {
        // Remove map click listener only if explicitly requested
        if (removeMapListener) {
            this.removeMapClickListener();
        }
        
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

        // Reset initialization flag when cleaning up
        this.geocodersInitialized = false;

        // Remove custom markers
        this.removeMarker('from');
        this.removeMarker('to');

        // Clear DOM containers
        const fromContainer = document.getElementById('fromGeocoder');
        const toContainer = document.getElementById('toGeocoder');
        
        if (fromContainer) {
            fromContainer.innerHTML = '';
        }
        if (toContainer) {
            toContainer.innerHTML = '';
        }

        this.setState({
            fromGeocoderAttached: false,
            toGeocoderAttached: false
        });
    }

    toggleCollapse() {
        const newCollapsedState = !this.state.collapsed;
        
        // Only clear directions when closing the panel
        if (newCollapsedState) {
            this.clearDirections();
        }
        this.setState({
            collapsed: newCollapsedState
        });

        // Notify parent component about panel state change
        if (this.props.onDirectionsPanelToggle) {
            this.props.onDirectionsPanelToggle(!newCollapsedState);
        }

        // On mobile, when opening the panel (collapsed -> expanded), auto-trigger geolocation
        // if (IS_MOBILE && newCollapsedState === false) {
        //     this.autoTriggerGeolocation();
        // }
    }

    autoTriggerGeolocation() {
        // Wait for the geocoder to be attached to DOM before trying to click the geolocate button
        const tryGeolocate = () => {
            const geolocateButton = document.querySelector('button[aria-label="Geolocate"]');
            if (geolocateButton) {
                console.debug('Auto-triggering geolocation on mobile');
                geolocateButton.click();

                setTimeout(() => {
                    this.autoFocusDestinationInput();
                }, 500);
                return true;
            }
            return false;
        };

        // Try immediately first
        if (!tryGeolocate()) {
            // If not available, try again after a short delay
            setTimeout(() => {
                if (!tryGeolocate()) {
                    console.debug('Could not find geolocate button - geocoder not ready');
                }
            }, 500);
        }
    }

    async calculateDirections(fromCoords, toCoords, provider) {
        if (this.props.setLoading) {
            this.props.setLoading(true);
        }
        if (this.props.setError) {
            this.props.setError(null);
        }

        try {
            const result = await DirectionsManager.calculateDirections(
                fromCoords, 
                toCoords, 
                provider, 
                this.props.geoJson, 
                this.props.layers,
                this.props.isDarkMode
            );

            if (this.props.setDirectionsData) {
                this.props.setDirectionsData(result);
            }
            
        } catch (error) {
            if (this.props.setError) {
                this.props.setError(error.message);
            }
            if (this.props.setLoading) {
                this.props.setLoading(false);
            }
            console.error('Directions error:', error);
        }
    }

    requestDirectionsCalculation() {
        if (this.props.fromPoint && this.props.toPoint) {
            if (!this.props.geoJson) {
                console.debug('GeoJson data not ready yet, deferring directions calculation');
                return;
            }
            
            const fromCoords = this.props.fromPoint.result.center;
            const toCoords = this.props.toPoint.result.center;
            
            console.debug('Requesting directions calculation from:', fromCoords, 'to:', toCoords);
            this.calculateDirections(fromCoords, toCoords, this.state.selectedProvider);
        } else {
            console.debug('No from or to point, skipping directions calculation');
        }
    }

    clearDirections() {
        this.props.onClearRoutePoints();
        
        this.cleanup();
        
        // Reattach map click listener after cleanup
        if (this.props.map) {
            this.setupMapClickListener();
        }
        
        if (this.props.onDirectionsCleared) {
            this.props.onDirectionsCleared();
        }
    }



    swapOriginDestination() {
        const { fromPoint, toPoint } = this.props;
        
        if (!fromPoint || !toPoint) {
            return;
        }

        this.props.onFromPointChange(toPoint);
        this.props.onToPointChange(fromPoint);
        
        this.safeSetGeocoderInput(this.fromGeocoder, toPoint.result.place_name, 'from');
        this.safeSetGeocoderInput(this.toGeocoder, fromPoint.result.place_name, 'to');
    }

    handleProviderChange(provider) {
        this.setState({
            selectedProvider: provider
        });
        
        // Recalculate directions with the new provider if we have both points
        if (this.props.fromPoint && this.props.toPoint) {
            const fromCoords = this.props.fromPoint.result.center;
            const toCoords = this.props.toPoint.result.center;
            this.calculateDirections(fromCoords, toCoords, provider);
        }
    }

    toggleSettings() {
        this.setState({
            settingsVisible: !this.state.settingsVisible
        });
    }

    setDestinationFromMapClick(coordinates) {
        if (this.state.collapsed) {
            this.toggleCollapse();
        }
        
        this.reverseGeocode({ lng: coordinates[0], lat: coordinates[1] }, 'to');
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

    handleMarkerDrag(marker, type) {
        const coordinates = marker.getLngLat();
        console.debug(`${type} marker dragged to:`, coordinates);


        this.reverseGeocode(coordinates, type);
    }

    reverseGeocode(coordinates, type) {
        if (!coordinates) return;

        const lngLat = [coordinates.lng, coordinates.lat];
        console.debug(`Reverse geocoding for ${type} point:`, lngLat);

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
                    
                    const geocoder = type === 'from' ? this.fromGeocoder : this.toGeocoder;
                    console.debug(`Setting input for ${type} geocoder:`, address);
                    if (geocoder && this[`${type}GeocoderElement`]) {
                        this.safeSetGeocoderInput(geocoder, address, type);
                    } else {
                        console.warn(`No geocoder found for ${type} geocoder`);
                    }

                    const newPoint = {
                        result: {
                            center: lngLat,
                            place_name: address,
                            ...place
                        }
                    };

                    // Update route state via hook
                    if (type === 'from') {
                        this.props.onFromPointChange(newPoint);
                    } else {
                        this.props.onToPointChange(newPoint);
                    }
                } else {
                    const geocoder = type === 'from' ? this.fromGeocoder : this.toGeocoder;
                    console.debug(`Setting fallback input for ${type} geocoder`);
                    if (geocoder) {
                        this.safeSetGeocoderInput(geocoder, 'Nova posição', type);
                    }
                }
            })
            .catch(err => {
                console.error('Reverse geocoding error:', err);
                const geocoder = type === 'from' ? this.fromGeocoder : this.toGeocoder;
                if (geocoder) {
                    this.safeSetGeocoderInput(geocoder, 'Nova posição', type);
                }
            });
    }

    setupMapClickListener() {
        if (!this.props.map) {
            console.debug('Map not available for click listener setup');
            return;
        }
        
        console.debug('Setting up map click listener');
        
        // Always remove existing listener first to ensure clean state
        this.removeMapClickListener();
        
        // Add new click listener
        this.mapClickListener = (e) => {
            console.debug("Map clicked, focusedInput:", this.state.focusedInput);
            if (this.state.focusedInput) {
                this.handleMapClick(e);
            } else {
                console.debug("Map clicked but no input focused, ignoring");
            }
        };
        
        this.props.map.on('click', this.mapClickListener);
        console.debug('Map click listener attached');
    }

    removeMapClickListener() {
        if (this.props.map && this.mapClickListener) {
            console.debug('Removing map click listener');
            this.props.map.off('click', this.mapClickListener);
        }
        this.mapClickListener = null;
    }

    handleInputFocus(inputType) {
        console.debug(`Input focused: ${inputType}`);
        this.setState({ focusedInput: inputType });

        if (this[`${inputType}GeocoderElement`]) {
            this[`${inputType}GeocoderElement`].querySelector('input').placeholder = 'Digite ou clique no mapa';
        }

        // Notify parent that user is setting route points
        if (this.props.onRouteModeChange) {
            this.props.onRouteModeChange(true);
        }
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
                
                this.blurTimeout = null;

                if (this[`${inputType}GeocoderElement`]) {
                    this[`${inputType}GeocoderElement`].querySelector('input').placeholder = inputType === 'from' ? 'Origem' : 'Destino';
                }

                // Notify parent that user is no longer setting route points
                if (this.props.onRouteModeChange) {
                    this.props.onRouteModeChange(false);
                }
            }, 500);
        } else {
            console.debug('Blur ignored - different input is focused');
        }
    }

    handleMapClick(e) {
        console.debug('handleMapClick called, focusedInput:', this.state.focusedInput);
        
        if (!this.state.focusedInput) {
            console.debug('No input focused, ignoring map click');
            return;
        }
        
        const coordinates = [e.lngLat.lng, e.lngLat.lat];
        const focusedInput = this.state.focusedInput;
        
        
        this.reverseGeocode(e.lngLat, focusedInput);
        
        if (focusedInput === 'from' && !this.props.toPoint) {
            this.autoFocusDestinationInput();
        } else {
            this.setState({ focusedInput: null });
        }
    }

    safeSetGeocoderInput(geocoder, value, geocoderType, maxRetries = 10) {
        if (!geocoder || !geocoder.setInput) {
            console.warn('Geocoder or setInput method not available');
            return false;
        }

        const trySetInput = (retryCount = 0) => {
            try {
                // Use the stored geocoder element reference
                const geocoderElement = this[`${geocoderType}GeocoderElement`];
                if (geocoderElement) {
                    const input = geocoderElement.querySelector('input');
                    if (input) {
                        geocoder.setInput(value);
                        return true;
                    }
                }
                
                // If input not ready and we have retries left, try again
                if (retryCount < maxRetries) {
                    setTimeout(() => trySetInput(retryCount + 1), 100);
                } else {
                    console.warn(`Failed to set geocoder input after ${maxRetries} retries`);
                }
            } catch (error) {
                console.warn('Error setting geocoder input:', error);
                if (retryCount < maxRetries) {
                    setTimeout(() => trySetInput(retryCount + 1), 100);
                }
            }
            return false;
        };

        return trySetInput();
    }

    attachMapboxGeocoderToDOM(geocoderType, containerId, attachedStateKey) {
        return (el) => {
            if (el && !el.hasChildNodes() && !this.state[attachedStateKey]) {
                console.debug(`Attaching ${geocoderType} geocoder to DOM`);
                try {
                    const geocoder = this[`${geocoderType}Geocoder`];
                    if (geocoder) {
                        const geocoderElement = geocoder.onAdd(this.props.map);
                        el.appendChild(geocoderElement);
                        
                        this[`${geocoderType}GeocoderElement`] = geocoderElement;
                        
                        const input = geocoderElement.querySelector('input');
                        if (input) {
                            const focusHandler = () => this.handleInputFocus(geocoderType);
                            const blurHandler = () => this.handleInputBlur(geocoderType);
                            
                            input.addEventListener('focus', focusHandler);
                            input.addEventListener('blur', blurHandler);
                        }
                        
                        this.setState({ [attachedStateKey]: true });
                        
                        this.processPendingInitialPoints(geocoderType);
                    }
                } catch (error) {
                    console.debug(`Error attaching ${geocoderType} geocoder:`, error);
                }
            }
        };
    }

    processPendingInitialPoints(geocoderType) {
        if (this.pendingInitialPoints && this.pendingInitialPoints[geocoderType]) {
            const point = this.pendingInitialPoints[geocoderType];
            console.debug(`Processing pending initial point for ${geocoderType}:`, point);
            
            // Always perform reverse geocoding to get the address and set the input
            const coordinates = { lng: point.result.center[0], lat: point.result.center[1] };
            console.debug(`Performing reverse geocoding for ${geocoderType} with coordinates:`, coordinates);
            this.reverseGeocode(coordinates, geocoderType);
            
            this.pendingInitialPoints[geocoderType] = null;
        }
    }

    renderSettingsContent() {
        return (
            <div className="text-white" style={{ width: 200 }}>
                <h3 className="font-semibold mb-3">Serviço de Rotas</h3>
                
                <Select
                    value={this.state.selectedProvider}
                    onChange={this.handleProviderChange}
                    className="w-full"
                    size="small"
                    options={[
                        {
                            value: 'hybrid',
                            label: '✨ Combinado',
                        },
                        {
                            value: 'valhalla',
                            label: 'Valhalla',
                        },
                        {
                            value: 'graphhopper',
                            label: 'GraphHopper',
                        },
                        {
                            value: 'mapbox',
                            label: 'Mapbox',
                        }
                    ]}
                />
            </div>
        );
    }

    render() {
        const { directions, directionsLoading, directionsError } = this.props;
        const routes = directions && directions.routes ? directions.routes : [];
        const showResultsOnMobile = IS_MOBILE && (directions || directionsLoading);
        
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
                        glass-bg fixed text-white cursor-pointer
                        ${IS_MOBILE ? 
                            (this.state.collapsed ? '' : 'directions-panel-open') : 
                            (this.state.collapsed ? 'hidden' : '')
                        }
                    `}
                >
                    <div className="p-4">
                        <div id="directionsPanel--header" className="flex justify-between items-start h-6">
                            {showResultsOnMobile ? (
                                // Mobile results header with Back button
                                <Button
                                    onClick={this.clearDirections}
                                    type="text"
                                    size="small"
                                    className="text-white flex items-center"
                                    icon={<IconBack className="mr-1" style={{
                                        display: 'inline-block',
                                    }}/>}
                                >
                                    Voltar
                                </Button>
                            ) : (
                                // Default header
                                <>
                                    <h3 className=" font-semibold flex items-center mb-0">
                                        <IconRoute className="mr-2" />
                                        Rotas de bici
                                        <span className="bg-white opacity-50 ml-1 px-1 py-0 rounded-full text-black text-xs leading-normal tracking-wider" style={{fontSize: 10}}>
                                            BETA
                                        </span>
                                    </h3>

                                    <div className="flex items-start" style={{marginTop: '-5px'}}>
                                        {(directions || this.props.fromPoint || this.props.toPoint) && (
                                            <Button
                                            onClick={this.clearDirections}
                                            type="text" 
                                            shape="circle"
                                            icon={<IconTrash style={{
                                                display: 'inline-block',
                                            }}/>}
                                            />
                                        )}
                                        {this.props.fromPoint && this.props.toPoint && (
                                            <Button 
                                                type="text"
                                                shape="circle"
                                                icon={
                                                    <IconSwap style={{
                                                        display: 'inline-block',
                                                    }}/>}
                                                onClick={this.swapOriginDestination}
                                                className="swap-button flex-shrink-0 text-white"
                                                title="Trocar origem e destino"
                                            />
                                        )}
                                        
                                        <Popover
                                            content={this.renderSettingsContent()}
                                            title={null}
                                            trigger="click"
                                            open={this.state.settingsVisible}
                                            onOpenChange={this.toggleSettings}
                                            placement="bottomRight"
                                        >
                                            <Button 
                                                type="text"
                                                shape="circle"
                                                icon={<IconCog style={{
                                                    display: 'inline-block',
                                                }}/>}
                                                className="flex-shrink-0 text-white"
                                                title="Configurações do serviço"
                                            />
                                        </Popover>
                                        
                                        {/* Put this back after we have a trigger to open the panel */}
                                        { IS_MOBILE && (
                                            <Button
                                                onClick={this.toggleCollapse}
                                                type="text" 
                                                shape="circle"
                                                icon={<IconClose style={{
                                                    display: 'inline-block',
                                                }}/>}
                                            />
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {!showResultsOnMobile && (
                            <Space direction="vertical" size="small" className="w-full mt-3">
                                <div 
                                    id="fromGeocoder"
                                    className='flex'
                                    ref={this.attachMapboxGeocoderToDOM('from', 'fromGeocoder', 'fromGeocoderAttached')}
                                />

                                <div 
                                    id="toGeocoder"
                                    className='flex flex-1'
                                    ref={this.attachMapboxGeocoderToDOM('to', 'toGeocoder', 'toGeocoderAttached')}
                                />

                                {/* <Button
                                    type="primary"
                                    onClick={this.calculateDirections}
                                    loading={loading}
                                    disabled={!this.props.fromPoint || !this.props.toPoint}
                                    block
                                    // size="large"
                                    className="mt-2 bg-green-600 hover:bg-green-700"
                                >
                                    Calcular rota
                                </Button> */}
                            </Space>
                        )}

                        {directionsLoading && (
                            <div className="directionsPanel--results md:mt-3 space-y-1">
                                {Array.from({ length: HYBRID_MAX_RESULTS }, (_, index) => index + 1).map((index) => (
                                    <div key={index} className={`rounded-lg h-14 bg-white bg-opacity-10 animate-pulse-2x`}/>
                                ))}
                            </div>
                        )}

                        {directionsError && (
                            <div className="mt-3 p-2 bg-red-600 bg-opacity-20 border border-red-500 rounded text-red-200 text-sm">
                                Erro: {directionsError}
                            </div>
                        )}

                        {directions && !directionsLoading && (
                            <div id="directionsPanel--results" className="mt-3">
                                <div className="space-y-1">
                                    {directions.routes && directions.routes.map((route, index) => (
                                        <div
                                            key={index}
                                            className={`rounded-lg p-2 cursor-pointer transition-colors ${
                                                this.props.selectedRouteIndex === index ? 'bg-white bg-opacity-10 border-opacity-60' : ''
                                            } ${
                                                this.props.hoveredRouteIndex === index ? 'bg-white bg-opacity-5' : ''
                                            }`}
                                            onMouseEnter={() => this.handleRouteHover(index)}
                                            onMouseLeave={this.handleRouteLeave}
                                            onClick={() => this.handleRouteClick(index)}
                                        >
                                            <div className="flex justify-between gap-1">
                                                {/* Left column */}
                                                <div className="flex items-start">
                                                    {(routes[index] || {}).score !== null ? (
                                                        <div 
                                                            className={`flex items-center mr-2 ${(routes[index] || {}).scoreClass || 'bg-gray-600'} px-1.5 py-1.5 rounded-md md:text-sm text-xs leading-none font-mono text-center`} 
                                                            style={{color: 'white'}}>
                                                            {(routes[index] || {}).score}
                                                        </div>
                                                    ) : (
                                                        <IconBike 
                                                            className="w-4 h-4 mr-2" 
                                                            title="Dados de cobertura não disponíveis" 
                                                        />
                                                    )}

                                                    <div className="flex flex-col flex-end">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="directions--legLabel md:text-sm text-xs">
                                                                {
                                                                // route.legs && route.legs.length > 0 && route.legs[0].summary.length > 0 ? route.legs[0].summary :
                                                                //     route.summary ? route.summary :
                                                                    `Opção ${index + 1}`
                                                                }
                                                            </span>
                                                            {route.provider && (
                                                                <span className="text-xs px-1 bg-gray-600 bg-opacity-50 rounded text-gray-300 font-mono">
                                                                    {route.provider}
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* {(route.ascend !== undefined || route.descend !== undefined) && (
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
                                                        )} */}

                                                        {
                                                            this.props.selectedRouteIndex === index ?
                                                                (routes[index] || {}).coverageBreakdown :
                                                                (routes[index] || {}).coverageBreakdownSimple || null
                                                        }
                                                    </div>
                                                </div>

                                                {/* Right column */}
                                                <div className="flex flex-col flex-end flex-shrink-0">
                                                    <span className="md:text-sm text-xs text-right mb-1">
                                                        {formatDuration(route.duration)}
                                                    </span>
                                                    <span className="md:text-sm text-xs text-gray-400 text-right">
                                                        {formatDistance(route.distance)}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                        )
                                    )}
                                </div>
                                
                                {/* Disclaimer */}
                                <div className="p-2 text-gray-500 text-xs gap-2 flex flex-col">
                                    <div>
                                        As rotas são sugestões automáticas, sempre verifique as condições das vias, sinalização e segurança antes de pedalar! :) 
                                        <Popover
                                            content={(
                                                <div className="text-sm text-white" style={{width: 320}}>
                                                    <h3 className="font-semibold">
                                                        Como calculamos as notas?
                                                    </h3>
                                                    <p>
                                                        As notas indicam o quanto cada opção de rota está coberta por diferentes tipos de infraestrutura cicloviária.
                                                    </p>
                                                    <p>
                                                        Por exemplo: uma opção 100% coberta por ciclovias ganha a nota máxima 100. Porém se fosse por ciclorrotas a nota seria bem menor, já que a pessoa ciclista precisa compartilhar a via com carros.
                                                    </p>
                                                    <p>
                                                        <code>
                                                            nota = pCiclovia*1.0 + pCalcadaCompartilhada*0.8 + pCiclofaixa*0.6 + pCiclorrota*0.4
                                                        </code>
                                                    </p>
                                                </div>
                                            )}
                                        >
                                            {" "}
                                            <span className="underline">
                                                Leia mais sobre como calculamos as notas
                                            </span>
                                        </Popover>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </>
        )
    }
}

// Wrapper component to use the directions context with the class component
const DirectionsPanelWrapper = React.forwardRef((props, ref) => {
    const directionsContext = useDirections();
    
    return (
        <DirectionsPanel
            ref={ref}
            {...props}
            directions={directionsContext.directions}
            directionsLoading={directionsContext.directionsLoading}
            directionsError={directionsContext.directionsError}
            selectedRouteIndex={directionsContext.selectedRouteIndex}
            hoveredRouteIndex={directionsContext.hoveredRouteIndex}
            onRouteSelected={directionsContext.selectRoute}
            onRouteHovered={directionsContext.hoverRoute}
            onDirectionsCleared={directionsContext.clearDirections}
            onRouteModeChange={directionsContext.setRoutePointsMode}
            setLoading={directionsContext.setLoading}
            setError={directionsContext.setError}
            setDirectionsData={directionsContext.setDirectionsData}
            geoJson={props.geoJson}
            layers={props.layers}
        />
    );
});

export default DirectionsPanelWrapper;
