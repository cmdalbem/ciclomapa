import React, { Component } from 'react';
import { useDirections } from './contexts/DirectionsContext';

import mapboxgl from 'mapbox-gl';
import turfBbox from '@turf/bbox';
import turfCircle from '@turf/circle';
import 'mapbox-gl/dist/mapbox-gl.css';
import { PmTilesSource } from 'mapbox-pmtiles';

import {
  MAPBOX_ACCESS_TOKEN,
  USE_GEOJSON_SOURCE,
  USE_PMTILES_SOURCE,
  INTERACTIVE_LAYERS_ZOOM_THRESHOLD,
  ENABLE_COMMENTS,
  IS_MOBILE,
  DEFAULT_LINE_WIDTH_MULTIPLIER,
  COMMENTS_ZOOM_THRESHOLD,
  MAP_AUTOCHANGE_AREA_ZOOM_THRESHOLD,
  ROUTE_COLORS,
  MAP_COLORS,
  ROUTE_LINE_WIDTH,
  ROUTE_LINE_PADDING_GAP_WIDTH,
  ROUTE_LINE_GAP_WIDTH,
  ROUTE_LINE_BORDER_WIDTH,
  ROUTE_LINE_BORDER_OPACITY,
  ROUTE_LINE_PADDING_WIDTH,
  NEAR_DESTINATION_POI_RADIUS_KM,
  PMTILES_FILENAME,
  LOW_ZOOM_WIDTH_DIVISOR,
  ROUTES_ACTIVE_LOW_ZOOM_WIDTH_DIVISOR,
  ROUTES_ACTIVE_HIGH_ZOOM_WIDTH_MULTIPLIER,
  DEFAULT_ZOOM,
} from './config/constants.js';

import Analytics from './Analytics.js';
import AirtableDatabase from './AirtableDatabase.js';
import CommentModal from './CommentModal.js';
import NewCommentCursor from './NewCommentCursor.js';
import MapPopups from './MapPopups.js';
import { adjustColorBrightness } from './utils/utils.js';
import debounce from 'lodash.debounce';
import { getCurrentSunPosition } from './sunPositionUtils';
import { arrowIconsByLayer, arrowIcons, arrowSdf, iconsMap } from './features/map/icons';
import { reverseGeocodePlace } from './features/map/geocoding.js';

import './Map.css';

/**
 * Single camera behavior for focusing the map on a city (slug navigation, city picker).
 * @param {mapboxgl.Map} map
 * @param {[number, number]} centerLngLat [lng, lat]
 * @param {string | null | undefined} placeName Used for rare center overrides (e.g. Vitória).
 */
export function flyMapToCityFocus(map, centerLngLat, placeName) {
  const VITORIA_GEOCODER_PLACE_NAME = 'Vitória, Espírito Santo, Brasil';
  const VITORIA_FOCUS_CENTER_LNG_LAT = [-40.3144, -20.2944];

  if (!map || !Array.isArray(centerLngLat) || centerLngLat.length !== 2) return;
  const [lng, lat] = centerLngLat;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

  const center =
    placeName === VITORIA_GEOCODER_PLACE_NAME ? VITORIA_FOCUS_CENTER_LNG_LAT : [lng, lat];
  if (!center || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) return;

  map.flyTo({
    center,
    zoom: DEFAULT_ZOOM,
    speed: 2.2,
    minZoom: 6,
  });
}

const isE2E =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('e2e');

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
  originalPOIFilters; // Store original POI filters to restore when routes are cleared
  geolocateControl; // Reference to Mapbox GeolocateControl
  resizeObserver;

  constructor(props) {
    super(props);

    // Bind functions that'll be used as callbacks with Mapbox
    this.onMapMoveEnded = this.onMapMoveEnded.bind(this);
    this.debouncedOnMapMoveEnded = debounce(this.onMapMoveEnded, 300);
    this.newComment = this.newComment.bind(this);
    this.initCommentsLayer = this.initCommentsLayer.bind(this);
    this.afterCommentCreate = this.afterCommentCreate.bind(this);
    this.showCommentModal = this.showCommentModal.bind(this);
    this.hideCommentModal = this.hideCommentModal.bind(this);
    this.openCommentAtCoordinates = this.openCommentAtCoordinates.bind(this);
    this._onSearchResultPopupClosed = this._onSearchResultPopupClosed.bind(this);
    document.addEventListener('newComment', this.newComment);
    document.addEventListener('ciclomapa-comment-at', this.openCommentAtCoordinates);

    if (ENABLE_COMMENTS) {
      this.airtableDatabase = new AirtableDatabase();
    }

    this.state = {
      showCommentModal: false,
      showCommentCursor: false,
      tagsList: [],
      comments: [],
    };

    // Track geojson feature IDs to hide from pmtiles layers
    this.geojsonFeatureIds = new Set();

    // Create debounced map state sync function (only syncs if place name has been consistent for 3+ seconds)
    this.debouncedMapStateSync = debounce((placeName) => {
      console.debug('Syncing map state with consistent place:', placeName);
      this.syncMapState(placeName);
      document.querySelector('.city-picker span').setAttribute('style', 'opacity: 1');
    }, 1000);
  }

  _onSearchResultPopupClosed() {
    this.props.onGlobalSearchPinDismiss?.();
  }

  openCommentAtCoordinates(e) {
    if (!ENABLE_COMMENTS) return;
    const d = e && e.detail;
    if (!d || typeof d.lng !== 'number' || typeof d.lat !== 'number') return;
    this.newCommentCoords = { lng: d.lng, lat: d.lat };
    if (this.popups) {
      this.popups.searchResultPopup.off('close', this._onSearchResultPopupClosed);
      this.popups.closeAllPopups();
    }
    this.showCommentModal();
  }

  showCommentModal() {
    this.setState({
      showCommentModal: true,
      showCommentCursor: false,
    });
  }

  hideCommentModal() {
    this.setState({
      showCommentModal: false,
    });
  }

  afterCommentCreate() {
    Analytics.event('new_comment');

    this.hideCommentModal();
    this.initCommentsLayer();
  }

  reverseGeocode(lngLat) {
    return reverseGeocodePlace(lngLat)
      .then((result) => {
        if (this.searchBar && result.bbox) {
          this.searchBar.setBbox(result.bbox);
        }
        return result;
      })
      .catch((err) => {
        console.error('Reverse geocoding failed:', err);
        throw err;
      });
  }

  onMapMoveEnded() {
    this.syncMapState();

    if (this.map.getZoom() > MAP_AUTOCHANGE_AREA_ZOOM_THRESHOLD) {
      const center = this.map.getCenter();
      this.reverseGeocode([center.lng, center.lat])
        .then((result) => {
          const currentPlaceName = result.place_name;
          // console.debug('Geocoding result:', currentPlaceName);

          if (!this.lastGeocodedPlaceName) {
            // Initial case
            this.lastGeocodedPlaceName = this.props.location;
            console.debug('Initializing last geocoded place name:', this.lastGeocodedPlaceName);
          } else {
            // Check if this is the same place as the last geocoding result
            if (this.lastGeocodedPlaceName === currentPlaceName) {
              // console.debug('Same place detected, not triggering debounced sync...');
            } else {
              console.debug(
                'Different place detected, cancelling previous sync and starting new timer'
              );

              document.querySelector('.city-picker span').setAttribute('style', 'opacity: 0.5');

              // Different place - cancel previous debounced call and start new timer
              this.debouncedMapStateSync.cancel();
              this.lastGeocodedPlaceName = currentPlaceName;
              this.debouncedMapStateSync(currentPlaceName);
            }
          }
        })
        .catch((err) => {
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

  convertFilterToMapboxFilter(l, sourceId = null) {
    const baseFilter = [
      'any',
      ...l.filters.map((f) =>
        typeof f[0] === 'string'
          ? ['==', ['get', f[0]], f[1]]
          : ['all', ...f.map((f2) => ['==', ['get', f2[0]], f2[1]])]
      ),
    ];

    // For pmtiles layers, combine with geojson feature ID hiding filter
    if (sourceId === 'pmtiles-source' && this.geojsonFeatureIds.size > 0) {
      const idsToHide = Array.from(this.geojsonFeatureIds);
      const hideFilter = [
        '!',
        [
          'any',
          ['in', ['get', '@id'], ['literal', idsToHide]],
          ['in', ['get', 'id'], ['literal', idsToHide]],
        ],
      ];
      return ['all', baseFilter, hideFilter];
    }

    return baseFilter;
  }

  hideGeoJsonFromPmtiles(geoJsonData) {
    // Extract feature IDs from geojson data
    const featureIds = new Set();

    if (geoJsonData && geoJsonData.features) {
      geoJsonData.features.forEach((feature) => {
        if (feature.id !== undefined) {
          featureIds.add(feature.id);
        }
      });
    }

    this.geojsonFeatureIds = featureIds;

    // Update filters for existing pmtiles layers
    if (!this.map || !this.pmtilesLoadedSuccessfully) {
      return;
    }

    this.props.layers.forEach((layer) => {
      if (!layer.type || layer.type === 'way') {
        const layerId = layer.id + '--pmtiles';
        if (this.map.getLayer(layerId)) {
          const newFilter = this.convertFilterToMapboxFilter(layer, 'pmtiles-source');
          this.map.setFilter(layerId, newFilter);
        }
        const routesActiveLayerId = layer.id + '--routes-active--pmtiles';
        if (this.map.getLayer(routesActiveLayerId)) {
          const newFilter = this.convertFilterToMapboxFilter(layer, 'pmtiles-source');
          this.map.setFilter(routesActiveLayerId, newFilter);
        }
      } else if (layer.type === 'poi' && layer.filters) {
        const layerId = layer.id + '--pmtiles';
        const circlesLayerId = layerId + 'circles';
        const polygonLayerId = layerId + 'polygon';

        if (this.map.getLayer(circlesLayerId)) {
          const newFilter = this.convertFilterToMapboxFilter(layer, 'pmtiles-source');
          this.map.setFilter(circlesLayerId, newFilter);
        }

        if (this.map.getLayer(layerId)) {
          const newFilter = this.convertFilterToMapboxFilter(layer, 'pmtiles-source');
          this.map.setFilter(layerId, newFilter);
        }

        if (this.map.getLayer(polygonLayerId)) {
          const newFilter = this.convertFilterToMapboxFilter(layer, 'pmtiles-source');
          this.map.setFilter(polygonLayerId, newFilter);
        }
      }
    });
  }

  getLayerUnderneathName(map) {
    return map.getLayer('road-label-small')
      ? 'road-label-small'
      : map.getLayer('road-label')
        ? 'road-label'
        : '';
  }

  initPOILayerForSource(l, sourceId) {
    const filters = this.convertFilterToMapboxFilter(l, sourceId);

    const sourceLayer = sourceId === 'osmdata' ? '' : 'default';
    const sourceSuffix = sourceId === 'osmdata' ? '' : '--pmtiles';
    const layerId = l.id + sourceSuffix;

    const layerUnderneathName = this.getLayerUnderneathName(this.map);

    // Circles (lower zoom levels)
    this.map.addLayer(
      {
        id: layerId + 'circles',
        name: l.name,
        source: sourceId,
        'source-layer': sourceLayer,
        filter: filters,
        description: l.description,
        type: 'circle',
        minzoom: MAP_AUTOCHANGE_AREA_ZOOM_THRESHOLD,
        maxzoom: l.zoomThreshold,
        paint: {
          'circle-radius': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 1, 15, 4],
          'circle-color': adjustColorBrightness(
            l.style.textColor,
            this.props.isDarkMode ? 0.2 : 0.2
          ),
          'circle-stroke-width': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 0, 15, 2],
          'circle-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.7, 1.0],
          'circle-stroke-color': this.props.isDarkMode
            ? MAP_COLORS.DARK.STROKE
            : MAP_COLORS.LIGHT.STROKE,
        },
      },
      layerUnderneathName
    );

    // Polygons for area POIs (e.g. bike parkings)
    this.map.addLayer({
      id: layerId + 'polygon',
      name: l.name,
      source: sourceId,
      'source-layer': sourceLayer,
      filter: filters,
      description: l.description,
      type: 'fill',
      paint: {
        'fill-color': adjustColorBrightness(l.style.textColor, this.props.isDarkMode ? -0.1 : 0.2),
        'fill-opacity': 0.2,
      },
      // }, layerUnderneathName); // This one should be on TOP of the rest!
    });

    // Icons (higher zoom levels)
    this.map.addLayer({
      id: layerId,
      name: l.name,
      type: 'symbol',
      source: sourceId,
      'source-layer': sourceLayer,
      filter: filters,
      description: l.description,
      minzoom: l.zoomThreshold,
      layout: {
        'text-field': l.name !== 'Estações' ? ['get', 'name'] : '',
        'text-font': ['IBM Plex Sans Medium'],
        'text-letter-spacing': 0.05,
        'text-max-width': 8,
        'icon-size': 0.5,
        // 'icon-size': [
        //     "interpolate",
        //         ["exponential", 1.5],
        //         ["zoom"],
        //         10, 0.2,
        //         15, 0.5
        // ],
        'text-size': ['interpolate', ['exponential', 1.5], ['zoom'], 10, 10, 18, 14],
        // 'text-variable-anchor': ['left'],
        'text-variable-anchor': ['top'],
        'icon-padding': 0,
        'icon-offset': [0, -14],
        'text-offset': [0, 0.5],
        'icon-allow-overlap': true,
        'icon-image': this.props.isDarkMode ? `${l.icon}` : `${l.icon}--light`,
      },
      paint: {
        'text-color': l.style.textColor || 'white',
        'text-halo-width': 1,
        'text-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.7, 1.0],
        'icon-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.7, 1.0],
        'text-halo-color': this.props.isDarkMode ? MAP_COLORS.DARK.HALO : MAP_COLORS.LIGHT.HALO,
      },
      // }, layerUnderneathName); // This one should be on TOP of the rest!
    });

    // Interactions
    const self = this;

    // Helper function to handle POI interactions
    const handlePOIInteraction = (e, interactionType) => {
      if (e.target.getZoom() < INTERACTIVE_LAYERS_ZOOM_THRESHOLD) {
        return;
      }

      if (self.props.isInRouteMode) {
        e.originalEvent.preventDefault();
        return;
      }

      if (interactionType === 'mouseenter' && e.features.length > 0) {
        self.map.getCanvas().style.cursor = 'pointer';

        if (self.hoveredPOI) {
          self.map.setFeatureState(
            {
              source: sourceId,
              sourceLayer: sourceLayer,
              id: self.hoveredPOI,
            },
            { hover: false }
          );
        }
        self.hoveredPOI = e.features[0].id;
        self.map.setFeatureState(
          {
            source: sourceId,
            sourceLayer: sourceLayer,
            id: self.hoveredPOI,
          },
          { hover: true }
        );
      } else if (interactionType === 'mouseleave') {
        if (self.hoveredPOI) {
          self.map.getCanvas().style.cursor = '';

          self.map.setFeatureState(
            {
              source: sourceId,
              sourceLayer: sourceLayer,
              id: self.hoveredPOI,
            },
            { hover: false }
          );
        }
        self.hoveredPOI = null;
      } else if (interactionType === 'click') {
        if (e.features.length > 0 && !e.originalEvent.defaultPrevented) {
          if (self.hoveredPOI) {
            self.map.setFeatureState(
              {
                source: sourceId,
                sourceLayer: sourceLayer,
                id: self.hoveredPOI,
              },
              { hover: false }
            );
          }
          self.popups.showPOIPopup(e, iconsMap[l.icon + '-2x'], l.icon);
          self.focusFeatureOnMobile(e.features[0]);
        }
      }

      e.originalEvent.preventDefault();
    };

    // Add interactions for circles layer (lower zoom levels)
    this.map.on('mouseenter', layerId + 'circles', (e) => handlePOIInteraction(e, 'mouseenter'));
    this.map.on('mouseleave', layerId + 'circles', (e) => handlePOIInteraction(e, 'mouseleave'));
    this.map.on('click', layerId + 'circles', (e) => handlePOIInteraction(e, 'click'));

    // Add interactions for symbols layer (higher zoom levels)
    this.map.on('mouseenter', layerId, (e) => handlePOIInteraction(e, 'mouseenter'));
    this.map.on('mouseleave', layerId, (e) => handlePOIInteraction(e, 'mouseleave'));
    this.map.on('click', layerId, (e) => handlePOIInteraction(e, 'click'));
  }

  initBoundaryLayer() {
    this.updateBoundaryMask();
  }

  focusFeatureOnMobile(feature) {
    if (!IS_MOBILE || !this.map) {
      return;
    }

    const geom = feature?.geometry;
    if (geom?.type !== 'Point' || !Array.isArray(geom.coordinates)) {
      return;
    }

    const [lng, lat] = geom.coordinates;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      return;
    }

    this.map.easeTo({
      center: [lng, lat],
      zoom: 17,
      padding: { bottom: 50 },
    });
  }

  updateBoundaryMask() {
    // Temporarily disabled - boundary mask rendering is causing problems
    // Clean up any existing boundary mask layers
    if (this.map) {
      if (this.map.getLayer('boundary-mask')) this.map.removeLayer('boundary-mask');
      if (this.map.getSource('boundaryMaskSrc')) this.map.removeSource('boundaryMaskSrc');
      if (this.map.getLayer('boundary-layer')) this.map.removeLayer('boundary-layer');
      if (this.map.getSource('boundaryLineSrc')) this.map.removeSource('boundaryLineSrc');
    }
    return;

    // const removeBoundaryLayers = () => {
    //   if (this.map.getLayer('boundary-mask')) this.map.removeLayer('boundary-mask');
    //   if (this.map.getSource('boundaryMaskSrc')) this.map.removeSource('boundaryMaskSrc');
    //   if (this.map.getLayer('boundary-layer')) this.map.removeLayer('boundary-layer');
    //   if (this.map.getSource('boundaryLineSrc')) this.map.removeSource('boundaryLineSrc');
    // };

    // if (!this.map || !this.props.data?.features?.length) {
    //   removeBoundaryLayers();
    //   return;
    // }

    // const isStyleLoaded = this.map.isStyleLoaded();
    // if (!isStyleLoaded) {
    //   const retryWhenReady = () => {
    //     if (this.map && this.map.isStyleLoaded() && this.props.data?.features?.length) {
    //       this.updateBoundaryMask();
    //     } else {
    //       removeBoundaryLayers();
    //     }
    //   };
    //   this.map.once('load', retryWhenReady);
    //   this.map.once('idle', retryWhenReady);
    //   return;
    // }

    // const boundaryFeatures = this.props.data.features.filter(
    //   (f) => f.properties?.boundary === 'administrative'
    // );

    // const boundary =
    //   boundaryFeatures.find((f) => {
    //     const adminLevel = String(f.properties?.admin_level || '');
    //     return ['6', '7', '8', '9', '10'].includes(adminLevel);
    //   }) || boundaryFeatures[0];

    // if (!boundary) {
    //   removeBoundaryLayers();
    //   return;
    // }

    // this.initBoundaryLineLayer(boundary);

    // let innerRings = [];
    // if (boundary.geometry.type === 'Polygon') {
    //   const outerRing = boundary.geometry.coordinates[0];
    //   if (outerRing && outerRing.length > 0) {
    //     innerRings.push(outerRing);
    //   }
    // } else if (boundary.geometry.type === 'MultiPolygon') {
    //   for (const polygon of boundary.geometry.coordinates) {
    //     const outerRing = polygon?.[0];
    //     if (outerRing && outerRing.length > 0) {
    //       innerRings.push(outerRing);
    //     }
    //   }
    // } else {
    //   removeBoundaryLayers();
    //   return;
    // }

    // if (innerRings.length === 0) {
    //   removeBoundaryLayers();
    //   return;
    // }

    // const maskData = {
    //   type: 'FeatureCollection',
    //   features: [
    //     {
    //       type: 'Feature',
    //       geometry: {
    //         type: 'Polygon',
    //         coordinates: [
    //           [
    //             [-180, -90],
    //             [180, -90],
    //             [180, 90],
    //             [-180, 90],
    //             [-180, -90],
    //           ],
    //           ...innerRings,
    //         ],
    //       },
    //     },
    //   ],
    // };

    // if (!this.map.getSource('boundaryMaskSrc')) {
    //   this.map.addSource('boundaryMaskSrc', { type: 'geojson', data: maskData });
    //   this.map.addLayer({
    //     id: 'boundary-mask',
    //     type: 'fill',
    //     source: 'boundaryMaskSrc',
    //     paint: {
    //       'fill-color': '#000000',
    //       'fill-opacity': [
    //         'interpolate',
    //         ['linear'],
    //         ['zoom'],
    //         10,
    //         0,
    //         14,
    //         this.props.isDarkMode ? 0.3 : 0.15,
    //       ],
    //       // 'fill-z-offset': 100 // Apparently can only be used based on sea level, not on ground level, so doesn't work for us
    //     },
    //   });
    // } else {
    //   this.map.getSource('boundaryMaskSrc').setData(maskData);
    // }
  }

  initBoundaryLineLayer(boundary) {
    const boundaryLineData = {
      type: 'FeatureCollection',
      features: [boundary],
    };

    if (!this.map.getSource('boundaryLineSrc')) {
      this.map.addSource('boundaryLineSrc', {
        type: 'geojson',
        data: boundaryLineData,
      });

      this.map.addLayer({
        id: 'boundary-layer',
        type: 'line',
        source: 'boundaryLineSrc',
        paint: {
          'line-color': '#000000',
          // 'line-dasharray': [1, 1],
          'line-width': 1,
          'line-opacity': this.props.isDarkMode ? 0.5 : 0.1,
        },
      });
    } else {
      this.map.getSource('boundaryLineSrc').setData(boundaryLineData);
    }
  }

  initCyclepathLayerForSource(l, sourceId) {
    const filters = this.convertFilterToMapboxFilter(l, sourceId);

    const layerUnderneathName = this.getLayerUnderneathName(this.map);
    const self = this;

    const sourceLayer = sourceId === 'osmdata' ? '' : 'default';

    const sourceSuffix = sourceId === 'osmdata' ? '' : '--pmtiles';
    const interactiveLayerId = l.id + '--interactive' + sourceSuffix;
    const normalLayerId = l.id + sourceSuffix;
    const routesActiveLayerId = l.id + '--routes-active' + sourceSuffix;

    const dashedLineStyle = { 'line-dasharray': [1, 1] };
    // const dashedLineStyle = {
    //     'line-dasharray': [
    //         "step",
    //         ["zoom"],
    //         ["literal", [0.5, 1]],
    //         15,
    //         ["literal", [1.75, 1]],
    //         16,
    //         ["literal", [1, 0.75]],
    //         17,
    //         ["literal", [1, 0.5]]
    //     ]
    // };

    // Interactive layer is wider than the actual layer to improve usability
    if (sourceId === 'osmdata') {
      this.map.addLayer(
        {
          id: interactiveLayerId,
          type: 'line',
          source: sourceId,
          'source-layer': sourceLayer,
          filter: filters,
          paint: {
            'line-occlusion-opacity': 1,
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              1, // Selected
              0,
            ],
            'line-offset': [
              'interpolate',
              ['exponential', 1.5],
              ['zoom'],
              10,
              [
                'case',
                ['==', ['get', 'cycleway:right'], 'lane'],
                Math.max(1, l.style.lineWidth / 4),
                ['==', ['get', 'cycleway:left'], 'lane'],
                Math.min(-1, -l.style.lineWidth / 4),
                0,
              ],
              18,
              [
                'case',
                ['==', ['get', 'cycleway:right'], 'lane'],
                l.style.lineWidth * DEFAULT_LINE_WIDTH_MULTIPLIER,
                ['==', ['get', 'cycleway:left'], 'lane'],
                -l.style.lineWidth * DEFAULT_LINE_WIDTH_MULTIPLIER,
                0,
              ],
            ],
            'line-color': adjustColorBrightness(
              l.style.lineColor,
              this.props.isDarkMode ? -0.7 : 0.7
            ),
            'line-width': 20,
          },
          layout: {
            'line-elevation-reference': 'ground',
          },
        },
        layerUnderneathName
      );
    }

    this.map.addLayer(
      {
        id: normalLayerId,
        type: 'line',
        source: sourceId,
        'source-layer': sourceLayer,
        name: l.name,
        description: l.description,
        filter: filters,
        paint: {
          'line-occlusion-opacity': 1,
          'line-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            adjustColorBrightness(l.style.lineColor, this.props.isDarkMode ? 0.1 : -0.1, 'hsl'), // Selected
            [
              'case',
              ['boolean', ['feature-state', 'hover'], false],
              adjustColorBrightness(l.style.lineColor, this.props.isDarkMode ? -0.3 : 0.3), // Hover
              adjustColorBrightness(l.style.lineColor, this.props.isDarkMode ? 0.0 : -0.1, 'hsl'), // Default
            ],
          ],
          'line-offset': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            10,
            [
              'case',
              ['==', ['get', 'cycleway:right'], 'lane'],
              Math.max(1, l.style.lineWidth / 4),
              ['==', ['get', 'cycleway:left'], 'lane'],
              Math.min(-1, -l.style.lineWidth / 4),
              0,
            ],
            18,
            [
              'case',
              ['==', ['get', 'cycleway:right'], 'lane'],
              l.style.lineWidth * DEFAULT_LINE_WIDTH_MULTIPLIER,
              ['==', ['get', 'cycleway:left'], 'lane'],
              -l.style.lineWidth * DEFAULT_LINE_WIDTH_MULTIPLIER,
              0,
            ],
          ],
          'line-width': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            10,
            Math.max(1, l.style.lineWidth / LOW_ZOOM_WIDTH_DIVISOR),
            18,
            l.style.lineWidth * DEFAULT_LINE_WIDTH_MULTIPLIER,
          ],
          ...(l.style.lineStyle === 'dashed' && dashedLineStyle),
        },
        layout: {
          'line-elevation-reference': 'ground',
          ...(l.style.lineStyle === 'dashed' ? {} : { 'line-join': 'round', 'line-cap': 'round' }),
        },
      },
      layerUnderneathName
    );

    if (sourceId === 'osmdata') {
      const arrowLayerId = normalLayerId + '--arrows';
      const arrowBase = arrowIconsByLayer[l.name];
      const useSdf = !arrowBase;
      const arrowIconName = useSdf
        ? 'arrowSdf'
        : this.props.isDarkMode
          ? arrowBase
          : `${arrowBase}--light`;

      this.map.addLayer(
        {
          id: arrowLayerId,
          type: 'symbol',
          source: sourceId,
          'source-layer': sourceLayer,
          filter: filters,
          minzoom: 12,
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': ['interpolate', ['exponential', 1.5], ['zoom'], 12, 20, 16, 80],
            'icon-image': arrowIconName,
            'icon-size': [
              'interpolate',
              ['exponential', 1.5],
              ['zoom'],
              10,
              (Math.max(1, l.style.lineWidth / LOW_ZOOM_WIDTH_DIVISOR) / 32) * (useSdf ? 1 : 0.5),
              18,
              ((l.style.lineWidth * DEFAULT_LINE_WIDTH_MULTIPLIER) / 24) * (useSdf ? 1 : 0.5),
            ],
            'icon-rotation-alignment': 'map',
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
            'icon-padding': 4,
            'icon-offset': [
              'case',
              ['==', ['get', 'cycleway:right'], 'lane'],
              [0, 44],
              ['==', ['get', 'cycleway:left'], 'lane'],
              [0, -44],
              [0, 0],
            ],
          },
          paint: {
            ...(useSdf && {
              'icon-color': adjustColorBrightness(
                l.style.lineColor,
                this.props.isDarkMode ? 0.0 : -0.1,
                'hsl'
              ),
              'icon-halo-width': 1,
              'icon-halo-blur': 0,
              'icon-halo-color': this.props.isDarkMode
                ? MAP_COLORS.DARK.HALO
                : MAP_COLORS.LIGHT.ICON_HALO,
            }),
            'icon-opacity': [
              'case',
              ['==', ['get', 'oneway:bicycle'], 'no'],
              0,
              ['==', ['get', 'oneway:bicycle'], 'yes'],
              1,
              ['==', ['get', 'oneway'], 'no'],
              0,
              ['==', ['get', 'oneway'], 'yes'],
              1,
              0,
            ],
          },
        },
        layerUnderneathName
      );
    }

    // Muted duplicate of the cycling layer shown only while routes are displayed.
    // Differences from the normal layer above:
    //   - Single flat color (no hover/selected states) derived from the Ciclovia base color
    //   - Dimmed brightness so route lines remain the visual focus
    //   - Thinner at low zoom (ROUTES_ACTIVE_LOW_ZOOM_WIDTH_DIVISOR vs LOW_ZOOM_WIDTH_DIVISOR)
    //   - No line-offset for cycleway lanes
    //   - Starts hidden; toggled visible by updateLayerVisibility() when hasRoutes is true
    this.map.addLayer(
      {
        id: routesActiveLayerId,
        type: 'line',
        source: sourceId,
        'source-layer': sourceLayer,
        name: l.name + ' (Routes Active)',
        description: l.description,
        filter: filters,
        paint: {
          'line-occlusion-opacity': 1,
          'line-color': adjustColorBrightness(
            this.props.layers.find((layer) => layer.name === 'Ciclovia').style.lineColor,
            this.props.isDarkMode ? -0.6 : 0.5
          ),
          'line-width': [
            'interpolate',
            ['exponential', 1.5],
            ['zoom'],
            10,
            Math.max(1, l.style.lineWidth / ROUTES_ACTIVE_LOW_ZOOM_WIDTH_DIVISOR),
            18,
            l.style.lineWidth * ROUTES_ACTIVE_HIGH_ZOOM_WIDTH_MULTIPLIER,
          ],
          ...(l.style.lineStyle === 'dashed' && dashedLineStyle),
        },
        layout: {
          'line-elevation-reference': 'ground',
          ...(l.style.lineStyle === 'dashed' ? {} : { 'line-join': 'round', 'line-cap': 'round' }),
          visibility: 'none',
        },
      },
      layerUnderneathName
    );

    // Only osmdata is interactive
    if (sourceId === 'osmdata') {
      this.map.on('click', interactiveLayerId, (e) => {
        if (e.target.getZoom() < INTERACTIVE_LAYERS_ZOOM_THRESHOLD) {
          return;
        }
        if (e && e.features && e.features.length > 0 && !e.originalEvent.defaultPrevented) {
          // Disable cyclepath clicks when in route mode
          if (self.props.isInRouteMode) {
            e.originalEvent.preventDefault();
            return;
          }

          if (self.selectedCycleway) {
            try {
              self.map.setFeatureState(
                { source: 'osmdata', id: self.selectedCycleway },
                { selected: false, hover: false }
              );
            } catch (err) {}
          }
          self.selectedCycleway = e.features[0].id;
          try {
            self.map.setFeatureState(
              { source: 'osmdata', id: self.selectedCycleway },
              { selected: true }
            );
          } catch (err) {}

          const layer = self.props.layers.find(
            (l) => l.id === e.features[0].layer.id.split('--')[0]
          );
          self.popups.showCyclewayPopup(e, layer);
          if (IS_MOBILE && e.features && e.features[0]) {
            const bb = turfBbox(e.features[0]); // [minX, minY, maxX, maxY]
            const bounds = new mapboxgl.LngLatBounds([bb[0], bb[1]], [bb[2], bb[3]]);
            self.map.fitBounds(bounds, {
              padding: { top: 150, bottom: 300, left: 100, right: 100 },
            });
          }
          e.originalEvent.preventDefault();
        }
      });

      // Since these structures are contiguous we need to use mousemove instead of mouseenter/mouseleave
      this.map.on('mousemove', interactiveLayerId, (e) => {
        if (e.features.length > 0) {
          if (
            e.target.getZoom() < INTERACTIVE_LAYERS_ZOOM_THRESHOLD ||
            self.hoveredCycleway === e.features[0].id ||
            self.props.isInRouteMode
          ) {
            return;
          }

          self.map.getCanvas().style.cursor = 'pointer';

          if (self.hoveredCycleway) {
            self.map.setFeatureState(
              {
                source: sourceId,
                sourceLayer: sourceLayer,
                id: self.hoveredCycleway,
              },
              { hover: false }
            );
          }

          self.hoveredCycleway = e.features[0].id;
          self.map.setFeatureState(
            {
              source: sourceId,
              sourceLayer: sourceLayer,
              id: self.hoveredCycleway,
            },
            { hover: true }
          );
        }
      });

      this.map.on('mouseleave', interactiveLayerId, () => {
        console.debug('mouseleave', interactiveLayerId);
        if (self.hoveredCycleway) {
          self.map.setFeatureState(
            {
              source: sourceId,
              sourceLayer: sourceLayer,
              id: self.hoveredCycleway,
            },
            { hover: false }
          );

          self.map.getCanvas().style.cursor = '';
        }
        self.hoveredCycleway = null;
      });
    }
  }

  async initCommentsLayer() {
    const self = this;
    if (this.state.comments.length > 0) {
      this.state.comments.forEach((c) => {
        if (c.marker) {
          c.marker.remove();
        }
      });

      this.map.removeLayer('comentarios');
    }

    this.setState(await this.airtableDatabase.getComments(), () => {
      if (this.state.comments.length > 0) {
        this.map.getSource('commentsSrc').setData({
          type: 'FeatureCollection',
          features: this.state.comments.map((c) => {
            return {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: c.fields.latlong.split(',').reverse(),
              },
              properties: c.fields,
            };
          }),
        });

        this.map.addLayer({
          id: 'comentarios',
          type: 'symbol',
          source: 'commentsSrc',
          minzoom: MAP_AUTOCHANGE_AREA_ZOOM_THRESHOLD,
          layout: {
            'icon-image': this.props.isDarkMode ? 'commentIcon' : 'commentIcon--light',
            'icon-size': [
              'interpolate',
              ['exponential', 1.5],
              ['zoom'],
              8,
              0,
              COMMENTS_ZOOM_THRESHOLD,
              0.5,
            ],
            'icon-allow-overlap': ['step', ['zoom'], false, COMMENTS_ZOOM_THRESHOLD, true],
          },
          paint: {
            'icon-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.8, 1],
          },
        });

        // Interactions

        this.map.on('mouseenter', 'comentarios', (e) => {
          if (e.target.getZoom() < INTERACTIVE_LAYERS_ZOOM_THRESHOLD) {
            return;
          }
          if (e.features.length > 0) {
            // Disable comment hover effects when in route mode
            if (self.props.isInRouteMode) {
              return;
            }
            self.map.getCanvas().style.cursor = 'pointer';

            if (self.hoveredComment) {
              self.map.setFeatureState(
                {
                  source: 'commentsSrc',
                  id: self.hoveredComment,
                },
                { hover: false }
              );
            }
            self.hoveredComment = e.features[0].id;
            self.map.setFeatureState(
              {
                source: 'commentsSrc',
                id: self.hoveredComment,
              },
              { hover: true }
            );
          }
        });

        this.map.on('mouseleave', 'comentarios', (e) => {
          if (self.hoveredComment) {
            // && !self.selectedCycleway) {
            self.map.getCanvas().style.cursor = '';

            self.map.setFeatureState(
              {
                source: 'commentsSrc',
                id: self.hoveredComment,
              },
              { hover: false }
            );
          }
          self.hoveredComment = null;
        });

        this.map.on('click', 'comentarios', (e) => {
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
            self.focusFeatureOnMobile(e.features[0]);
            e.originalEvent.preventDefault();
          }
        });
      }
    });
  }

  async initializeDataSources() {
    if (!this.map.isStyleLoaded()) {
      await new Promise((resolve) => {
        if (this.map.isStyleLoaded()) {
          resolve();
        } else {
          this.map.once('styledata', resolve);
        }
      });
    }

    if (!this.map.getSource('osmdata') && USE_GEOJSON_SOURCE) {
      this.map.addSource('osmdata', {
        type: 'geojson',
        data: this.props.data || {
          type: 'FeatureCollection',
          features: [],
        },
        generateId: true,
      });
    }

    if (USE_PMTILES_SOURCE) {
      try {
        const PMTILES_URL = process.env.REACT_APP_PMTILES_URL + PMTILES_FILENAME;
        console.log('Loading PMTiles from S3:', PMTILES_URL);

        const header = await PmTilesSource.getHeader(PMTILES_URL);
        console.log(
          'PMTiles loaded - bounds:',
          [header.minLon, header.minLat, header.maxLon, header.maxLat],
          'zoom:',
          header.minZoom + '-' + header.maxZoom
        );

        const bounds = [header.minLon, header.minLat, header.maxLon, header.maxLat];

        this.map.addSource('pmtiles-source', {
          type: PmTilesSource.SOURCE_TYPE,
          url: PMTILES_URL,
          minzoom: header.minZoom,
          maxzoom: header.maxZoom,
          bounds: bounds,
        });

        console.log('PMTiles source added successfully');
        this.pmtilesLoadedSuccessfully = true;

        // Hide geojson features from pmtiles layers
        this.hideGeoJsonFromPmtiles(this.props.data);
      } catch (error) {
        console.error('Error setting up PmTiles for cyclepaths:', error);
        this.pmtilesLoadedSuccessfully = false;
      }
    }
  }

  // isPmtilesAvailable() {
  //     console.debug('pmtilesLoadedSuccessfully = ', this.pmtilesLoadedSuccessfully);
  //     if (this.pmtilesLoadedSuccessfully === undefined) {
  //         console.error('PmTiles loaded successfully status is undefined, this should not happen');
  //     }
  //     return this.pmtilesLoadedSuccessfully === true;
  // }

  // Layers need to be initialized in the paint order
  // Afterwards their data can be updated safely without messing up the order
  async initGeojsonLayers(layers) {
    const map = this.map;

    // @todo Better way to check if layers are already initialized
    if (!map.getSource('osmdata')) {
      await this.initializeDataSources();

      if (!map.getSource('commentsSrc')) {
        map.addSource('commentsSrc', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [],
          },
          generateId: true,
        });
      }

      // layers.json is ordered from most to least important, but we
      //   want the most important ones to be on top so we add in reverse.
      // Slice is used here to don't destructively reverse the original array.
      layers
        .slice()
        .reverse()
        .forEach((l) => {
          if (!l.type || l.type === 'way') {
            if (this.pmtilesLoadedSuccessfully) {
              this.initCyclepathLayerForSource(l, 'pmtiles-source');
            }

            this.initCyclepathLayerForSource(l, 'osmdata');
          } else if (l.type === 'poi' && l.filters) {
            // Mapbox doesn't support symbol layers for pmtiles
            // if (this.pmtilesLoadedSuccessfully) {
            //     this.initPOILayerForSource(l, 'pmtiles-source');
            // }

            this.initPOILayerForSource(l, 'osmdata');
          }
        });

      // Temporarily disabled - boundary mask rendering is causing problems
      // this.initBoundaryLayer();

      // if (map.getLayer('capitais-br')) {
      //     map.setLayoutProperty(
      //         'capitais-br',
      //         'visibility',
      //         'visible');
      // }
    } else {
      console.warn('Map layers already initialized.');
    }

    if (map.getLayer('mapbox-satellite')) {
      map.setLayoutProperty(
        'mapbox-satellite',
        'visibility',
        this.props.showSatellite ? 'visible' : 'none'
      );
    }
  }

  createRouteLayerSet(map, sourceId, layerType) {
    const suffix = layerType === 'top' ? '-selected' : 's-unselected';

    const layerUnderneathName = this.getLayerUnderneathName(map);

    // 1. Padding layer
    map.addLayer(
      {
        id: `route-padding${suffix}`,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          'line-elevation-reference': 'ground',
        },
        paint: {
          'line-occlusion-opacity': 1,
          'line-color': this.props.isDarkMode
            ? MAP_COLORS.DARK.ROUTE_PADDING_LINE
            : MAP_COLORS.LIGHT.ROUTE_PADDING_LINE,
          'line-width': ROUTE_LINE_PADDING_WIDTH,
          'line-gap-width': ROUTE_LINE_PADDING_GAP_WIDTH,
        },
        filter: ['==', '$type', 'LineString'],
      },
      layerUnderneathName
    );

    // 3. Main route layer
    map.addLayer(
      {
        id: `route${suffix}`,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          'line-elevation-reference': 'ground',
        },
        paint: {
          'line-occlusion-opacity': 1,
          'line-color':
            layerType === 'top'
              ? this.props.isDarkMode
                ? ROUTE_COLORS.DARK.SELECTED
                : ROUTE_COLORS.LIGHT.SELECTED
              : this.props.isDarkMode
                ? ROUTE_COLORS.DARK.UNSELECTED
                : ROUTE_COLORS.LIGHT.UNSELECTED,
          'line-width': ROUTE_LINE_WIDTH,
        },
        filter: ['==', '$type', 'LineString'],
      },
      layerUnderneathName
    );

    // 2. Border layer
    map.addLayer(
      {
        id: `route--border${suffix}`,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          'line-elevation-reference': 'ground',
        },
        paint: {
          'line-occlusion-opacity': 1,
          'line-color':
            layerType === 'top'
              ? this.props.isDarkMode
                ? MAP_COLORS.DARK.ROUTE_BORDER
                : MAP_COLORS.LIGHT.ROUTE_BORDER
              : this.props.isDarkMode
                ? MAP_COLORS.DARK.ROUTE_BORDER
                : MAP_COLORS.LIGHT.ROUTE_BORDER,
          // : [
          //     'case',
          //     ['boolean', ['feature-state', 'hover'], false],
          //         this.props.isDarkMode ? '#ffffff' : '#1a1a1a', // On hover
          //         this.props.isDarkMode ? '#ffffff' : '#000000', // Default
          // ],
          'line-width': ROUTE_LINE_BORDER_WIDTH,
          'line-opacity': ROUTE_LINE_BORDER_OPACITY,
          'line-gap-width': ROUTE_LINE_GAP_WIDTH,
        },
        filter: ['==', '$type', 'LineString'],
      },
      layerUnderneathName
    );
  }

  createCyclepathLayerSet(map, sourceId, layerType) {
    const suffix = layerType === 'top' ? '-selected' : 's-unselected';

    const layerUnderneathName = this.getLayerUnderneathName(map);

    // Create mapping from cyclepath types to layer definitions
    const cyclepathTypeToLayer = {};
    this.props.layers.forEach((layer) => {
      if (
        layer.name === 'Ciclovia' ||
        layer.name === 'Ciclofaixa' ||
        layer.name === 'Ciclorrota' ||
        layer.name === 'Calçada compartilhada'
      ) {
        cyclepathTypeToLayer[layer.name] = layer;
      }
    });

    // Main cyclepath layer
    map.addLayer(
      {
        id: `overlapping-cyclepath${suffix}`,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          'line-elevation-reference': 'ground',
        },
        paint: {
          'line-occlusion-opacity': 1,
          'line-color':
            layerType === 'top'
              ? [
                  // Selected route - use original colors
                  'case',
                  ['==', ['get', 'type'], 'Ciclovia'],
                  this.props.isDarkMode
                    ? cyclepathTypeToLayer['Ciclovia'].style.lineColorDark
                    : cyclepathTypeToLayer['Ciclovia'].style.lineColor,
                  ['==', ['get', 'type'], 'Ciclofaixa'],
                  this.props.isDarkMode
                    ? cyclepathTypeToLayer['Ciclofaixa'].style.lineColorDark
                    : cyclepathTypeToLayer['Ciclofaixa'].style.lineColor,
                  ['==', ['get', 'type'], 'Ciclorrota'],
                  this.props.isDarkMode
                    ? cyclepathTypeToLayer['Ciclorrota'].style.lineColorDark
                    : cyclepathTypeToLayer['Ciclorrota'].style.lineColor,
                  ['==', ['get', 'type'], 'Calçada compartilhada'],
                  this.props.isDarkMode
                    ? cyclepathTypeToLayer['Calçada compartilhada'].style.lineColorDark
                    : cyclepathTypeToLayer['Calçada compartilhada'].style.lineColor,
                  MAP_COLORS.CYCLEPATH_FALLBACK, // Default fallback color
                ]
              : [
                  // Unselected route - use adjusted colors (brighter in light mode, darker in dark mode)
                  'case',
                  ['==', ['get', 'type'], 'Ciclovia'],
                  this.props.isDarkMode
                    ? adjustColorBrightness(
                        cyclepathTypeToLayer['Ciclovia'].style.lineColorDark,
                        -0.6
                      )
                    : adjustColorBrightness(cyclepathTypeToLayer['Ciclovia'].style.lineColor, 0.6),
                  ['==', ['get', 'type'], 'Ciclofaixa'],
                  this.props.isDarkMode
                    ? adjustColorBrightness(
                        cyclepathTypeToLayer['Ciclofaixa'].style.lineColorDark,
                        -0.6
                      )
                    : adjustColorBrightness(
                        cyclepathTypeToLayer['Ciclofaixa'].style.lineColor,
                        0.6
                      ),
                  ['==', ['get', 'type'], 'Ciclorrota'],
                  this.props.isDarkMode
                    ? adjustColorBrightness(
                        cyclepathTypeToLayer['Ciclorrota'].style.lineColorDark,
                        -0.6
                      )
                    : adjustColorBrightness(
                        cyclepathTypeToLayer['Ciclorrota'].style.lineColor,
                        0.6
                      ),
                  ['==', ['get', 'type'], 'Calçada compartilhada'],
                  this.props.isDarkMode
                    ? adjustColorBrightness(
                        cyclepathTypeToLayer['Calçada compartilhada'].style.lineColorDark,
                        -0.6
                      )
                    : adjustColorBrightness(
                        cyclepathTypeToLayer['Calçada compartilhada'].style.lineColor,
                        0.6
                      ),
                  MAP_COLORS.CYCLEPATH_FALLBACK, // Default fallback color
                ],
          'line-width': ROUTE_LINE_WIDTH,
          // 'line-dasharray': ['case',
          //     ['==', ['get', 'type'], 'Ciclovia'],
          //             cyclepathTypeToLayer['Ciclovia'].style.lineStyle === 'dashed' ? [1, 1] : [1, 0],
          //     ['==', ['get', 'type'], 'Ciclofaixa'],
          //             cyclepathTypeToLayer['Ciclofaixa'].style.lineStyle === 'dashed' ? [1, 1] : [1, 0],
          //     ['==', ['get', 'type'], 'Ciclorrota'],
          //             cyclepathTypeToLayer['Ciclorrota'].style.lineStyle === 'dashed' ? [1, 1] : [1, 0],
          //     ['==', ['get', 'type'], 'Calçada compartilhada'],
          //             cyclepathTypeToLayer['Calçada compartilhada'].style.lineStyle === 'dashed' ? [1, 1] : [1, 0],
          //     [1,0]
          // ],
          'line-opacity': 1.0,
        },
        filter: ['==', '$type', 'LineString'],
      },
      layerUnderneathName
    );

    // Border layer
    map.addLayer(
      {
        id: `overlapping-cyclepath${suffix}--border`,
        type: 'line',
        source: sourceId,
        layout: {
          'line-join': 'round',
          'line-elevation-reference': 'ground',
        },
        paint: {
          'line-occlusion-opacity': 1,
          'line-color': this.props.isDarkMode
            ? MAP_COLORS.DARK.ROUTE_BORDER
            : MAP_COLORS.LIGHT.ROUTE_BORDER,
          'line-width': ROUTE_LINE_BORDER_WIDTH,
          'line-opacity': ROUTE_LINE_BORDER_OPACITY,
          'line-gap-width': ROUTE_LINE_GAP_WIDTH,
        },
        filter: ['==', '$type', 'LineString'],
      },
      layerUnderneathName
    );
  }

  setupRouteEventHandlers(map) {
    const self = this;

    // Set up click handlers for both top and bottom layers
    ['route-selected', 'routes-unselected'].forEach((layerId) => {
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
    ['route-selected', 'routes-unselected'].forEach((layerId) => {
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

  initRoutesLayers() {
    const map = this.map;
    if (!map || map.getSource('route-selected')) return;

    const emptySource = {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [],
      },
    };

    map.addSource('route-selected', emptySource);
    map.addSource('routes-unselected', emptySource);
    map.addSource('overlapping-cyclepaths-selected', emptySource);
    map.addSource('overlapping-cyclepaths-unselected', emptySource);

    // Order here is important for layer stacking
    this.createRouteLayerSet(map, 'routes-unselected', 'bottom');
    this.createCyclepathLayerSet(map, 'overlapping-cyclepaths-unselected', 'bottom');
    this.createRouteLayerSet(map, 'route-selected', 'top');
    this.createCyclepathLayerSet(map, 'overlapping-cyclepaths-selected', 'top');

    this.setupRouteEventHandlers(map);
  }

  componentDidUpdate(prevProps) {
    const map = this.map;

    if (!map) {
      return;
    }

    if (this.props.data !== prevProps.data) {
      if (map.getSource('osmdata')) {
        map.getSource('osmdata').setData(this.props.data);
      }

      // Reset stored filters when data changes
      this.originalPOIFilters = null;

      this.hideGeoJsonFromPmtiles(this.props.data);

      this.updateBoundaryMask();
    }

    if (this.props.location !== prevProps.location && this.popups) {
      this.popups.setSelectedAreaLabel(this.props.location);
    }

    if (this.props.style !== prevProps.style) {
      console.debug('new style', this.props.style);
      map.setStyle(this.props.style);
    }

    if (this.props.showSatellite !== prevProps.showSatellite) {
      map.setLayoutProperty(
        'mapbox-satellite',
        'visibility',
        this.props.showSatellite ? 'visible' : 'none'
      );
    }

    // Temporarily disabled to test if it's needed
    // if (this.props.isDarkMode !== prevProps.isDarkMode) {
    //     if (map.getLayer('boundary-layer')) {
    //         map.setPaintProperty('boundary-layer', 'line-color',
    //             this.props.isDarkMode ? '#FFFFFF' : '#000000');
    //     }
    //     if (map.getLayer('boundary-mask')) {
    //         map.setPaintProperty('boundary-mask', 'fill-opacity',
    //             this.props.isDarkMode ? 0.5 : 0.1);
    //     }
    // }

    const layersChanged = this.props.layers.some((layer, index) => {
      const prevLayer = prevProps.layers[index];
      return !prevLayer || layer.isActive !== prevLayer.isActive;
    });

    const routesChanged = this.props.routes !== prevProps.routes;
    const routesOrDestChanged = routesChanged || this.props.toPoint !== prevProps.toPoint;

    // Single pass: layer toggles, route mode, and destination all affect visibility.
    if (layersChanged || routesOrDestChanged) {
      if (layersChanged) {
        console.debug('Layer visibility changed, updating...');
      }
      this.updateLayerVisibility();
    }

    const selectedRouteChanged = this.props.selectedRouteIndex !== prevProps.selectedRouteIndex;
    const hoveredRouteChanged = this.props.hoveredRouteIndex !== prevProps.hoveredRouteIndex;

    if (routesChanged) {
      this.updateRoutesLayer(this.props.routes);
      this.updateRouteTooltips();
    }

    // updateRoutesLayer already redistributes by selectedRouteIndex; skip duplicate work.
    if (selectedRouteChanged && !routesChanged) {
      this.updateSelectedRoute(this.props.selectedRouteIndex);
    }

    // Re-apply hover after route geometry refresh (new features) or index change.
    if (hoveredRouteChanged || routesChanged) {
      this.updateHoveredRoute(this.props.hoveredRouteIndex);
    }

    if (this.props.globalSearchPin !== prevProps.globalSearchPin) {
      this.applyGlobalSearchPin(this.props.globalSearchPin);
    }
  }

  applyGlobalSearchPin(pin) {
    if (!this.map || !this.popups) return;

    if (this.globalSearchMarker) {
      this.globalSearchMarker.remove();
      this.globalSearchMarker = null;
    }

    this.popups.searchResultPopup.off('close', this._onSearchResultPopupClosed);
    this.popups.hideSearchResultPopup();

    if (!pin || !Number.isFinite(pin.lng) || !Number.isFinite(pin.lat)) return;

    const el = document.createElement('div');
    el.className = 'global-search-marker';
    el.setAttribute('aria-hidden', 'true');

    this.globalSearchMarker = new mapboxgl.Marker({ element: el, draggable: false })
      .setLngLat([pin.lng, pin.lat])
      .addTo(this.map);

    this.popups.showSearchResultPopup({
      lng: pin.lng,
      lat: pin.lat,
      title: pin.title,
      address: pin.address,
    });
    this.popups.searchResultPopup.on('close', this._onSearchResultPopupClosed);
  }

  updateRoutesLayer(routes) {
    const map = this.map;
    if (!map) return;

    // Check if routes sources exist (they might not be initialized yet)
    if (!map.getSource('route-selected') || !map.getSource('routes-unselected')) {
      console.warn('Routes sources not yet initialized, skipping update');
      return;
    }

    if (routes && routes.routes && routes.routes.length > 0) {
      // Create GeoJSON features for all routes
      const routeFeatures = routes.routes
        .slice()
        .reverse()
        .map((route) => ({
          type: 'Feature',
          id: route.sortedIndex, // Add explicit ID for feature state
          properties: {
            routeIndex: route.sortedIndex,
            distance: route.distance,
            duration: route.duration,
          },
          geometry: route.geometry,
        }));

      // Distribute routes between top and bottom layers based on current selection
      this.distributeRoutesBetweenLayers(routeFeatures);

      // Update overlapping cyclepaths with unified data
      this.updateOverlappingCyclepathsFromUnifiedData(routes);

      if (routes.bbox) {
        const padding = IS_MOBILE
          ? { top: 250, bottom: 50, left: 50, right: 50 }
          : { top: 100, bottom: 100, left: 500, right: 100 };
        map.fitBounds(routes.bbox, { padding: padding, duration: 2000 });
      }
    } else {
      // Clear both sources
      const emptyData = { type: 'FeatureCollection', features: [] };
      map.getSource('route-selected').setData(emptyData);
      map.getSource('routes-unselected').setData(emptyData);

      // Clear overlapping cyclepaths
      if (
        map.getSource('overlapping-cyclepaths-selected') &&
        map.getSource('overlapping-cyclepaths-unselected')
      ) {
        map.getSource('overlapping-cyclepaths-selected').setData(emptyData);
        map.getSource('overlapping-cyclepaths-unselected').setData(emptyData);
      }
    }
  }

  distributeRoutesBetweenLayers(routeFeatures) {
    const map = this.map;
    const selectedRouteIndex = this.props.selectedRouteIndex;

    // If there's a selected route, put it in top layer and others in bottom
    if (selectedRouteIndex !== null && selectedRouteIndex !== undefined) {
      const selectedRoute = routeFeatures.find(
        (f) => f.properties.routeIndex === selectedRouteIndex
      );
      const otherRoutes = routeFeatures.filter(
        (f) => f.properties.routeIndex !== selectedRouteIndex
      );

      map.getSource('route-selected').setData({
        type: 'FeatureCollection',
        features: selectedRoute ? [selectedRoute] : [],
      });

      map.getSource('routes-unselected').setData({
        type: 'FeatureCollection',
        features: otherRoutes,
      });
    } else {
      // No selection, put all routes in bottom layer
      map.getSource('route-selected').setData({
        type: 'FeatureCollection',
        features: [],
      });

      map.getSource('routes-unselected').setData({
        type: 'FeatureCollection',
        features: routeFeatures,
      });
    }
  }

  distributeCyclepathsBetweenLayers(cyclepathFeatures) {
    const map = this.map;
    const selectedRouteIndex = this.props.selectedRouteIndex;

    // If there's a selected route, put its cyclepaths in top layer and others in bottom
    if (selectedRouteIndex !== null && selectedRouteIndex !== undefined) {
      const selectedCyclepaths = cyclepathFeatures.filter(
        (f) => f.properties.routeIndex === selectedRouteIndex
      );
      const otherCyclepaths = cyclepathFeatures.filter(
        (f) => f.properties.routeIndex !== selectedRouteIndex
      );

      map.getSource('overlapping-cyclepaths-selected').setData({
        type: 'FeatureCollection',
        features: selectedCyclepaths,
      });

      map.getSource('overlapping-cyclepaths-unselected').setData({
        type: 'FeatureCollection',
        features: otherCyclepaths,
      });
    } else {
      // No selection, put all cyclepaths in bottom layer
      map.getSource('overlapping-cyclepaths-selected').setData({
        type: 'FeatureCollection',
        features: [],
      });

      map.getSource('overlapping-cyclepaths-unselected').setData({
        type: 'FeatureCollection',
        features: cyclepathFeatures,
      });
    }
  }

  progressivelyAddAllRoutes(routeFeatures, selectedRouteIndex) {
    const map = this.map;
    let selectedFeatures = [];
    let unselectedFeatures = [];

    // Separate selected and unselected routes
    const selectedRoute =
      selectedRouteIndex !== null && selectedRouteIndex !== undefined
        ? routeFeatures.find((f) => f.properties.routeIndex === selectedRouteIndex)
        : null;
    const unselectedRoutes = routeFeatures.filter(
      (f) => f.properties.routeIndex !== selectedRouteIndex
    );

    // Create ordered list: selected route first, then unselected routes
    const orderedRoutes = selectedRoute ? [selectedRoute, ...unselectedRoutes] : unselectedRoutes;
    let currentRouteIndex = 0;

    const addNextRoute = () => {
      if (currentRouteIndex >= orderedRoutes.length) return;

      const route = orderedRoutes[currentRouteIndex];
      const isSelected =
        selectedRouteIndex !== null &&
        selectedRouteIndex !== undefined &&
        route.properties.routeIndex === selectedRouteIndex;

      // Create progressive geometry for this route
      this.progressivelyAddRouteGeometry(
        route,
        isSelected,
        selectedFeatures,
        unselectedFeatures,
        map,
        () => {
          // When this route is complete, move to the next one
          currentRouteIndex++;
          setTimeout(addNextRoute, 0); // Small delay between routes
        }
      );
    };

    // Start with the first route (selected if available)
    addNextRoute();
  }

  progressivelyAddRouteGeometry(
    route,
    isSelected,
    selectedFeatures,
    unselectedFeatures,
    map,
    onComplete
  ) {
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
          coordinates: [...currentCoordinates],
        },
      };

      // Update the appropriate layer
      if (isSelected) {
        selectedFeatures = [progressiveRoute];
        map.getSource('route-selected').setData({
          type: 'FeatureCollection',
          features: selectedFeatures,
        });
      } else {
        // Find and update the route in unselected features
        const existingIndex = unselectedFeatures.findIndex(
          (f) => f.properties.routeIndex === route.properties.routeIndex
        );
        if (existingIndex >= 0) {
          unselectedFeatures[existingIndex] = progressiveRoute;
        } else {
          unselectedFeatures.push(progressiveRoute);
        }
        map.getSource('routes-unselected').setData({
          type: 'FeatureCollection',
          features: unselectedFeatures,
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
          features: currentFeatures,
        });
      }, index * 50); // 50ms delay between each route
    });
  }

  updateOverlappingCyclepathsFromUnifiedData(routes) {
    const map = this.map;
    if (!map) return;

    // Check if overlapping cyclepaths sources exist (they might not be initialized yet)
    if (
      !map.getSource('overlapping-cyclepaths-selected') ||
      !map.getSource('overlapping-cyclepaths-unselected')
    ) {
      console.warn('Overlapping cyclepaths sources not yet initialized, skipping update');
      return;
    }

    let allOverlappingCyclepaths = [];
    let featureId = 0;

    if (routes && routes.routes && routes.routes.length > 0) {
      // Process unified routes data
      routes.routes.forEach((route, routeIndex) => {
        if (route && route.overlappingCyclepaths && route.overlappingCyclepaths.length > 0) {
          route.overlappingCyclepaths.forEach((segment) => {
            allOverlappingCyclepaths.push({
              type: 'Feature',
              id: featureId++,
              properties: {
                ...segment.properties,
                routeIndex: route.sortedIndex, // Use sortedIndex for consistency
                // Use debug_cyclepath_type for styling since these are overlap segments
                type: segment.properties.debug_cyclepath_type || 'Unknown',
              },
              geometry: segment.geometry,
            });
          });
        }
      });
    }

    // Distribute cyclepaths between top and bottom layers based on current selection
    this.distributeCyclepathsBetweenLayers(allOverlappingCyclepaths);
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
      map.setFeatureState({ source: sourceId, id: feature.id }, { hover: false });
    });

    // Redistribute routes between layers based on new selection
    // We need to reconstruct the route features from the original routes data
    if (this.props.routes && this.props.routes.routes) {
      const routeFeatures = this.props.routes.routes
        .slice()
        .reverse()
        .map((route) => ({
          type: 'Feature',
          id: route.sortedIndex,
          properties: {
            routeIndex: route.sortedIndex,
            distance: route.distance,
            duration: route.duration,
          },
          geometry: route.geometry,
        }));
      this.distributeRoutesBetweenLayers(routeFeatures);

      // Also redistribute cyclepaths when route selection changes
      this.updateOverlappingCyclepathsFromUnifiedData(this.props.routes);
    }

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
      map.setFeatureState({ source: sourceId, id: feature.id }, { hover: false });
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
      map.setFeatureState({ source: sourceId, id: feature.id }, { hover: false });
    });

    // Set hover state for the specified route
    if (hoveredRouteIndex !== null && hoveredRouteIndex !== undefined) {
      // Find which source contains the hovered route
      const hoveredFeature = allFeatures.find((f) => f.properties.routeIndex === hoveredRouteIndex);
      if (hoveredFeature) {
        const sourceId = topFeatures.includes(hoveredFeature)
          ? 'route-selected'
          : 'routes-unselected';
        map.setFeatureState({ source: sourceId, id: hoveredRouteIndex }, { hover: true });
      }
    }
  }

  /**
   * Filter POIs visible during route planning (only show bike parking and rental stations near destination)
   * Uses Mapbox's native 'within' filter with a circle geometry
   */
  updateNearDestinationPOIs(hasRoutes, destinationCoords, source) {
    const map = this.map;
    if (!map) return;

    const nearDestinationPOIs = ['poi-rental', 'poi-bikeparking'];
    const CIRCLE_SOURCE_ID = 'destination-filter-circle';

    if (hasRoutes && destinationCoords) {
      // Create circle geometry around destination
      const circle = turfCircle(destinationCoords, NEAR_DESTINATION_POI_RADIUS_KM, {
        units: 'kilometers',
      });

      // Create or update temporary circle source
      if (!map.getSource(CIRCLE_SOURCE_ID)) {
        map.addSource(CIRCLE_SOURCE_ID, {
          type: 'geojson',
          data: circle,
        });
      } else {
        map.getSource(CIRCLE_SOURCE_ID).setData(circle);
      }

      // Get POI layers that should remain visible during routes
      const nearDestinationPOILayers = this.props.layers.filter(
        (l) => l.type === 'poi' && nearDestinationPOIs.includes(l.icon)
      );

      // Apply within filter to near-destination POI layers
      nearDestinationPOILayers.forEach((layer) => {
        const originalFilter = this.convertFilterToMapboxFilter(layer, 'osmdata');
        // Combine original filter with within filter
        const withinFilter = ['all', originalFilter, ['within', circle.geometry]];

        // Only apply to GeoJSON source layers (not PMTiles)
        const layerId = layer.id;
        const circlesLayerId = layerId + 'circles';
        const polygonLayerId = layerId + 'polygon';

        // Store original filter if not already stored
        if (!this.originalPOIFilters) {
          this.originalPOIFilters = {};
        }
        if (!this.originalPOIFilters[circlesLayerId]) {
          this.originalPOIFilters[circlesLayerId] = originalFilter;
        }
        if (!this.originalPOIFilters[layerId]) {
          this.originalPOIFilters[layerId] = originalFilter;
        }
        if (!this.originalPOIFilters[polygonLayerId]) {
          this.originalPOIFilters[polygonLayerId] = originalFilter;
        }

        // Apply within filter to all three layer types (circles, symbols, polygons)
        // Only for GeoJSON source layers, skip PMTiles layers
        [circlesLayerId, layerId, polygonLayerId].forEach((id) => {
          if (map.getLayer(id)) {
            try {
              map.setFilter(id, withinFilter);
            } catch (e) {
              console.warn('Error setting within filter for', id, e);
            }
          }
        });
      });
    } else {
      // Remove within filter and restore original filters when routes are cleared
      if (this.originalPOIFilters) {
        const nearDestinationPOILayers = this.props.layers.filter(
          (l) => l.type === 'poi' && nearDestinationPOIs.includes(l.icon)
        );

        nearDestinationPOILayers.forEach((layer) => {
          // Only restore GeoJSON source layers (not PMTiles)
          const layerId = layer.id;
          const circlesLayerId = layerId + 'circles';
          const polygonLayerId = layerId + 'polygon';

          [circlesLayerId, layerId, polygonLayerId].forEach((id) => {
            if (map.getLayer(id) && this.originalPOIFilters[id]) {
              try {
                map.setFilter(id, this.originalPOIFilters[id]);
              } catch (e) {
                console.warn('Error restoring filter for', id, e);
              }
            }
          });
        });

        this.originalPOIFilters = null;
      }

      // Remove circle source when routes are cleared
      if (map.getSource(CIRCLE_SOURCE_ID)) {
        map.removeSource(CIRCLE_SOURCE_ID);
      }
    }
  }

  updateLayerVisibility() {
    const map = this.map;
    if (!map) return;

    const hasRoutes = this.props.routes?.routes?.length > 0;
    const nearDestinationPOIs = ['poi-rental', 'poi-bikeparking']; // POI types visible during routes
    const destinationCoords = this.props.toPoint?.result?.center;

    // Apply within filter for near-destination POIs when routes are active
    this.updateNearDestinationPOIs(hasRoutes, destinationCoords, null);

    // Update layer visibility
    this.props.layers.forEach((layer) => {
      if (layer.type === 'way') {
        ['', '--pmtiles'].forEach((sourceSuffix) => {
          const baseLayerId = layer.id + sourceSuffix;
          const interactiveLayerId = layer.id + '--interactive' + sourceSuffix;
          const routesActiveLayerId = layer.id + '--routes-active' + sourceSuffix;
          const arrowLayerId = baseLayerId + '--arrows';

          // Swap between normal and routes-active variants:
          //   - routesActiveLayerId (idx 1): visible only WITH routes (muted background)
          //   - baseLayerId & interactiveLayerId (idx 0, 2): visible only WITHOUT routes
          [baseLayerId, routesActiveLayerId, interactiveLayerId].forEach((id, idx) => {
            if (!map.getLayer(id)) return;
            const isRoutesActiveLayer = idx === 1;
            const status = isRoutesActiveLayer
              ? layer.isActive && hasRoutes
                ? 'visible'
                : 'none'
              : layer.isActive && !hasRoutes
                ? 'visible'
                : 'none';
            map.setLayoutProperty(id, 'visibility', status);
          });

          // Handle arrow layer visibility (same as base layer)
          if (map.getLayer(arrowLayerId)) {
            const status = layer.isActive && !hasRoutes ? 'visible' : 'none';
            map.setLayoutProperty(arrowLayerId, 'visibility', status);
          }
        });
      } else if (layer.type === 'poi') {
        const isNearDestinationPOI = nearDestinationPOIs.includes(layer.icon);
        const status = !hasRoutes
          ? layer.isActive
            ? 'visible'
            : 'none'
          : isNearDestinationPOI && destinationCoords && layer.isActive
            ? 'visible'
            : 'none';

        ['', '--pmtiles'].forEach((sourceSuffix) => {
          [
            layer.id + sourceSuffix + 'circles',
            layer.id + sourceSuffix,
            layer.id + sourceSuffix + 'polygon',
          ].forEach((id) => {
            if (map.getLayer(id)) {
              map.setLayoutProperty(id, 'visibility', status);
            }
          });
        });
      }
    });

    if (map.getLayer('comentarios')) {
      map.setLayoutProperty('comentarios', 'visibility', hasRoutes ? 'none' : 'visible');
    }
  }

  updateRouteTooltips() {
    if (this.popups) {
      this.popups.updateRouteTooltips(
        this.props.routes,
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

  /**
   * Set map lighting based on real sun position
   */
  setRealisticLighting() {
    if (!this.map) return;

    // Calculate current sun position for map location
    const sunPosition = getCurrentSunPosition(this.props.lat, this.props.lng);

    if (sunPosition.isDaytime) {
      // Convert spherical coordinates to Cartesian coordinates
      // azimuthal: horizontal angle (0-360 degrees)
      // polar: vertical angle (0-90 degrees)
      const azimuthRad = (sunPosition.azimuthal * Math.PI) / 180;
      const polarRad = (sunPosition.polar * Math.PI) / 180;

      const x = Math.sin(polarRad) * Math.cos(azimuthRad);
      const y = Math.sin(polarRad) * Math.sin(azimuthRad);
      const z = Math.cos(polarRad);

      this.map.setLight({
        anchor: 'viewport',
        color: MAP_COLORS.LIGHT_COLOR,
        intensity: 1,
        position: [x, y, z],
      });
      console.debug(
        `Set realistic lighting: azimuthal=${sunPosition.azimuthal.toFixed(1)}°, polar=${sunPosition.polar.toFixed(1)}°`
      );
    }
  }

  componentDidMount() {
    if (isE2E) {
      console.info('E2E mode enabled: skipping Mapbox GL initialization');
      return;
    }

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
        preserveDrawingBuffer: true,
        // style: MAP_STYLES.LIGHT,
        // config: {
        //     basemap: {
        //         lightPreset: this.props.style === MAP_STYLES.DARK ? "night" : "daytime",
        //     }
        // },
        center: [this.props.lng, this.props.lat],
        zoom: this.props.zoom,
        attributionControl: false,
        // dragRotate: false,
        // pitchWithRotate: false
      }).addControl(
        new mapboxgl.AttributionControl({
          compact: false,
        })
      );
    } catch (error) {
      console.error('Error creating Mapbox map:', error);
      // Don't crash the entire app if WebGL isn't available (common in headless browsers).
      this.setState({ webglError: true });
      return;
    }

    if (!this.map) {
      return;
    }

    // Mapbox tracks window resize, but the map container can change size without one
    // (e.g. --viewport-height updates from visualViewport in index.js). ResizeObserver
    // keeps the canvas in sync in those cases.
    if (typeof ResizeObserver !== 'undefined' && this.mapContainer) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.map) this.map.resize();
      });
      this.resizeObserver.observe(this.mapContainer);
    }

    // Pass the map reference to the parent component
    if (this.props.setMapRef) {
      this.props.setMapRef(this.map);
    }

    this.popups = new MapPopups(
      this.map,
      this.props.debugMode,
      this.props.isDarkMode,
      this.props.location
    );

    // Set up global function for popup routing button
    window.setDestinationFromPopup = (coordinates) => {
      if (
        this.props.directionsPanelRef &&
        this.props.directionsPanelRef.setDestinationFromMapClick
      ) {
        this.props.directionsPanelRef.setDestinationFromMapClick(coordinates);
        // Close all popups after setting destination
        this.popups.closeAllPopups();
      }
    };

    this.loadImages();

    // Initialize map after style is loaded
    this.initializeMapAfterStyleLoad();

    // Initialize map center
    const shouldInitializeArea = this.props.zoom >= MAP_AUTOCHANGE_AREA_ZOOM_THRESHOLD;
    if (shouldInitializeArea) {
      this.reverseGeocode([this.props.lng, this.props.lat])
        .then((result) => {
          this.syncMapState(result.place_name);
        })
        .catch((err) => {
          // Reverse geocoding failure is not critical - map can function without it
          console.debug('Reverse geocoding failed during initialization:', err.message);
        });
    } else {
      // Preserve map state without forcing an area when zoomed out.
      this.syncMapState();
    }
  }

  initMapControls() {
    if (!this.props.embedMode) {
      const geolocate = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: IS_MOBILE ? true : false,
        showUserHeading: IS_MOBILE ? true : false,
        // Mapbox only runs _updateCamera when followUserLocation is true, including
        // one-shot desktop mode (trackUserLocation: false). followUserLocation: false
        // here made clicks succeed but the map never moved.
        followUserLocation: true,
      });

      // Store reference to geolocate control
      this.geolocateControl = geolocate;

      geolocate.on('geolocate', (result) => {
        console.debug('geolocate', result);
        this.reverseGeocode([result.coords.longitude, result.coords.latitude])
          .then((geocodeResult) => {
            // this.syncMapState(geocodeResult.place_name);
            this.syncMapState();
            // Update lighting based on user's actual location
            this.setRealisticLighting();
          })
          .catch((err) => {
            console.debug('Reverse geocoding failed:', err.message);
          });
      });

      // Listen to tracking events to sync state for persistence
      // The control handles all button clicks and tracking logic internally
      // We just sync the state to React for localStorage persistence
      if (IS_MOBILE && this.props.onTrackingUserLocationChange) {
        geolocate.on('trackuserlocationstart', () => {
          console.debug('Geolocation tracking started');
          this.props.onTrackingUserLocationChange(true);
        });

        geolocate.on('trackuserlocationend', () => {
          console.debug('Geolocation tracking ended (user moved map or stopped tracking)');
          this.props.onTrackingUserLocationChange(false);
        });

        // Handle errors (e.g., permission denied) - stop tracking state
        geolocate.on('error', (error) => {
          console.debug('Geolocation error:', error);
          if (this.props.isTrackingUserLocation) {
            this.props.onTrackingUserLocationChange(false);
          }
        });
      }

      this.map.addControl(geolocate, 'bottom-right');
      const geolocateButton = geolocate._container?.querySelector('button');
      if (geolocateButton) geolocateButton.setAttribute('aria-label', 'Mostrar minha localização');

      // Restore tracking state if it was active before
      // Note: trigger() will start tracking if trackUserLocation is true
      // It may prompt for permission if not already granted
      if (
        IS_MOBILE &&
        this.props.isTrackingUserLocation &&
        this.props.onTrackingUserLocationChange
      ) {
        // Wait for the control to be fully initialized and added to the map
        // Use a longer timeout to ensure the control is ready
        setTimeout(() => {
          try {
            if (geolocate && typeof geolocate.trigger === 'function') {
              geolocate.trigger();
              console.debug('Restored geolocation tracking from localStorage');
            } else {
              console.debug('Geolocate control not ready for restoration');
            }
          } catch (error) {
            console.debug('Could not restore geolocation tracking:', error);
            // If restoration fails, update state to false to avoid stuck state
            this.props.onTrackingUserLocationChange(false);
          }
        }, 1000);
      }

      this.initCompassControl();

      // this.map.addControl(new mapboxgl.FullscreenControl({
      //     container: document.querySelector('body')
      // }), 'bottom-right');
    }
  }

  initCompassControl() {
    const navigationControl = new mapboxgl.NavigationControl({
      showCompass: true,
      showZoom: false,
      visualizePitch: true,
    });
    this.map.addControl(navigationControl, 'right');

    const compassControlContainer = navigationControl._container;
    const compassButton = navigationControl._container?.querySelector('.mapboxgl-ctrl-compass');
    if (!compassControlContainer) return;
    compassControlContainer.classList.add('ciclomapa-compass-control');
    if (compassButton) compassButton.setAttribute('aria-label', 'Reorientar mapa ao norte');

    const rotationOrPitchThreshold = 0.1;
    const normalizeBearing = (bearing) => {
      const normalized = ((bearing % 360) + 360) % 360;
      return normalized > 180 ? normalized - 360 : normalized;
    };

    const updateCompassVisibility = () => {
      const hasRotation =
        Math.abs(normalizeBearing(this.map.getBearing())) > rotationOrPitchThreshold;
      const hasPitch = this.map.getPitch() > rotationOrPitchThreshold;
      const shouldShowCompass = hasRotation || hasPitch;
      compassControlContainer.classList.toggle('is-visible', shouldShowCompass);

      if (compassButton) {
        compassButton.setAttribute('aria-hidden', shouldShowCompass ? 'false' : 'true');
      }
    };

    updateCompassVisibility();
    this.map.on('rotate', updateCompassVisibility);
    this.map.on('pitch', updateCompassVisibility);
    this.map.on('rotateend', updateCompassVisibility);
    this.map.on('pitchend', updateCompassVisibility);
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
    this.setRealisticLighting();
    this.updateBoundaryMask();
    if (this.props.globalSearchPin) {
      this.applyGlobalSearchPin(this.props.globalSearchPin);
    }
  }

  loadImages() {
    // Load comment icons if not already loaded
    if (!this.map.hasImage('commentIcon')) {
      this.map.loadImage(iconsMap['poi-comment'], (error, image) => {
        if (error) throw error;
        this.map.addImage('commentIcon', image);
      });
    }
    if (!this.map.hasImage('commentIcon--light')) {
      this.map.loadImage(iconsMap['poi-comment--light'], (error, image) => {
        if (error) throw error;
        this.map.addImage('commentIcon--light', image);
      });
    }

    // Load all other icons if not already loaded
    Object.keys(iconsMap).forEach((key) => {
      if (!this.map.hasImage(key)) {
        this.map.loadImage(iconsMap[key], (error, image) => {
          if (error) throw error;
          this.map.addImage(key, image);
        });
      }
    });

    this.map.loadImage(arrowSdf, (error, image) => {
      if (error) throw error;
      this.map.addImage('arrowSdf', image, { sdf: true });
    });

    Object.entries(arrowIcons).forEach(([key, src]) => {
      this.map.loadImage(src, (error, image) => {
        if (error) throw error;
        this.map.addImage(key, image);
      });
    });
  }

  async initLayers() {
    // The order in which layers are initialized will define their paint order
    await this.initGeojsonLayers(this.props.layers);

    this.initRoutesLayers();

    if (ENABLE_COMMENTS) {
      this.initCommentsLayer();
    }

    // Restore current routes if they exist
    if (this.props.routes) {
      this.updateRoutesLayer(this.props.routes);
      if (this.props.hoveredRouteIndex !== null && this.props.hoveredRouteIndex !== undefined) {
        this.updateHoveredRoute(this.props.hoveredRouteIndex);
      }
    }

    this.syncMapState();

    // Initial way/POI visibility for route mode (updateRoutesLayer already set sources).
    this.updateLayerVisibility();

    this.map.on('moveend', this.debouncedOnMapMoveEnded);
  }

  componentWillUnmount() {
    if (this.resizeObserver) {
      try {
        this.resizeObserver.disconnect();
      } catch {
        // ignore
      }
      this.resizeObserver = null;
    }

    if (this.popups) {
      this.popups.clearRouteTooltips();
    }
    document.removeEventListener('newComment', this.newComment);
    document.removeEventListener('ciclomapa-comment-at', this.openCommentAtCoordinates);

    if (this.globalSearchMarker) {
      try {
        this.globalSearchMarker.remove();
      } catch (e) {
        /* ignore */
      }
      this.globalSearchMarker = null;
    }
    if (this.popups) {
      this.popups.searchResultPopup?.off?.('close', this._onSearchResultPopupClosed);
    }

    // Cancel any pending debounced calls
    if (this.debouncedOnMapMoveEnded) {
      this.debouncedOnMapMoveEnded.cancel();
    }
    if (this.debouncedMapStateSync) {
      this.debouncedMapStateSync.cancel();
    }

    if (this.map) {
      // Remove all event listeners to prevent memory leaks
      this.map.off();

      // Remove all layers
      const style = this.map.getStyle();
      if (style && style.layers) {
        style.layers.forEach((layer) => {
          if (this.map.getLayer(layer.id)) {
            this.map.removeLayer(layer.id);
          }
        });
      }

      // Remove all sources
      if (style && style.sources) {
        Object.keys(style.sources).forEach((sourceId) => {
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
      this.map.once('click', (e) => {
        this.newCommentCoords = e.lngLat;
        this.showCommentModal();
      });
    });
  }

  render() {
    return (
      <>
        {/* Thanks https://blog.mapbox.com/mapbox-gl-js-react-764da6cc074a */}
        <div data-testid="map-container" ref={(el) => (this.mapContainer = el)}></div>

        {ENABLE_COMMENTS && this.state.showCommentCursor && (
          <NewCommentCursor isDarkMode={this.props.isDarkMode} />
        )}

        {ENABLE_COMMENTS && (
          <CommentModal
            location={this.props.location}
            open={this.state.showCommentModal}
            tagsList={this.state.tagsList}
            coords={this.newCommentCoords}
            z={this.props.z}
            airtableDatabase={this.airtableDatabase}
            afterCreate={this.afterCommentCreate}
            onCancel={this.hideCommentModal}
          />
        )}
      </>
    );
  }
}

// Wrapper component to use the directions context with the class component
const MapWrapper = React.forwardRef((props, ref) => {
  const directionsContext = useDirections();

  return (
    <Map
      ref={ref}
      {...props}
      routes={directionsContext.directions}
      selectedRouteIndex={directionsContext.selectedRouteIndex}
      hoveredRouteIndex={directionsContext.hoveredRouteIndex}
      onRouteSelected={directionsContext.selectRoute}
      onRouteHovered={directionsContext.hoverRoute}
      isInRouteMode={directionsContext.isInRouteMode}
    />
  );
});

export default MapWrapper;
