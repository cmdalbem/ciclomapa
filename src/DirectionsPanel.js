import React, { Component } from 'react';
import { useDirections } from './DirectionsContext.js';
import { Button, Input, Space, Divider, Tabs, Select, AutoComplete } from 'antd';
import { 
    HiOutlineTrendingUp as IconTrendingUp,
    HiOutlineTrendingDown as IconTrendingDown
} from "react-icons/hi";
import { HiX as IconClose, HiOutlineArrowLeft as IconBack, HiLocationMarker as IconLocation } from "react-icons/hi";
import { MdGpsFixed as IconGPS } from "react-icons/md";
import { LuBike as IconBike } from "react-icons/lu";
import { FaDirections as IconRoute } from "react-icons/fa";
import { HiOutlineArrowsUpDown as IconSwap, HiTrash as IconTrash, HiOutlineExclamationTriangle as IconNoData } from "react-icons/hi2";
import { HiCog as IconCog } from "react-icons/hi";
import { HiSearch as IconSearch } from "react-icons/hi";
import GooglePlacesGeocoder from './GooglePlacesGeocoder.js';
import mapboxgl from 'mapbox-gl';
import { Popover } from 'antd';


import './DirectionsPanel.css';

import { 
    MAPBOX_ACCESS_TOKEN,
    GOOGLE_PLACES_API_KEY,
    IS_PROD,
    IS_MOBILE,
    HYBRID_MAX_RESULTS,
    ENABLE_MAP_CLICK_TO_SET_POINTS
} from './constants.js'
import DirectionsManager from './DirectionsManager.js'
import { formatDistance, formatDuration } from './routeUtils.js'

// LocationSearchInput component to encapsulate AutoComplete logic
class LocationSearchInput extends Component {
    render() {
        const { 
            inputType, 
            parentComponent,
            className = "w-full"
        } = this.props;

        const state = parentComponent.state;
        const handlers = parentComponent;

        const isFrom = inputType === 'from';
        const placeholder = isFrom ? 'Origem' : 'Destino';
        const showGeolocation = isFrom; // Only show GPS button for origin

        return (
            <AutoComplete
                value={state[`${inputType}SearchValue`]}
                onChange={(value) => parentComponent.setState({ [`${inputType}SearchValue`]: value })}
                onSearch={(value) => handlers.handleSearch(value, inputType)}
                loading={state[`${inputType}SearchLoading`]}
                options={state[`${inputType}Suggestions`].map(suggestion => {
                    const mainText = suggestion.properties?.structured_formatting?.main_text || suggestion.place_name;
                    const secondaryText = suggestion.properties?.structured_formatting?.secondary_text;
                    
                    return {
                        value: suggestion.place_name,
                        label: (
                            <div className="flex items-center gap-3 py-1">
                                <span className="text-lg flex-shrink-0 opacity-70">
                                    {googlePlacesGeocoder.getPlaceTypeIcon(suggestion.properties.types)}
                                </span>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-sm font-medium truncate">{mainText}</span>
                                    {secondaryText && (
                                        <span className="text-xs text-gray-400 truncate">{secondaryText}</span>
                                    )}
                                </div>
                            </div>
                        ),
                        key: suggestion.id,
                        suggestion: suggestion
                    };
                })}
                onSelect={(value, option) => handlers.handleSelect(option.suggestion, inputType)}
                className={className}
                size="large"
                allowClear={true}
                onClear={() => handlers.handleClearInput(inputType)}
            >
                <Input
                    placeholder={state.focusedInput === inputType ? (ENABLE_MAP_CLICK_TO_SET_POINTS ? 'Digite ou clique no mapa' : 'Comece a digitar para buscar') : placeholder}
                    prefix={
                        <IconSearch className="text-white opacity-30" style={{
                            display: 'inline-block',
                        }}/>
                    }
                    suffix={
                        showGeolocation && (
                            <Button
                                type="text"
                                shape="circle"
                                icon={<IconGPS className="text-white" style={{
                                    display: 'inline-block',
                                }}/>}
                                onClick={() => handlers.handleGeolocation(inputType)}
                                className="text-white border-0"
                                title="Usar localização atual"
                                size="small"
                            />
                        )
                    }
                    onFocus={() => handlers.handleInputFocus(inputType)}
                    onBlur={() => handlers.handleInputBlur(inputType)}
                />
            </AutoComplete>
        );
    }
}

const googlePlacesGeocoder = new GooglePlacesGeocoder({
    apiKey: GOOGLE_PLACES_API_KEY,
    language: 'pt-BR',
    region: 'br'
});

// Initialize the geocoder when needed
let geocoderInitialized = false;
const ensureGeocoderReady = async () => {
    if (!geocoderInitialized) {
        try {
            await googlePlacesGeocoder.loadGoogleMapsAPI();
            geocoderInitialized = true;
        } catch (error) {
            console.error('Failed to initialize Google Places Geocoder:', error);
        }
    }
};

class DirectionsPanel extends Component {
    constructor(props) {
        super(props);
        this.state = {
            collapsed: IS_MOBILE,
            fromGeocoderAttached: false,
            toGeocoderAttached: false,
            focusedInput: null,
            selectedProvider: 'hybrid',
            settingsVisible: false,
            fromSuggestions: [],
            toSuggestions: [],
            fromSearchValue: '',
            toSearchValue: '',
            fromSearchLoading: false,
            toSearchLoading: false
        };

        this.fromMarker = null;
        this.toMarker = null;
        this.blurTimeout = null;
        this.geocodersInitialized = false;
        this.isDraggingMarker = false;

        this.toggleCollapse = this.toggleCollapse.bind(this);
        this.clearDirections = this.clearDirections.bind(this);
        this.clearDirectionsOnly = this.clearDirectionsOnly.bind(this);
        this.selectRoute = this.selectRoute.bind(this);
        this.handleRouteHover = this.handleRouteHover.bind(this);
        this.handleRouteLeave = this.handleRouteLeave.bind(this);
        this.handleRouteClick = this.handleRouteClick.bind(this);
        this.handleMarkerDrag = this.handleMarkerDrag.bind(this);
        this.handleInputFocus = this.handleInputFocus.bind(this);
        this.handleInputBlur = this.handleInputBlur.bind(this);
        this.handleMapClick = this.handleMapClick.bind(this);
        this.handleSearch = this.handleSearch.bind(this);
        this.handleSelect = this.handleSelect.bind(this);
        this.handleGeolocation = this.handleGeolocation.bind(this);
        this.handleClearInput = this.handleClearInput.bind(this);
        this.calculateDirections = this.calculateDirections.bind(this);
        this.swapOriginDestination = this.swapOriginDestination.bind(this);
        this.handleProviderChange = this.handleProviderChange.bind(this);
        this.toggleSettings = this.toggleSettings.bind(this);
    }

    componentDidMount() {
        this.setupMapClickListener();

        // Store initial points for later processing
        this.pendingInitialPoints = {
            from: this.props.fromPoint,
            to: this.props.toPoint
        };

        // Initialize search input values if points are already set (e.g., from URL)
        if (this.props.fromPoint && this.props.fromPoint.result && this.props.fromPoint.result.place_name) {
            this.setState({ fromSearchValue: this.props.fromPoint.result.place_name });
        }
        if (this.props.toPoint && this.props.toPoint.result && this.props.toPoint.result.place_name) {
            this.setState({ toSearchValue: this.props.toPoint.result.place_name });
        }

        // Notify parent component about initial panel state
        if (this.props.onDirectionsPanelToggle) {
            this.props.onDirectionsPanelToggle(!this.state.collapsed);
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.map && !prevProps.map) {
            console.debug('Map became available, setting up map click listener');
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
            
            // Reset dragging flag if it was set
            if (this.isDraggingMarker) {
                this.isDraggingMarker = false;
            }
            
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
            
            // Update search input value if place_name exists
            if (fromPoint.result.place_name) {
                this.setState({ fromSearchValue: fromPoint.result.place_name });
            }
        } else {
            this.removeMarker('from');
            this.setState({ fromSearchValue: '' });
        }

        if (toPoint) {
            const toCoords = toPoint.result.center;
            if (this.toMarker) {
                this.toMarker.setLngLat(toCoords).addTo(this.props.map);
            } else {
                this.addMarker('to', toCoords);
            }
            
            // Update search input value if place_name exists
            if (toPoint.result.place_name) {
                this.setState({ toSearchValue: toPoint.result.place_name });
            }
        } else {
            this.removeMarker('to');
            this.setState({ toSearchValue: '' });
        }
    }


    async handleSearch(value, inputType) {
        if (!value || value.length < 3) {
            this.setState({ [`${inputType}Suggestions`]: [] });
            return;
        }

        this.setState({ [`${inputType}SearchLoading`]: true });

        try {
            await ensureGeocoderReady();
            const results = await googlePlacesGeocoder.search(value, {
                proximity: this.props.map ? [this.props.map.getCenter().lng, this.props.map.getCenter().lat] : null,
                limit: 5
            });

            this.setState({ 
                [`${inputType}Suggestions`]: results,
                [`${inputType}SearchLoading`]: false 
            });
        } catch (error) {
            console.error(`${inputType} search error:`, error);
            this.setState({ 
                [`${inputType}Suggestions`]: [],
                [`${inputType}SearchLoading`]: false 
            });
        }
    }


    async handleSelect(result, inputType) {
        console.debug(`${inputType} point selected:`, result);
        
        try {
            // If this is a Places API prediction, we need to get the coordinates
            if (result.properties && result.properties.place_id && !result.center) {
                await ensureGeocoderReady();
                const placeDetails = await googlePlacesGeocoder.getPlaceDetails(result.properties.place_id);
                
                // Create a complete result with coordinates
                const completeResult = {
                    ...result,
                    center: placeDetails.coordinates,
                    geometry: {
                        coordinates: placeDetails.coordinates
                    },
                    properties: {
                        ...result.properties,
                        formatted_address: placeDetails.formatted_address,
                        name: placeDetails.name,
                        types: placeDetails.types
                    }
                };
                
                this.handleGeocoderResult({ result: completeResult }, inputType, true);
            } else {
                // If it already has coordinates, use it directly
                this.handleGeocoderResult({ result }, inputType, true);
            }
            
            this.setState({ 
                [`${inputType}Suggestions`]: [],
                [`${inputType}SearchValue`]: result.place_name 
            });

            // Auto-focus to destination input if origin is selected and no destination is set
            if (inputType === 'from' && !this.props.toPoint) {
                setTimeout(() => {
                    this.setState({ focusedInput: 'to' });
                    console.debug('Auto-focused destination input after origin selection');
                }, 500);
            }
        } catch (error) {
            console.error('Error getting place details:', error);
            // Fallback to the original result
            this.handleGeocoderResult({ result }, inputType);
            this.setState({ 
                [`${inputType}Suggestions`]: [],
                [`${inputType}SearchValue`]: result.place_name 
            });
        }
    }


    handleClearInput(inputType) {
        console.debug(`Clearing ${inputType} input`);
        
        // Clear the input value
        this.setState({
            [`${inputType}SearchValue`]: '',
            [`${inputType}Suggestions`]: []
        });
        
        // Clear the corresponding point
        if (inputType === 'from') {
            this.props.onFromPointChange(null);
            this.removeMarker('from');
        } else {
            this.props.onToPointChange(null);
            this.removeMarker('to');
        }
    }

    handleGeolocation(inputType) {
        if (!navigator.geolocation) {
            console.error('Geolocation is not supported by this browser');
            return;
        }

        console.debug(`Getting current location for ${inputType}`);
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coordinates = {
                    lng: position.coords.longitude,
                    lat: position.coords.latitude
                };
                
                console.debug('Current location:', coordinates);
                
                // Set the point and perform reverse geocoding
                this.reverseGeocode(coordinates, inputType);
            },
            (error) => {
                console.error('Geolocation error:', error);
                // You could show a user-friendly error message here
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 300000 // 5 minutes
            }
        );
    }

    handleGeocoderResult(result, type, fromAutocomplete = false) {
        if (type === 'from') {
            this.props.onFromPointChange(result);
            
            if (fromAutocomplete && this.props.map) {
                this.props.map.flyTo({
                    center: result.result.center,
                    zoom: Math.max(this.props.map.getZoom(), 16),
                    duration: 1500
                });
            }
            
            if (!this.props.toPoint) {
                setTimeout(() => {
                    this.setState({ focusedInput: 'to' });
                    console.debug('Auto-focused destination input after origin was set');
                }, 500);
            }
        } else {
            this.props.onToPointChange(result);
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
        marker.on('dragstart', () => {
            this.isDraggingMarker = true;
        });
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

        // Remove custom markers
        this.removeMarker('from');
        this.removeMarker('to');
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
        if (IS_MOBILE && newCollapsedState === false) {
            this.autoTriggerGeolocation();
        }
    }

    autoTriggerGeolocation() {
        if (!this.props.fromPoint) {
            setTimeout(() => {
                this.handleGeolocation('from');
            }, 100);
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

    clearDirectionsOnly() {
        // Only clear the calculated directions, keep origin/destination
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
        
        // Update the search input values
        this.setState({
            fromSearchValue: toPoint.result.place_name,
            toSearchValue: fromPoint.result.place_name
        });
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

    async reverseGeocode(coordinates, type) {
        if (!coordinates) return;

        const lngLat = [coordinates.lng, coordinates.lat];
        console.debug(`Reverse geocoding for ${type} point:`, lngLat);

        try {
            await ensureGeocoderReady();
            const result = await googlePlacesGeocoder.reverseGeocode(lngLat, {
                language: 'pt-BR'
            });

            console.debug('Reverse geocode result:', result);

            const address = result.place_name || 'Nova posição';
            
            // Update the search input value
            this.setState({
                [`${type}SearchValue`]: address
            });

            const newPoint = {
                result: {
                    center: lngLat,
                    place_name: address,
                    ...result
                }
            };

            // Update route state via hook
            if (type === 'from') {
                this.props.onFromPointChange(newPoint);
                
                // Auto-focus to destination if it's not set yet
                if (!this.props.toPoint) {
                    setTimeout(() => {
                        this.setState({ focusedInput: 'to' });
                        console.debug('Auto-focused destination input after origin was set');
                    }, 500);
                }
            } else {
                this.props.onToPointChange(newPoint);
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            this.setState({
                [`${type}SearchValue`]: 'Nova posição'
            });
        }
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
            // Also check if the blur was caused by clicking on a suggestion
            this.blurTimeout = setTimeout(() => {
                // Check if the active element is still within the autocomplete dropdown
                const activeElement = document.activeElement;
                const isDropdownActive = activeElement && (
                    activeElement.closest('.ant-select-dropdown') ||
                    activeElement.closest('.ant-select-item')
                );
                
                if (!isDropdownActive) {
                    this.setState({ focusedInput: null });
                    console.debug('Focus cleared, resetting cursor');
                    
                    // Notify parent that user is no longer setting route points
                    if (this.props.onRouteModeChange) {
                        this.props.onRouteModeChange(false);
                    }
                } else {
                    console.debug('Blur ignored - dropdown is active');
                }
                
                this.blurTimeout = null;
            }, 200); // Reduced timeout for better responsiveness
        } else {
            console.debug('Blur ignored - different input is focused');
        }
    }

    handleMapClick(e) {
        // Check if map click to set points is enabled
        if (!ENABLE_MAP_CLICK_TO_SET_POINTS) {
            console.debug('Map click to set points is disabled');
            return;
        }
        
        console.debug('handleMapClick called, focusedInput:', this.state.focusedInput);
        
        if (!this.state.focusedInput) {
            console.debug('No input focused, ignoring map click');
            return;
        }
        
        const coordinates = [e.lngLat.lng, e.lngLat.lat];
        const focusedInput = this.state.focusedInput;
        
        
        this.reverseGeocode(e.lngLat, focusedInput);
        
        // Focus is handled by reverseGeocode when setting the origin
        // Only clear focus if we set the destination
        if (focusedInput === 'to') {
            this.setState({ focusedInput: null });
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
                                    onClick={this.clearDirectionsOnly}
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
                                        
                                        { !IS_MOBILE && (
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
                                        )}

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
                                <div className="flex gap-2">
                                    <LocationSearchInput
                                        inputType="from"
                                        parentComponent={this}
                                        className="flex-1"
                                    />
                                </div>

                                <LocationSearchInput
                                    inputType="to"
                                    parentComponent={this}
                                />
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
                                                this.props.selectedRouteIndex === index ? '' : 'opacity-50'
                                            } ${
                                                this.props.hoveredRouteIndex === index ? 'bg-white bg-opacity-5 opacity-100' : ''
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
                                                            {/* {route.provider && (
                                                                <span className="text-xs px-1 bg-gray-600 bg-opacity-50 rounded text-gray-300 font-mono">
                                                                    {route.provider}
                                                                </span>
                                                            )} */}
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
                                <div className="p-2 text-gray-500 hover:text-white text-xs gap-2 flex flex-col">
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
