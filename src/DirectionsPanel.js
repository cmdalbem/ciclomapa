import React, { Component } from 'react';
import { useDirections } from './DirectionsContext.js';
import { Button, Input, Space, Divider, Tabs } from 'antd';
import { 
    HiOutlineTrendingUp as IconTrendingUp,
    HiOutlineTrendingDown as IconTrendingDown
} from "react-icons/hi";
import { LuBike as IconBike, LuRoute as IconRoute } from "react-icons/lu";
import MapboxGeocoder from '@mapbox/mapbox-gl-geocoder';
import '@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css';
import mapboxgl from 'mapbox-gl';
import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';

import './DirectionsPanel.css';

import { 
    MAPBOX_ACCESS_TOKEN,
    IS_PROD,
    IS_MOBILE
} from './constants.js'
import DirectionsManager from './DirectionsManager.js'
import { getRouteScore, getCoverageBreakdown, getCoverageBreakdownSimple, formatDistance, formatDuration } from './routeUtils.js'

const geocodingClient = mbxGeocoding({ accessToken: MAPBOX_ACCESS_TOKEN });

class DirectionsPanel extends Component {
    constructor(props) {
        super(props);
        this.state = {
            collapsed: IS_MOBILE,
            fromPoint: null,
            toPoint: null,
            fromGeocoderAttached: false,
            toGeocoderAttached: false,
            focusedInput: null,
            selectedProvider: 'graphhopper'
        };

        this.fromMarker = null;
        this.toMarker = null;
        this.fromGeocoder = null;
        this.toGeocoder = null;
        this.blurTimeout = null;

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
        this.attachGeocoderToDOM = this.attachGeocoderToDOM.bind(this);
        this.calculateDirections = this.calculateDirections.bind(this);
    }

    componentDidMount() {
        this.initGeocodersInterval = setInterval(() => {
            if (this.props.map) {
                this.initGeocoders();
                this.setupMapClickListener();
                clearInterval(this.initGeocodersInterval);
            }
        }, 100);

    }

    componentDidUpdate(prevProps) {
        if (this.props.map && !prevProps.map) {
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


    initGeocoders() {
        if (!this.props.map) {
            console.debug('Map not available yet, waiting...');
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
            this.setState({ fromPoint: null });
        });

        this.toGeocoder.on('clear', () => {
            this.removeMarker('to');
            this.setState({ toPoint: null });
        });

        this.setState({
            fromGeocoderAttached: false,
            toGeocoderAttached: false
        });
    }

    handleGeocoderResult(result, type) {
        this.addMarker(type, result.result.center);
        
        this.setState({ [type + 'Point']: result }, () => {
            this.requestDirectionsCalculation();
            
            if (type === 'from' && !this.state.toPoint) {
                this.autoFocusDestinationInput();
            }
        });
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
        el.className = `custom-marker custom-marker--${type}`;
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
        this.clearDirections();
        this.setState({
            collapsed: !this.state.collapsed
        });
    }


    async calculateDirections(fromCoords, toCoords, provider = 'graphhopper') {
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
                this.props.layers
            );

            if (this.props.setDirectionsData) {
                this.props.setDirectionsData(result);
            }
            
        } catch (error) {
            if (this.props.setError) {
                this.props.setError(error.message);
            }
            console.error('Directions error:', error);
        }
    }

    requestDirectionsCalculation() {
        if (this.state.fromPoint && this.state.toPoint) {
            const fromCoords = this.state.fromPoint.result.center;
            const toCoords = this.state.toPoint.result.center;
            
            console.debug('Requesting directions calculation from:', fromCoords, 'to:', toCoords);
            this.calculateDirections(fromCoords, toCoords, this.state.selectedProvider);
        }
    }

    clearDirections() {
        this.setState({ 
            fromPoint: null,
            toPoint: null
        });
        
        this.cleanup();
        
        // Reattach map click listener after cleanup
        if (this.props.map) {
            this.setupMapClickListener();
        }
        
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

    handleMarkerDrag(marker, type) {
        const coordinates = marker.getLngLat();
        console.debug(`${type} marker dragged to:`, coordinates);

        const newPoint = {
            result: {
                center: [coordinates.lng, coordinates.lat],
                place_name: 'Arrastado para nova posição'
            }
        };

        this.setState({ [type + 'Point']: newPoint }, () => {
            this.reverseGeocode(coordinates, type);
            this.requestDirectionsCalculation();
        });
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
                    if (geocoder && geocoder.setInput) {
                        geocoder.setInput(address);
                    }

                    const newPoint = {
                        result: {
                            center: lngLat,
                            place_name: address,
                            ...place
                        }
                    };

                    this.setState({ [type + 'Point']: newPoint });
                } else {
                    const geocoder = type === 'from' ? this.fromGeocoder : this.toGeocoder;
                    console.debug(`Setting fallback input for ${type} geocoder`);
                    if (geocoder && geocoder.setInput) {
                        geocoder.setInput('Nova posição');
                    }
                }
            })
            .catch(err => {
                console.error('Reverse geocoding error:', err);
                const geocoder = type === 'from' ? this.fromGeocoder : this.toGeocoder;
                if (geocoder && geocoder.setInput) {
                    geocoder.setInput('Nova posição');
                }
            });
    }



    setupMapClickListener() {
        if (!this.props.map) {
            console.debug('Map not available for click listener setup');
            return;
        }
        
        // Don't set up if already exists
        if (this.mapClickListener) {
            console.debug('Map click listener already exists, skipping setup');
            return;
        }
        
        console.debug('Setting up map click listener');
        
        // Add new click listener
        this.mapClickListener = (e) => {
            console.debug("Map clicked");
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
        if (!this.state.focusedInput) {
            console.debug('No input focused, ignoring map click');
            return;
        }
        
        const coordinates = [e.lngLat.lng, e.lngLat.lat];
        const focusedInput = this.state.focusedInput; // Store the focused input before clearing it
        console.debug(`${focusedInput} point set by map click:`, coordinates);
        
        const newPoint = {
            result: {
                center: coordinates,
                place_name: 'Ponto selecionado no mapa'
            }
        };
        
        this.addMarker(focusedInput, coordinates);
        
        this.setState({ [focusedInput + 'Point']: newPoint }, () => {
            this.reverseGeocode(e.lngLat, focusedInput);
            this.requestDirectionsCalculation();
            
            if (focusedInput === 'from' && !this.state.toPoint) {
                this.autoFocusDestinationInput();
            }
        });
        
        this.setState({ focusedInput: null });
        if (this.props.map) {
            this.props.map.getCanvas().style.cursor = '';
        }
    }

    attachGeocoderToDOM(geocoderType, containerId, attachedStateKey) {
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
                    }
                } catch (error) {
                    console.debug(`Error attaching ${geocoderType} geocoder:`, error);
                }
            }
        };
    }

    render() {
        const { directions, directionsLoading, directionsError } = this.props;
        const { routeCoverageData } = this.props;
        
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
                        ${this.state.collapsed ? 'hidden' : ''}
                    `}
                >
                    <div className="p-4">
                        <div id="directionsPanel--header" className="flex justify-between">
                            <h3 className=" font-semibold flex items-center">
                                <IconRoute className="mr-2" />
                                Rotas de bici
                                <span className="bg-white opacity-50 ml-1 px-1 py-0 rounded-full text-black text-xs leading-normal tracking-wider" style={{fontSize: 10}}>
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
                                {/* Put this back after we have a trigger to open the panel */}
                                {/* <Button
                                    onClick={this.toggleCollapse}
                                    type="text" 
                                    size="small"
                                    icon={<IconClose />}
                                /> */}
                            </div>
                        </div>

                        {/* Provider Selector */}
                        {/* <Tabs
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
                                }
                            ]}
                        /> */}

                        <Space direction="vertical" size="small" className="w-full mt-2">
                            <div 
                                id="fromGeocoder"
                                className='flex'
                                ref={this.attachGeocoderToDOM('from', 'fromGeocoder', 'fromGeocoderAttached')}
                            />

                            <div 
                                id="toGeocoder"
                                className='flex'
                                ref={this.attachGeocoderToDOM('to', 'toGeocoder', 'toGeocoderAttached')}
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

                        {directionsLoading && (
                            <div className="mt-3 p-2 text-gray-400 text-sm flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400 mr-2"></div>
                                Calculando rotas...
                            </div>
                        )}

                        {directionsError && (
                            <div className="mt-3 p-2 bg-red-600 bg-opacity-20 border border-red-500 rounded text-red-200 text-sm">
                                Erro: {directionsError}
                            </div>
                        )}

                        {directions && (
                            <div id="directionsPanel--results" className="mt-3">
                                <div className="space-y-1">
                                    {directions.routes && directions.routes.map((route, index) => {
                                        const { score: routeScore, cssClass: routeScoreClass } = getRouteScore(routeCoverageData, index);
                                        const coverageBreakdown = getCoverageBreakdown(routeCoverageData, index);
                                        const coverageBreakdownSimple = getCoverageBreakdownSimple(routeCoverageData, index);

                                        return (
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
                                                {/* Route alternative summary */}
                                                <div className="flex justify-between gap-1">
                                                    {/* 1st column */}
                                                    <div className="flex">
                                                        {/* <IconBike className="mt-1 mr-3" /> */}
                                                        <div className={`flex items-center mr-2 ${routeScoreClass} px-1 py-1 rounded-md text-sm leading-none font-mono text-center`} style={{color: 'white', width: 24, height: 24}}>
                                                            {routeScore}
                                                        </div>

                                                        <div className="flex flex-col flex-end">
                                                            <span className="directions--legLabel text-sm mb-1">
                                                                {
                                                                route.legs && route.legs.length > 0 ?
                                                                    route.legs[0].summary
                                                                : `Opção ${index + 1}`
                                                                }
                                                            </span>

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

                                                            {/* {this.props.selectedRouteIndex === index &&
                                                                coverageBreakdown : */}
                                                                {coverageBreakdownSimple}
                                                            {/* } */}
                                                        </div>
                                                    </div>

                                                    {/* 2nd column */}
                                                    <div className="flex flex-col flex-end flex-shrink-0">
                                                        <span className="text-sm text-right mb-1">
                                                            {formatDuration(route.duration)}
                                                        </span>
                                                        <span className="text-sm text-gray-400 text-right">
                                                            {formatDistance(route.distance)}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* {route.legs && route.legs[0] && (
                                                    <div className="text-xs text-gray-400 space-y-1">
                                                        {route.legs[0].steps && route.legs[0].steps.length > 0 && (
                                                            <div className="flex">
                                                                <span className="mr-2">🚴</span>
                                                                <span>{route.legs[0].steps.length} etapas</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )} */}
                                            </div>
                                        )
                                    })}
                                </div>
                                
                                {/* Disclaimer */}
                                <div className="p-2 text-gray-500 text-xs">
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
            routeCoverageData={directionsContext.routeCoverageData}
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
