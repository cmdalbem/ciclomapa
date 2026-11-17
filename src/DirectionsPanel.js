import React, { Component } from 'react';
import PropTypes from 'prop-types';
import debounce from 'lodash.debounce';
import { useDirections } from './contexts/DirectionsContext';
import { Button, Dropdown, Tooltip } from 'antd';
import {
  HiX as IconClose,
  HiOutlineArrowLeft as IconBack,
  HiChevronDown as IconCaretDown,
  HiInformationCircle as IconInfoCircle,
  HiOutlineInformationCircle as IconInfoOutline,
} from 'react-icons/hi';
import { HiOutlineArrowsUpDown as IconSwap } from 'react-icons/hi2';
import {
  LuBike,
  LuLeaf,
  LuMountain,
  LuShield,
  LuSlidersHorizontal,
  LuTimer,
  LuVolumeX,
} from 'react-icons/lu';
import { TbRoad, TbRuler } from 'react-icons/tb';
import { MdOutlineTerrain } from 'react-icons/md';
import mapboxgl from 'mapbox-gl';

import './DirectionsPanel.css';

import {
  IS_MOBILE,
  ENABLE_MAP_CLICK_TO_SET_POINTS,
  ENABLE_AUTO_AREA_CHANGE_ON_POINT,
  ENABLE_AUTOFILL_ORIGIN_ON_PANEL_OPEN,
} from './config/constants.js';
import DirectionsManager from './DirectionsManager.js';
import { flyMapTo } from './features/map/mapCamera.js';
import userLocationCache from './features/geolocation/userLocationCache.js';
import LocationSearchInput from './features/directions/components/LocationSearchInput.js';
import RoutesList from './features/directions/components/RoutesList.js';
import {
  ensureGooglePlacesReady,
  applyDirectionsInputLabelToResult,
  getAreaStringFromResultLike,
  getCityFromResultLike,
  getGooglePlacesGeocoder,
  getPlacesSearchUserMessage,
  getShortAddressFromResultLike,
  resetPlacesAutocompleteSession,
} from './googlePlacesClient.js';
import { filterFavoritesByQuery, filterFavoritesForArea } from './favoritesStore';
import {
  geocodePlacesSuggestionToResult,
  getDirectionsPanelPlacesSearchOptions,
  favoriteToDirectionsSuggestion,
  getDirectionsCurrentLocationSuggestion,
  PLACES_AUTOCOMPLETE_DEBOUNCE_MS,
  PLACES_AUTOCOMPLETE_MIN_QUERY_LENGTH,
  prefetchGooglePlaces,
  searchPlacesForAutocomplete,
} from './placesAutocomplete.js';
import {
  BROUTER_OBJECTIVE_OPTIONS,
  BROUTER_PROFILE_DEFAULTS,
  BROUTER_SURFACE_OPTIONS,
  brouterRoutingObjectiveFromSort,
} from './utils/routeUtils.js';

// How fresh a cached position must be to skip the navigator round trip.
const GEOLOC_CACHE_FRESH_MS = 120_000;

class DirectionsPanel extends Component {
  constructor(props) {
    super(props);
    this.state = {
      collapsed: true,
      fromGeocoderAttached: false,
      toGeocoderAttached: false,
      focusedInput: null,
      routeSortMode: 'score',
      consider_elevation: BROUTER_PROFILE_DEFAULTS.consider_elevation,
      unpavedPenalty: BROUTER_PROFILE_DEFAULTS.unpavedPenalty,
      consider_noise: BROUTER_PROFILE_DEFAULTS.consider_noise,
      consider_river: BROUTER_PROFILE_DEFAULTS.consider_river,
      consider_forest: BROUTER_PROFILE_DEFAULTS.consider_forest,
      showAdvancedRouteOptions: false,
      fromSuggestions: [],
      toSuggestions: [],
      fromSearchValue: '',
      toSearchValue: '',
      fromSearchLoading: false,
      toSearchLoading: false,
      cityValidationError: null,
      placesSearchError: null,
      geolocatingInput: null,
    };

    this.fromMarker = null;
    this.toMarker = null;
    this.blurTimeout = null;
    this.geocodersInitialized = false;
    this.isDraggingMarker = false;
    // Monotonic id; lets us discard a slow geolocation response if the user
    // typed in the origin field or selected something in the meantime.
    this.geolocationRequestId = 0;
    this.markerGeocodeSeq = { from: 0, to: 0 };
    this.placesSearchSeq = 0;
    // Same idea for in-flight route calc: cancel bumps this and aborts fetches.
    this.directionsRequestId = 0;
    this.directionsAbortController = null;

    this.runPlacesSearch = this.runPlacesSearch.bind(this);
    this.debouncedRunPlacesSearch = debounce(this.runPlacesSearch, PLACES_AUTOCOMPLETE_DEBOUNCE_MS);

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
    this.handleManualInputChange = this.handleManualInputChange.bind(this);
    this.calculateDirections = this.calculateDirections.bind(this);
    this.cancelDirectionsCalculation = this.cancelDirectionsCalculation.bind(this);
    this.swapOriginDestination = this.swapOriginDestination.bind(this);
    this.handleRouteSortChange = this.handleRouteSortChange.bind(this);
    this.handleBrouterPrefChange = this.handleBrouterPrefChange.bind(this);
    this.getBrouterProfile = this.getBrouterProfile.bind(this);
    this.getSortedRoutes = this.getSortedRoutes.bind(this);
    this.getInputDisplayValue = this.getInputDisplayValue.bind(this);
  }

  getInputDisplayValue(resultLike, { simplifyAddress = false } = {}) {
    if (!resultLike) return '';

    const normalized = applyDirectionsInputLabelToResult(resultLike, { area: this.props.area });
    const result = normalized?.result || normalized;

    if (simplifyAddress) {
      return getShortAddressFromResultLike(normalized) || result?.place_name || '';
    }

    return result?.place_name || '';
  }

  validateSameCity() {
    this.setState({ cityValidationError: null });
    return true;
  }

  componentDidMount() {
    this.setupMapClickListener();
    if (this.props.map) {
      this.syncMarkersWithProps();
    }

    // Initialize search input values if points are already set (e.g., from URL)
    if (
      this.props.fromPoint &&
      this.props.fromPoint.result &&
      this.props.fromPoint.result.place_name
    ) {
      this.setState({ fromSearchValue: this.getInputDisplayValue(this.props.fromPoint) });
    }
    if (this.props.toPoint && this.props.toPoint.result && this.props.toPoint.result.place_name) {
      this.setState({ toSearchValue: this.getInputDisplayValue(this.props.toPoint) });
    }

    // Auto-expand the panel when route points are loaded from URL
    if (this.props.fromPoint && this.props.toPoint) {
      this.setState({ collapsed: false });
      if (this.props.onDirectionsPanelToggle) {
        this.props.onDirectionsPanelToggle(true);
      }
      // Points can already be set on first paint (URL boot). componentDidUpdate
      // only fires on *changes*, so kick the calc here or it sits idle.
      this.requestDirectionsCalculation();
    }
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.map && !prevProps.map) {
      console.debug('Map became available, setting up map click listener');
      this.setupMapClickListener();
      this.syncMarkersWithProps();
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
    const pointsChanged =
      this.props.fromPoint !== prevProps.fromPoint || this.props.toPoint !== prevProps.toPoint;
    if (pointsChanged && this.props.map) {
      console.debug('From or to point changed, syncing markers');

      // Reset dragging flag if it was set
      if (this.isDraggingMarker) {
        this.isDraggingMarker = false;
      }

      this.syncMarkersWithProps();
    }

    const favoritesContextChanged =
      this.props.favorites !== prevProps.favorites || this.props.area !== prevProps.area;
    if (favoritesContextChanged && this.state.focusedInput) {
      const focusedInput = this.state.focusedInput;
      const currentValue = this.state[`${focusedInput}SearchValue`] || '';
      if (currentValue.trim().length < PLACES_AUTOCOMPLETE_MIN_QUERY_LENGTH) {
        this.setFavoriteSuggestions(focusedInput, currentValue);
      }
    }

    const shouldCalculateDirections =
      this.props.fromPoint &&
      this.props.toPoint &&
      (pointsChanged || (Boolean(this.props.map) && !prevProps.map));

    if (shouldCalculateDirections) {
      console.debug('Conditions met for directions calculation');
      this.requestDirectionsCalculation();
    } else if (pointsChanged && (!this.props.fromPoint || !this.props.toPoint)) {
      this.clearDirectionsOnly();
    }

    if (
      this.props.directions !== prevProps.directions ||
      this.props.maxRoutesShown !== prevProps.maxRoutesShown ||
      this.state.routeSortMode !== prevState.routeSortMode
    ) {
      this.syncVisibleRouteIndices();
    }
  }

  componentWillUnmount() {
    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }
    if (this.debouncedRunPlacesSearch) {
      this.debouncedRunPlacesSearch.cancel();
    }
    this.cancelDirectionsCalculation();
    this.cleanup();
    this.removeMapClickListener();
  }

  syncMarkersWithProps() {
    if (!this.props.map) return;

    const { fromPoint, toPoint } = this.props;
    if (fromPoint?.result?.center) {
      const fromCoords = fromPoint.result.center;
      if (this.fromMarker) {
        this.fromMarker.setLngLat(fromCoords).addTo(this.props.map);
      } else {
        this.addMarker('from', fromCoords);
      }

      // Update search input value if place_name exists
      if (fromPoint.result.place_name) {
        this.setState({ fromSearchValue: this.getInputDisplayValue(fromPoint) });
      }
    } else {
      this.removeMarker('from');
      this.setState({ fromSearchValue: '' });
    }

    if (toPoint?.result?.center) {
      const toCoords = toPoint.result.center;
      if (this.toMarker) {
        this.toMarker.setLngLat(toCoords).addTo(this.props.map);
      } else {
        this.addMarker('to', toCoords);
      }

      // Update search input value if place_name exists
      if (toPoint.result.place_name) {
        this.setState({ toSearchValue: this.getInputDisplayValue(toPoint) });
      }
    } else {
      this.removeMarker('to');
      this.setState({ toSearchValue: '' });
    }
  }

  handleSearch(value, inputType) {
    const trimmed = (value ?? '').trim();
    if (!trimmed || trimmed.length < PLACES_AUTOCOMPLETE_MIN_QUERY_LENGTH) {
      this.debouncedRunPlacesSearch.cancel();
      this.placesSearchSeq += 1;
      resetPlacesAutocompleteSession();
      this.setFavoriteSuggestions(inputType, trimmed);
      this.setState({ placesSearchError: null });
      return;
    }

    this.debouncedRunPlacesSearch(value, inputType);
  }

  async runPlacesSearch(value, inputType) {
    this.placesSearchSeq += 1;
    const seq = this.placesSearchSeq;

    this.setState({
      [`${inputType}Suggestions`]: [],
      [`${inputType}SearchLoading`]: true,
      placesSearchError: null,
    });

    try {
      const results = await searchPlacesForAutocomplete(
        value,
        getDirectionsPanelPlacesSearchOptions(this.props.map)
      );

      if (seq !== this.placesSearchSeq) return;

      this.setState({
        [`${inputType}Suggestions`]: results,
        [`${inputType}SearchLoading`]: false,
        placesSearchError: null,
      });
    } catch (error) {
      if (seq !== this.placesSearchSeq) return;

      console.error(`${inputType} search error:`, error);
      this.setState({
        [`${inputType}Suggestions`]: [],
        [`${inputType}SearchLoading`]: false,
        placesSearchError: getPlacesSearchUserMessage(error),
      });
    }
  }

  setFavoriteSuggestions(inputType, query = '') {
    const areaFavorites = filterFavoritesForArea(this.props.favorites || [], this.props.area);
    const filtered = filterFavoritesByQuery(areaFavorites, query);
    const suggestions = filtered.map((favorite) =>
      favoriteToDirectionsSuggestion(favorite, { area: this.props.area })
    );

    if (
      typeof navigator !== 'undefined' &&
      navigator.geolocation &&
      this.state.geolocatingInput !== inputType
    ) {
      suggestions.unshift(getDirectionsCurrentLocationSuggestion(inputType));
    }

    this.setState({
      [`${inputType}Suggestions`]: suggestions,
      [`${inputType}SearchLoading`]: false,
    });
  }

  async handleSelect(result, inputType) {
    console.debug(`${inputType} point selected:`, result);

    if (result?.isCurrentLocation) {
      resetPlacesAutocompleteSession();
      this.setState({ [`${inputType}Suggestions`]: [] });
      this.handleGeolocation(inputType);
      return;
    }

    if (this.state.geolocatingInput === inputType) {
      this.cancelActiveGeolocation();
    }

    if (result?.isFavorite && result.center) {
      resetPlacesAutocompleteSession();
      const committed = applyDirectionsInputLabelToResult(result, {
        area: this.props.area,
      });

      if (!this.validateSameCity(inputType, committed)) {
        return;
      }

      this.handleGeocoderResult({ result: committed }, inputType, true);

      this.setState({
        [`${inputType}Suggestions`]: [],
        [`${inputType}SearchValue`]: committed.place_name,
      });

      if (inputType === 'from' && !this.props.toPoint) {
        setTimeout(() => {
          this.setState({ focusedInput: 'to' });
          console.debug('Auto-focused destination input after origin selection');
        }, 500);
      }
      return;
    }

    try {
      const { result: resolved } = await geocodePlacesSuggestionToResult(result, {
        area: this.props.area,
      });

      if (!this.validateSameCity(inputType, resolved)) {
        return;
      }
      this.handleGeocoderResult({ result: resolved }, inputType, true);

      this.setState({
        [`${inputType}Suggestions`]: [],
        [`${inputType}SearchValue`]: this.getInputDisplayValue(resolved),
      });

      // Auto-focus to destination input if origin is selected and no destination is set
      if (inputType === 'from' && !this.props.toPoint) {
        setTimeout(() => {
          this.setState({ focusedInput: 'to' });
          console.debug('Auto-focused destination input after origin selection');
        }, 500);
      }
    } catch (error) {
      console.warn('Error getting place details:', error);
      this.setState({
        placesSearchError: getPlacesSearchUserMessage(error),
      });
    }
  }

  handleClearInput(inputType) {
    console.debug(`Clearing ${inputType} input`);

    if (this.state.geolocatingInput === inputType) {
      this.cancelActiveGeolocation();
    }
    this.markerGeocodeSeq[inputType] += 1;

    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }

    this.debouncedRunPlacesSearch.cancel();
    this.placesSearchSeq += 1;
    resetPlacesAutocompleteSession();

    this.setState({
      [`${inputType}SearchValue`]: '',
      cityValidationError: null,
      focusedInput: inputType,
    });

    // Clear the corresponding point
    if (inputType === 'from') {
      this.props.onFromPointChange(null);
      this.removeMarker('from');
    } else {
      this.props.onToPointChange(null);
      this.removeMarker('to');
    }

    this.setFavoriteSuggestions(inputType, '');
  }

  handleGeolocation(inputType, isAutoTriggered = false) {
    this.fillInputFromGeolocation(inputType, { isAutoTriggered });
  }

  handleGeocoderResult(result, type, fromAutocomplete = false) {
    if (type === 'from') {
      this.props.onFromPointChange(result);

      if (fromAutocomplete && this.props.map) {
        flyMapTo(this.props.map, {
          center: result.result.center,
          zoom: Math.max(this.props.map.getZoom(), 16),
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

    this.maybeAutoSwitchAreaForPoint(type, result);
  }

  /**
   * When a from/to point lands in a city different from the currently loaded
   * area, switch the app area to that city. Without this, the route is
   * calculated against the wrong city's cyclepath data and shows 0% coverage.
   *
   * Assumes `validateSameCity` has already passed, so if the other point
   * exists we know both points share the same city.
   */
  maybeAutoSwitchAreaForPoint(type, newPointLike) {
    if (!ENABLE_AUTO_AREA_CHANGE_ON_POINT) return;
    if (typeof this.props.onAreaChange !== 'function') return;
    if (!this.props.area) return;

    const resultLike = newPointLike && (newPointLike.result || newPointLike);
    const newCity = getCityFromResultLike(resultLike);
    if (!newCity) return;

    const appCity = this.props.area.split(',')[0].trim();
    if (appCity === newCity) return;

    const areaStr = getAreaStringFromResultLike(resultLike);
    if (!areaStr || areaStr === this.props.area) return;

    console.debug(
      `Auto-switching area from "${this.props.area}" to "${areaStr}" to match ${type} point`
    );
    this.props.onAreaChange(areaStr, { keepRoutePoints: true });
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
      draggable: true,
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
      collapsed: newCollapsedState,
    });

    // Notify parent component about panel state change
    if (this.props.onDirectionsPanelToggle) {
      this.props.onDirectionsPanelToggle(!newCollapsedState);
    }

    // When opening the panel, auto-fill the origin with the user's location.
    // Gated by a constant so we can keep mobile-only behavior easily.
    if (ENABLE_AUTOFILL_ORIGIN_ON_PANEL_OPEN && newCollapsedState === false) {
      this.autoTriggerGeolocation();
    }
  }

  autoTriggerGeolocation() {
    if (this.props.fromPoint) return;
    this.fillInputFromGeolocation('from', { isAutoTriggered: true });
  }

  /**
   * Increments the active request id, invalidating any in-flight response so
   * it can't overwrite the input. Call this whenever the user touches the
   * field that is being filled by geolocation (typing, clearing, selecting).
   */
  cancelActiveGeolocation() {
    this.geolocationRequestId += 1;
    if (this.state.geolocatingInput) {
      this.setState({ geolocatingInput: null });
    }
  }

  isStaleGeolocationRequest(requestId) {
    return this.geolocationRequestId !== requestId;
  }

  handleManualInputChange(inputType, value) {
    if (this.state.geolocatingInput === inputType) {
      this.cancelActiveGeolocation();
    }
    this.setState({ [`${inputType}SearchValue`]: value });
  }

  /**
   * Unified entry point for filling origin or destination from the device GPS.
   * Used by the autocomplete row and panel-open auto-trigger.
   *
   * The input stays empty with a spinner until reverse geocode resolves; only
   * then do we commit the point.
   */
  async fillInputFromGeolocation(inputType, { isAutoTriggered = false } = {}) {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser');
      return;
    }

    this.geolocationRequestId += 1;
    const requestId = this.geolocationRequestId;

    this.setState({
      [`${inputType}SearchValue`]: '',
      geolocatingInput: inputType,
    });

    let coords = null;
    const cached = userLocationCache.get(GEOLOC_CACHE_FRESH_MS);
    if (cached) {
      console.debug('Using cached user location:', cached.source, cached.coords);
      coords = cached.coords;
    } else {
      let cacheEntry = await userLocationCache.requestUpdate({ highAccuracy: false });
      if (this.isStaleGeolocationRequest(requestId)) return;

      if (!cacheEntry) {
        // Low accuracy failed (often a Permissions issue). Try high accuracy.
        cacheEntry = await userLocationCache.requestUpdate({ highAccuracy: true });
        if (this.isStaleGeolocationRequest(requestId)) return;
      }

      if (!cacheEntry) {
        this.setState({ geolocatingInput: null });
        return;
      }

      coords = cacheEntry.coords;
    }

    this.reverseGeocode(coords, inputType, isAutoTriggered, requestId, { simplifyAddress: true });
  }

  cancelDirectionsCalculation({ keepLoading = false } = {}) {
    this.directionsRequestId += 1;
    this._inflightRequestKey = null;
    if (this.directionsAbortController) {
      this.directionsAbortController.abort();
      this.directionsAbortController = null;
    }
    if (!keepLoading && this.props.setLoading) {
      this.props.setLoading(false);
    }
  }

  directionsRequestKey(fromCoords, toCoords) {
    const profile = this.getBrouterProfile();
    return [
      fromCoords[0],
      fromCoords[1],
      toCoords[0],
      toCoords[1],
      profile.consider_elevation,
      profile.unpavedPenalty,
      profile.consider_noise,
      profile.consider_river,
      profile.consider_forest,
      profile.routingObjective,
    ].join('|');
  }

  async calculateDirections(fromCoords, toCoords) {
    this._inflightRequestKey = this.directionsRequestKey(fromCoords, toCoords);
    // Drop any previous in-flight calc before starting a new one.
    if (this.directionsAbortController) {
      this.directionsAbortController.abort();
    }

    const requestId = (this.directionsRequestId += 1);
    const controller = new AbortController();
    this.directionsAbortController = controller;

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
        'brouter',
        this.props.geoJson,
        this.props.layers,
        this.props.isDarkMode,
        { signal: controller.signal, brouterProfile: this.getBrouterProfile() }
      );

      if (requestId !== this.directionsRequestId) {
        return;
      }

      this.props.setDirectionsData(result);
    } catch (error) {
      if (requestId !== this.directionsRequestId || error?.name === 'AbortError') {
        return;
      }
      if (this.props.setError) {
        this.props.setError(error.message);
      }
      if (this.props.setLoading) {
        this.props.setLoading(false);
      }
      console.error('Directions error:', error);
    } finally {
      if (this.directionsAbortController === controller) {
        this.directionsAbortController = null;
      }
    }
  }

  requestDirectionsCalculation() {
    if (this.props.fromPoint && this.props.toPoint) {
      const fromCoords = this.props.fromPoint.result.center;
      const toCoords = this.props.toPoint.result.center;

      const requestKey = this.directionsRequestKey(fromCoords, toCoords);
      if (
        requestKey === this._inflightRequestKey &&
        (this.props.directionsLoading || this.props.directions)
      ) {
        return;
      }

      console.debug('Requesting directions calculation from:', fromCoords, 'to:', toCoords);
      this.calculateDirections(fromCoords, toCoords);
    } else {
      console.debug('No from or to point, skipping directions calculation');
    }
  }

  clearDirections() {
    this.cancelDirectionsCalculation();
    this.props.onClearRoutePoints();

    this.cleanup();

    // Reattach map click listener after cleanup
    if (this.props.map) {
      this.setupMapClickListener();
    }

    this.setState({ cityValidationError: null });

    if (this.props.onDirectionsCleared) {
      this.props.onDirectionsCleared();
    }
  }

  clearDirectionsOnly() {
    this.cancelDirectionsCalculation();
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
      fromSearchValue: this.getInputDisplayValue(toPoint),
      toSearchValue: this.getInputDisplayValue(fromPoint),
    });
  }

  getBrouterProfile() {
    return {
      consider_elevation: this.state.consider_elevation,
      unpavedPenalty: this.state.unpavedPenalty,
      consider_noise: this.state.consider_noise,
      consider_river: this.state.consider_river,
      consider_forest: this.state.consider_forest,
      routingObjective: brouterRoutingObjectiveFromSort(this.state.routeSortMode),
    };
  }

  handleBrouterPrefChange(patch) {
    this.setState(patch, () => {
      if (this.props.fromPoint && this.props.toPoint) {
        const fromCoords = this.props.fromPoint.result.center;
        const toCoords = this.props.toPoint.result.center;
        this.calculateDirections(fromCoords, toCoords);
      }
    });
  }

  handleRouteSortChange(sortMode) {
    this.handleBrouterPrefChange({ routeSortMode: sortMode });
  }

  getSortedRoutes(routes, mode = this.state.routeSortMode) {
    if (!routes || routes.length === 0) return [];

    const sortedRoutes = [...routes];

    switch (mode) {
      case 'score':
        sortedRoutes.sort((a, b) => {
          const scoreA = a.score !== null && a.score !== undefined ? a.score : -1;
          const scoreB = b.score !== null && b.score !== undefined ? b.score : -1;
          if (scoreB !== scoreA) return scoreB - scoreA;
          return (b.coverage || 0) - (a.coverage || 0);
        });
        break;
      case 'fastest':
        sortedRoutes.sort((a, b) => (a.duration || Infinity) - (b.duration || Infinity));
        break;
      case 'shortest':
        sortedRoutes.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
        break;
      default:
        break;
    }

    return sortedRoutes;
  }

  renderBrouterPrefs() {
    const allowHills = !this.state.consider_elevation;
    const showAdvanced = this.state.showAdvancedRouteOptions;
    const surface =
      BROUTER_SURFACE_OPTIONS.find((o) => o.value === this.state.unpavedPenalty) ||
      BROUTER_SURFACE_OPTIONS.find((o) => o.value === BROUTER_PROFILE_DEFAULTS.unpavedPenalty);
    const SurfaceIcon = surface.value >= 2 ? TbRoad : MdOutlineTerrain;
    const objective =
      BROUTER_OBJECTIVE_OPTIONS.find((o) => o.key === this.state.routeSortMode) ||
      BROUTER_OBJECTIVE_OPTIONS[0];
    const ObjectiveIcon =
      objective.key === 'fastest' ? LuTimer : objective.key === 'shortest' ? TbRuler : LuShield;
    const hiddenActiveCount = [
      this.state.unpavedPenalty !== BROUTER_PROFILE_DEFAULTS.unpavedPenalty,
      this.state.consider_elevation !== BROUTER_PROFILE_DEFAULTS.consider_elevation,
      Boolean(this.state.consider_noise),
      Boolean(this.state.consider_river || this.state.consider_forest),
    ].filter(Boolean).length;

    const toggleChip = (pref) => {
      const Icon = pref.icon;
      return (
        <button
          key={pref.key}
          type="button"
          className={`cm-brouter-pref${pref.on ? ' cm-brouter-pref--on' : ''}`}
          aria-pressed={pref.on}
          aria-label={pref.title}
          onClick={pref.onClick}
        >
          <Icon className="cm-brouter-pref__icon" aria-hidden />
          <span className="cm-brouter-pref__text">{pref.label}</span>
        </button>
      );
    };

    const dropdownChip = ({ key, label, title, icon: Icon, menu }) => (
      <Dropdown key={key} trigger={['click']} placement="bottomLeft" menu={menu}>
        <button
          type="button"
          className="cm-brouter-pref cm-brouter-pref--dropdown"
          aria-haspopup="listbox"
          aria-label={title}
        >
          <Icon className="cm-brouter-pref__icon" aria-hidden />
          <span className="cm-brouter-pref__text">
            {label}
            <IconCaretDown className="cm-brouter-pref__caret" aria-hidden />
          </span>
        </button>
      </Dropdown>
    );

    const objectiveChip = dropdownChip({
      key: 'objective',
      label: objective.label,
      title: 'Priorizar na rota',
      icon: ObjectiveIcon,
      menu: {
        items: BROUTER_OBJECTIVE_OPTIONS.map((o) => ({
          key: o.key,
          label: o.label,
        })),
        selectedKeys: [objective.key],
        onClick: ({ key }) => this.handleRouteSortChange(key),
      },
    });

    return (
      <div className={`cm-brouter-prefs${showAdvanced ? ' cm-brouter-prefs--advanced' : ''}`}>
        <div className="cm-brouter-prefs__dropdowns">
          {objectiveChip}
          {showAdvanced ? (
            dropdownChip({
              key: 'surface',
              label: surface.shortLabel,
              title: surface.label,
              icon: SurfaceIcon,
              menu: {
                items: BROUTER_SURFACE_OPTIONS.map((o) => ({
                  key: String(o.value),
                  label: o.label,
                })),
                selectedKeys: [String(surface.value)],
                onClick: ({ key }) => this.handleBrouterPrefChange({ unpavedPenalty: Number(key) }),
              },
            })
          ) : (
            <button
              type="button"
              className="cm-brouter-pref cm-brouter-pref--dropdown cm-brouter-pref--more"
              aria-expanded={false}
              aria-label={
                hiddenActiveCount === 0
                  ? 'Ajustes da rota'
                  : hiddenActiveCount === 1
                    ? 'Ajustes da rota, 1 ativo'
                    : `Ajustes da rota, ${hiddenActiveCount} ativos`
              }
              onClick={() => this.setState({ showAdvancedRouteOptions: true })}
            >
              <LuSlidersHorizontal className="cm-brouter-pref__icon" aria-hidden />
              <span className="cm-brouter-pref__text">Ajustes</span>
              {hiddenActiveCount > 0 && (
                <span className="cm-brouter-pref__count">{hiddenActiveCount}</span>
              )}
            </button>
          )}
        </div>
        {showAdvanced && (
          <div className="cm-brouter-prefs__toggles">
            {toggleChip({
              key: 'elev',
              label: 'Permitir subidas',
              title: 'Permitir subidas',
              icon: LuMountain,
              on: allowHills,
              onClick: () => this.handleBrouterPrefChange({ consider_elevation: allowHills }),
            })}
            {toggleChip({
              key: 'noise',
              label: 'Evitar ruído',
              title: 'Evitar ruído',
              icon: LuVolumeX,
              on: Boolean(this.state.consider_noise),
              onClick: () =>
                this.handleBrouterPrefChange({ consider_noise: !this.state.consider_noise }),
            })}
            {toggleChip({
              key: 'nature',
              label: 'Natureza',
              title: 'Preferir rios e parques',
              icon: LuLeaf,
              on: Boolean(this.state.consider_river || this.state.consider_forest),
              onClick: () => {
                const next = !(this.state.consider_river || this.state.consider_forest);
                this.handleBrouterPrefChange({ consider_river: next, consider_forest: next });
              },
            })}
            <button
              type="button"
              className="cm-brouter-pref cm-brouter-pref--collapse"
              aria-expanded="true"
              aria-label="Ocultar ajustes"
              onClick={() => this.setState({ showAdvancedRouteOptions: false })}
            >
              <IconCaretDown className="cm-brouter-pref__caret" aria-hidden />
            </button>
          </div>
        )}
      </div>
    );
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
    const lngLat = [coordinates.lng, coordinates.lat];
    console.debug(`${type} marker dragged to:`, coordinates);

    const prev = type === 'from' ? this.props.fromPoint : this.props.toPoint;
    const newPoint = {
      result: applyDirectionsInputLabelToResult(
        {
          ...(prev?.result || {}),
          center: lngLat,
        },
        { area: this.props.area }
      ),
    };

    if (type === 'from') {
      this.props.onFromPointChange(newPoint);
    } else {
      this.props.onToPointChange(newPoint);
    }

    this.markerGeocodeSeq[type] += 1;
    const seq = this.markerGeocodeSeq[type];
    this.reverseGeocode(coordinates, type, false, null, {
      keepDroppedCenter: true,
      isStale: () => this.markerGeocodeSeq[type] !== seq,
    });
  }

  async reverseGeocode(
    coordinates,
    type,
    isAutoTriggered = false,
    requestId = null,
    { simplifyAddress = false, keepDroppedCenter = false, isStale } = {}
  ) {
    if (!coordinates) return;

    const lngLat = [coordinates.lng, coordinates.lat];
    console.debug(`Reverse geocoding for ${type} point:`, lngLat);

    const isCancelled = () =>
      (typeof isStale === 'function' && isStale()) ||
      (requestId !== null && this.isStaleGeolocationRequest(requestId));

    try {
      await ensureGooglePlacesReady();
      if (isCancelled()) return;

      const result = await getGooglePlacesGeocoder().reverseGeocode(lngLat, {
        language: 'pt-BR',
      });
      if (isCancelled()) return;

      console.debug('Reverse geocode result:', result);

      // When auto-triggered input fill lands in a different city than the current user's
      if (isAutoTriggered && type === 'from' && this.props.area) {
        const appCity = this.props.area.split(',')[0].trim();
        const geolocationCity = getCityFromResultLike(result);

        if (geolocationCity && appCity && geolocationCity !== appCity) {
          console.debug(
            `Geolocation in ${geolocationCity} but app is showing ${appCity}; not autofilling.`
          );
          this.setState({
            fromSearchValue: '',
            geolocatingInput: null,
          });
          return;
        }
      }

      const address =
        this.getInputDisplayValue(result, { simplifyAddress }) ||
        result.place_name ||
        'Nova posição';

      const newPoint = {
        result: applyDirectionsInputLabelToResult(
          {
            ...result,
            center: keepDroppedCenter ? lngLat : result.center || lngLat,
            place_name: address,
          },
          { area: this.props.area }
        ),
      };

      this.setState((prevState) => ({
        [`${type}SearchValue`]: address,
        geolocatingInput: prevState.geolocatingInput === type ? null : prevState.geolocatingInput,
      }));

      if (type === 'from') {
        if (!this.validateSameCity('from', newPoint.result)) {
          return;
        }
        this.props.onFromPointChange(newPoint);

        if (!this.props.toPoint) {
          setTimeout(() => {
            this.setState({ focusedInput: 'to' });
            console.debug('Auto-focused destination input after origin was set');
          }, 500);
        }
      } else {
        if (!this.validateSameCity('to', newPoint.result)) {
          return;
        }
        this.props.onToPointChange(newPoint);
      }

      this.maybeAutoSwitchAreaForPoint(type, newPoint);
    } catch (error) {
      if (isCancelled()) return;
      console.error('Reverse geocoding error:', error);
      this.setState((prevState) => ({
        [`${type}SearchValue`]: 'Nova posição',
        geolocatingInput: prevState.geolocatingInput === type ? null : prevState.geolocatingInput,
      }));
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
      console.debug('Map clicked, focusedInput:', this.state.focusedInput);
      this.handleMapClick(e);
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

    if (this.blurTimeout) {
      clearTimeout(this.blurTimeout);
      this.blurTimeout = null;
    }

    const prevFocused = this.state.focusedInput;
    if (prevFocused && prevFocused !== inputType) {
      this.debouncedRunPlacesSearch.cancel();
      this.placesSearchSeq += 1;
      resetPlacesAutocompleteSession();
    }

    this.setState({ focusedInput: inputType });
    prefetchGooglePlaces();

    const currentValue = this.state[`${inputType}SearchValue`] || '';
    if (currentValue.trim().length < PLACES_AUTOCOMPLETE_MIN_QUERY_LENGTH) {
      this.setFavoriteSuggestions(inputType, currentValue);
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
      // Also check if the blur was caused by clicking on a suggestion
      this.blurTimeout = setTimeout(() => {
        // User may have focused the other origin/destination field in the meantime
        if (this.state.focusedInput !== inputType) {
          this.blurTimeout = null;
          return;
        }

        const activeElement = document.activeElement;
        const isDropdownActive =
          activeElement &&
          (activeElement.closest('.ant-select-dropdown') ||
            activeElement.closest('.ant-select-item'));
        const isRoutePointsInputFocused =
          activeElement?.tagName === 'INPUT' &&
          Boolean(activeElement.closest('.cm-route-points__inputs'));

        if (!isDropdownActive && !isRoutePointsInputFocused) {
          this.setState({ focusedInput: null });
          console.debug('Focus cleared, resetting cursor');

          // Notify parent that user is no longer setting route points
          if (this.props.onRouteModeChange) {
            this.props.onRouteModeChange(false);
          }
        } else {
          console.debug('Blur ignored - dropdown or route input is active');
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

    const focusedInput = this.state.focusedInput;

    this.reverseGeocode(e.lngLat, focusedInput);

    // Focus is handled by reverseGeocode when setting the origin
    // Only clear focus if we set the destination
    if (focusedInput === 'to') {
      this.setState({ focusedInput: null });
    }
  }

  getDisplayedRoutes() {
    const originalRoutes = this.props.directions?.routes || [];
    const sortedRoutes = this.getSortedRoutes(originalRoutes).map((route, sortedIndex) => {
      const originalIndex = originalRoutes.findIndex((r) => r === route);
      return {
        ...route,
        _sortedIndex: sortedIndex,
        _originalIndex: originalIndex !== -1 ? originalIndex : sortedIndex,
      };
    });
    const max = this.props.maxRoutesShown;
    return max > 0 ? sortedRoutes.slice(0, max) : sortedRoutes;
  }

  syncVisibleRouteIndices() {
    if (!this.props.setVisibleRouteIndices) return;
    const displayed = this.getDisplayedRoutes();
    const indices = displayed.map((r) => r._originalIndex);
    const prev = this.props.visibleRouteIndices;
    if (prev && prev.length === indices.length && prev.every((v, i) => v === indices[i])) {
      return;
    }
    this.props.setVisibleRouteIndices(indices);

    const selected = this.props.selectedRouteIndex;
    if (selected != null && indices.length > 0 && !indices.includes(selected)) {
      this.selectRoute(indices[0]);
    }
  }

  render() {
    const { directions, directionsLoading, directionsError } = this.props;
    const routes = this.getDisplayedRoutes();
    const showResultsOnMobile = IS_MOBILE && (directions || directionsLoading);
    const panelOpenClass = !this.state.collapsed
      ? `directions-panel-open ${
          showResultsOnMobile ? 'directions-panel-open--results' : 'directions-panel-open--planning'
        }`
      : '';

    return (
      <>
        {IS_MOBILE && this.state.collapsed && (
          <div
            id="directionsPanelMobileButton"
            className={`directions-panel-button ${this.state.collapsed ? 'collapsed' : 'expanded'}`}
            onClick={this.toggleCollapse}
          >
            <LuBike />
          </div>
        )}
        <div
          id="directionsPanel"
          className={`cm-panel glass-bg fixed text-white cursor-pointer ${panelOpenClass}`}
        >
          <div className="cm-panel__body p-4">
            <div
              id="directionsPanel--header"
              className="cm-panel__header flex justify-between items-start"
            >
              {showResultsOnMobile ? (
                <div className="flex w-full items-center justify-between gap-2">
                  <div className="flex items-center">
                    <Button
                      onClick={this.clearDirectionsOnly}
                      type="text"
                      size="small"
                      className="text-white flex items-center flex-shrink-0 -ml-2"
                      icon={<IconBack className="inline-block" />}
                      aria-label="Voltar para origem e destino"
                    />
                  </div>
                  <Button
                    onClick={this.toggleCollapse}
                    type="text"
                    shape="circle"
                    icon={<IconClose />}
                    aria-label="Fechar painel de rotas"
                    className="flex-shrink-0 -mr-1"
                  />
                </div>
              ) : (
                // Default header
                <>
                  <h3 className="font-semibold flex items-center gap-2 mb-0">
                    {!IS_MOBILE && (
                      <LuBike className="text-lg flex-shrink-0 opacity-90" aria-hidden />
                    )}
                    Planejar rota
                  </h3>

                  <div
                    className="flex items-center -mr-1 flex-shrink-0"
                    style={{ marginTop: '-5px' }}
                  >
                    <div className="flex items-center opacity-50">
                      {this.props.openLayersLegendModal && (
                        <Button
                          type="text"
                          shape="circle"
                          data-testid="directions-panel-legend-link"
                          icon={<IconInfoCircle />}
                          aria-label="Como interpretar o mapa e as rotas"
                          onClick={() => this.props.openLayersLegendModal('routes-section')}
                        />
                      )}

                      <Button
                        onClick={this.toggleCollapse}
                        type="text"
                        shape="circle"
                        icon={<IconClose />}
                        aria-label="Fechar painel de rotas"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
            {!showResultsOnMobile && (
              <div className="cm-panel__controls">
                <div className="directions-route-options">{this.renderBrouterPrefs()}</div>
                <div className="cm-route-points">
                  <div className="cm-route-points__inputs">
                    <LocationSearchInput
                      inputType="from"
                      parentComponent={this}
                      className="w-full cm-route-points__input cm-route-points__input--from"
                    />
                    <LocationSearchInput
                      inputType="to"
                      parentComponent={this}
                      className="w-full cm-route-points__input cm-route-points__input--to"
                    />
                  </div>
                  <Tooltip title="Trocar origem e destino" mouseEnterDelay={0.3}>
                    <Button
                      type="text"
                      shape="circle"
                      disabled={!this.props.fromPoint || !this.props.toPoint}
                      icon={
                        <IconSwap
                          style={{
                            display: 'inline-block',
                          }}
                        />
                      }
                      onClick={this.swapOriginDestination}
                      className="swap-button cm-route-points__swap"
                      aria-label="Trocar origem e destino"
                    />
                  </Tooltip>
                </div>
              </div>
            )}

            {!showResultsOnMobile && this.state.placesSearchError && (
              <div
                role="status"
                className={`mt-2 rounded-lg border px-3 py-2 text-sm ${
                  this.props.isDarkMode
                    ? 'border-amber-400/50 bg-amber-500/20 text-amber-100'
                    : 'border-amber-700/25 bg-amber-100 text-amber-950'
                }`}
              >
                {this.state.placesSearchError}
              </div>
            )}

            {directionsLoading && (
              <div
                id="directionsPanel--results"
                className="cm-panel__results directionsPanel--results md:space-y-2 space-y-2"
              >
                {IS_MOBILE ? <span className="text-sm opacity-70">Calculando rotas…</span> : null}
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="cm-route-option flex justify-between gap-1">
                    <div className="flex items-start min-w-0 flex-1">
                      <div
                        className="w-8 h-8 md:w-9 md:h-9 rounded-md bg-white bg-opacity-10 animate-pulse-2x flex-shrink-0 mr-2"
                        aria-hidden
                      />
                      <div className="flex flex-col gap-2 min-w-0 flex-1 pt-0.5">
                        <div className="h-3 md:h-3.5 w-24 rounded bg-white bg-opacity-10 animate-pulse-2x" />
                        <div className="flex flex-wrap gap-1">
                          <div className="h-2.5 w-12 rounded bg-white bg-opacity-5 animate-pulse-2x" />
                          {/* <div className="h-2.5 w-12 rounded bg-white bg-opacity-5 animate-pulse-2x" /> */}
                          {/* <div className="h-2.5 w-7 rounded bg-white bg-opacity-5 animate-pulse-2x" /> */}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-0.5">
                      <div className="h-3 md:h-3.5 w-11 rounded bg-white bg-opacity-10 animate-pulse-2x mb-0.5" />
                      <div className="h-3 w-14 rounded bg-white bg-opacity-5 animate-pulse-2x" />
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  className="cm-panel__footer-action"
                  onClick={this.cancelDirectionsCalculation}
                  aria-label="Cancelar cálculo de rota"
                >
                  Cancelar
                </button>
              </div>
            )}
            {(directionsError || this.state.cityValidationError) && (
              <div
                role="alert"
                className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
                  this.props.isDarkMode
                    ? 'border-red-400/50 bg-red-500/20 text-red-100'
                    : 'border-red-700/25 bg-red-100 text-red-950'
                }`}
              >
                {directionsError && <div>Erro: {directionsError}</div>}
                {this.state.cityValidationError && <div>{this.state.cityValidationError}</div>}
              </div>
            )}
            {directions && !directionsLoading && (
              <div id="directionsPanel--results" className="cm-panel__results">
                <RoutesList
                  routes={routes}
                  selectedRouteIndex={this.props.selectedRouteIndex}
                  hoveredRouteIndex={this.props.hoveredRouteIndex}
                  onRouteHover={(routeIndex) => this.handleRouteHover(routeIndex)}
                  onRouteLeave={() => this.handleRouteLeave()}
                  onRouteClick={(routeIndex) => this.handleRouteClick(routeIndex)}
                />

                {!IS_MOBILE && (
                  <button
                    type="button"
                    className="cm-panel__footer-action"
                    onClick={() =>
                      this.props.openLayersLegendModal &&
                      this.props.openLayersLegendModal('routes-section')
                    }
                  >
                    <IconInfoOutline className="cm-panel__footer-action-icon" aria-hidden />
                    Leia mais sobre os níveis de proteção das rotas
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }
}

DirectionsPanel.propTypes = {
  openLayersLegendModal: PropTypes.func,
};

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
      maxRoutesShown={directionsContext.maxRoutesShown}
      visibleRouteIndices={directionsContext.visibleRouteIndices}
      setVisibleRouteIndices={directionsContext.setVisibleRouteIndices}
      geoJson={props.geoJson}
      layers={props.layers}
    />
  );
});

export default DirectionsPanelWrapper;
