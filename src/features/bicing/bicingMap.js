/**
 * Bicing on the map: marker images, OSM Estações sync, live overlay controller,
 * and the availability HTML used in popups.
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { HiOutlineBolt, HiOutlineCog } from 'react-icons/hi2';
import debounce from 'lodash.debounce';

import {
  createBicingLiveFeed,
  distanceMeters,
  matchStationForOsmPoi,
  stationsToGeoJSON,
} from './bicingGbfs.js';

export const BICING_ORANGE = '#E56119';
export const BICING_SOURCE_ID = 'bicingAvailabilitySrc';
export const BICING_LAYER_ID = 'bicing-availability';

const OSM_MATCH_MAX_M = 60;
const OSM_AREA_MAX_M = 8000;
const BicingRelation = { NONE: 0, MATCHED: 1, UNMATCHED: 2 };

const MARKER_TEXT_FONT = ['Inter Medium'];
const IMAGE_IDS = {
  marker: 'bicing-marker-v10',
  glyphBike: 'bicing-glyph-bike-v10',
  glyphBikeDim: 'bicing-glyph-bike-dim-v10',
  glyphDock: 'bicing-glyph-dock-v10',
  glyphDockDim: 'bicing-glyph-dock-dim-v10',
};
const GLYPH_COLOR = '#ffffff';
/** Marker/popup dim when bikes or docks are at or below this count. */
const DIM_COUNT_AT_OR_BELOW = 2;
/** Matches popup low-count opacity */
const GLYPH_COLOR_DIM = 'rgba(255,255,255,0.5)';

// --- Icons -----------------------------------------------------------------

const BIKE_PATH =
  'M7.5 2.00001C6.8239 1.99001 6.8239 3.00961 7.5 3.00001H9V4.26561L6.1973 6.59961L5.2226 4.00001H5.5C6.1761 4.01001 6.1761 2.99041 5.5 3.00001H3.5C2.8239 2.99001 2.8239 4.00961 3.5 4.00001H4.1523L5.043 6.37501C4.5752 6.14241 4.0559 6.00001 3.5 6.00001C1.5729 6.00001 0 7.57291 0 9.50001C0 11.4271 1.5729 13 3.5 13C5.4271 13 7 11.4271 7 9.50001C7 8.83011 6.7997 8.20891 6.4707 7.67581L9.291 5.32621L9.7539 6.48641C8.7114 7.09371 8 8.21121 8 9.50001C8 11.4271 9.5729 13 11.5 13C13.4271 13 15 11.4271 15 9.50001C15 7.57291 13.4271 6.00001 11.5 6.00001C11.2169 6.00001 10.9456 6.04341 10.6816 6.10741L10 4.40231V2.50001C10 2.22391 9.7761 2.00001 9.5 2.00001H7.5ZM3.5 7.00001C4.0923 7.00001 4.6276 7.21191 5.0547 7.55271L3.1797 9.11521C2.6688 9.54251 3.3075 10.3097 3.8203 9.88471L5.6953 8.32221C5.8835 8.67401 6 9.07111 6 9.50001C6 10.8866 4.8866 12 3.5 12C2.1134 12 1 10.8866 1 9.50001C1 8.11341 2.1133 7.00001 3.5 7.00001ZM11.5 7.00001C12.8866 7.00001 14 8.11341 14 9.50001C14 10.8866 12.8866 12 11.5 12C10.1134 12 9 10.8866 9 9.50001C9 8.62301 9.4468 7.85791 10.125 7.41211L11.0352 9.68551C11.2812 10.3086 12.2156 9.93561 11.9649 9.31441L11.0567 7.04491C11.2009 7.01931 11.3481 7.00001 11.5 7.00001Z';

function bikeSvg({ size, color, className = '' }) {
  const cls = className ? ` class="${className}"` : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"${cls}><path d="${BIKE_PATH}" fill="${color}"/></svg>`;
}

function parkingSvg({ size, color, className = '' }) {
  const cls = className ? ` class="${className}"` : '';
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" ` +
    `stroke-width="2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"${cls}>` +
    `<circle cx="12" cy="12" r="10"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></svg>`
  );
}

function popupTypeIcon(kind) {
  if (kind === 'dock') {
    return parkingSvg({ size: 16, color: 'currentColor', className: 'w-4 h-4 shrink-0' });
  }
  const Icon = kind === 'ebike' ? HiOutlineBolt : HiOutlineCog;
  return renderToStaticMarkup(
    React.createElement(Icon, { className: 'w-4 h-4 shrink-0', 'aria-hidden': true })
  );
}

// --- Stretchable bubble marker ---------------------------------------------

const BUBBLE = {
  width: 96,
  height: 48,
  pixelRatio: 2,
  labelBox: [10, 3, 86, 35],
  stretchX: [
    [26, 40],
    [56, 70],
  ],
  stretchY: [[10, 30]],
};
const LABEL_PADDING = [1, 2, 3, 2];
const LABEL_FONT_SIZE = 12;
const ICON = { size: 26, pixelRatio: 2, gapAfterIconPx: 2, gapBetweenGroupsPx: 6 };
const tipHeightCssPx = (BUBBLE.height - BUBBLE.labelBox[3]) / BUBBLE.pixelRatio;
const MARKER_LAYOUT = {
  iconTextFitPadding: LABEL_PADDING,
  textSize: LABEL_FONT_SIZE,
  textAnchor: 'bottom',
  textOffset: [0, -(LABEL_PADDING[2] + tipHeightCssPx) / LABEL_FONT_SIZE],
};

function toDataUrl(svg) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function withHorizontalPadding(innerSvg, { size, paddingLeft = 0, paddingRight = 0 }) {
  const openAttrs = innerSvg.match(/^<svg([^>]*)>/i)?.[1] || '';
  const viewBox = openAttrs.match(/viewBox="([^"]+)"/i)?.[1] || '0 0 24 24';
  const body = innerSvg.replace(/^[\s\S]*?<svg[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
  const presentation = ['stroke', 'fill', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']
    .map((attr) => {
      const value = openAttrs.match(new RegExp(`\\b${attr}="([^"]*)"`, 'i'))?.[1];
      return value != null ? `${attr}="${value}"` : null;
    })
    .filter(Boolean)
    .join(' ');
  const width = size + paddingLeft + paddingRight;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${size}" viewBox="0 0 ${width} ${size}">
  <svg x="${paddingLeft}" y="0" width="${size}" height="${size}" viewBox="${viewBox}" ${presentation} xmlns="http://www.w3.org/2000/svg">${body}</svg>
</svg>`;
}

function addMapImage(map, id, dataUrl, options = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      try {
        if (map.hasImage(id)) map.removeImage(id);
        map.addImage(id, img, options);
        resolve();
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error(`Failed to load map image ${id}`));
    img.src = dataUrl;
  });
}

async function ensureMapImages(map) {
  const gapAfter = ICON.gapAfterIconPx * ICON.pixelRatio;
  const gapBeforeParking = ICON.gapBetweenGroupsPx * ICON.pixelRatio;
  const bubbleSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${BUBBLE.width}" height="${BUBBLE.height}" viewBox="0 0 ${BUBBLE.width} ${BUBBLE.height}">
  <path fill="${BICING_ORANGE}" d="M14 0h68a14 14 0 0 1 14 14v8a14 14 0 0 1-14 14H54l-6 12-6-12H14A14 14 0 0 1 0 22v-8A14 14 0 0 1 14 0z"/>
</svg>`;

  const bikeGlyph = (color) =>
    withHorizontalPadding(bikeSvg({ size: ICON.size, color }), {
      size: ICON.size,
      paddingRight: gapAfter,
    });
  const dockGlyph = (color) =>
    withHorizontalPadding(parkingSvg({ size: ICON.size, color }), {
      size: ICON.size,
      paddingLeft: gapBeforeParking,
      paddingRight: gapAfter,
    });

  const glyphOpts = { pixelRatio: ICON.pixelRatio };
  await Promise.all([
    addMapImage(map, IMAGE_IDS.marker, toDataUrl(bubbleSvg), {
      pixelRatio: BUBBLE.pixelRatio,
      stretchX: BUBBLE.stretchX,
      stretchY: BUBBLE.stretchY,
      content: BUBBLE.labelBox,
    }),
    addMapImage(map, IMAGE_IDS.glyphBike, toDataUrl(bikeGlyph(GLYPH_COLOR)), glyphOpts),
    addMapImage(map, IMAGE_IDS.glyphBikeDim, toDataUrl(bikeGlyph(GLYPH_COLOR_DIM)), glyphOpts),
    addMapImage(map, IMAGE_IDS.glyphDock, toDataUrl(dockGlyph(GLYPH_COLOR)), glyphOpts),
    addMapImage(map, IMAGE_IDS.glyphDockDim, toDataUrl(dockGlyph(GLYPH_COLOR_DIM)), glyphOpts),
  ]);
}

// --- OSM Estações vs Bicing ------------------------------------------------

function osmFeatureId(feature) {
  return feature.id ?? feature.properties?.id ?? feature.properties?.['@id'] ?? null;
}

function featurePointLngLat(feature) {
  const coords = feature.geometry?.coordinates;
  if (feature.geometry?.type === 'Point' && Array.isArray(coords)) {
    return { lng: coords[0], lat: coords[1] };
  }
  if (feature.geometry?.type === 'Polygon' && coords?.[0]?.[0]) {
    return { lng: coords[0][0][0], lat: coords[0][0][1] };
  }
  return null;
}

export function circleOpacityWithBicing(visibleExpr) {
  return [
    'case',
    [
      '==',
      ['coalesce', ['feature-state', 'bicingRelation'], BicingRelation.NONE],
      BicingRelation.UNMATCHED,
    ],
    0,
    visibleExpr,
  ];
}

export function symbolOpacityWithBicing(visibleExpr) {
  return [
    'case',
    [
      '!=',
      ['coalesce', ['feature-state', 'bicingRelation'], BicingRelation.NONE],
      BicingRelation.NONE,
    ],
    0,
    visibleExpr,
  ];
}

export function isOsmFeatureSuppressedForBicing(
  map,
  feature,
  { sourceId, sourceLayer, zoomThreshold }
) {
  if (!feature) return false;
  const featureId = osmFeatureId(feature);
  if (featureId == null) return false;
  try {
    const rel = map.getFeatureState({
      source: sourceId,
      sourceLayer,
      id: featureId,
    })?.bicingRelation;
    if (rel === BicingRelation.UNMATCHED) return true;
    if (rel === BicingRelation.MATCHED && map.getZoom() >= (zoomThreshold || 15)) return true;
    return false;
  } catch {
    return false;
  }
}

function syncOsmEstacoesBicingRelation(map, stations) {
  if (!map?.getSource('pmtiles-source') || !stations?.length) return;

  let features = [];
  try {
    features = map.querySourceFeatures('pmtiles-source', {
      sourceLayer: 'default',
      filter: ['==', ['get', 'amenity'], 'bicycle_rental'],
    });
  } catch (err) {
    console.debug('querySourceFeatures for Estações failed:', err);
    return;
  }

  for (const feature of features) {
    const featureId = osmFeatureId(feature);
    const point = featurePointLngLat(feature);
    if (featureId == null || !point || !Number.isFinite(point.lng) || !Number.isFinite(point.lat)) {
      continue;
    }

    let nearestM = Infinity;
    for (const s of stations) {
      if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon)) continue;
      nearestM = Math.min(nearestM, distanceMeters(point.lat, point.lng, s.lat, s.lon));
    }

    let bicingRelation = BicingRelation.NONE;
    if (nearestM <= OSM_MATCH_MAX_M) bicingRelation = BicingRelation.MATCHED;
    else if (nearestM <= OSM_AREA_MAX_M) bicingRelation = BicingRelation.UNMATCHED;

    try {
      map.setFeatureState(
        { source: 'pmtiles-source', sourceLayer: 'default', id: featureId },
        { bicingRelation }
      );
    } catch {
      // Some tiles lack a promotable feature id.
    }
  }
}

// --- Popup HTML ------------------------------------------------------------

export function formatBicingAgeLabel(lastReportedMs, nowMs = Date.now()) {
  if (lastReportedMs == null) return '';
  const ageSec = Math.max(0, Math.round((nowMs - lastReportedMs) / 1000));
  if (ageSec < 60) return `há ${ageSec}s`;
  if (ageSec < 3600) return `há ${Math.round(ageSec / 60)}min`;
  return `há ${Math.round(ageSec / 3600)}h`;
}

export function renderBicingAvailabilityHtml(station) {
  if (!station) return '';
  const { docks, mechanical: mech, ebike, isRenting, isReturning } = station;
  const closed = !isRenting || !isReturning;
  const statusParts = [];
  if (!isRenting) statusParts.push('Sem aluguel');
  if (!isReturning) statusParts.push('Sem devolução');

  return `
    <div class="mt-4 mb-1">
      <div class="grid grid-cols-3 gap-3">
        <div class="min-w-0">
          <div class="text-3xl font-semibold tabular-nums leading-none tracking-tight">${ebike}</div>
          <div class="mt-1.5 flex items-center gap-1 text-xs opacity-55 leading-snug">
            ${popupTypeIcon('ebike')}
            <span>Elétricas</span>
          </div>
        </div>
        <div class="min-w-0">
          <div class="text-3xl font-semibold tabular-nums leading-none tracking-tight">${mech}</div>
          <div class="mt-1.5 flex items-center gap-1 text-xs opacity-55 leading-snug">
            ${popupTypeIcon('mechanical')}
            <span>Mecânicas</span>
          </div>
        </div>
        <div class="min-w-0">
          <div class="text-3xl font-semibold tabular-nums leading-none tracking-tight">${docks}</div>
          <div class="mt-1.5 flex items-center gap-1 text-xs opacity-55 leading-snug">
            ${popupTypeIcon('dock')}
            <span>Vagas</span>
          </div>
        </div>
      </div>
      ${
        closed
          ? `<div class="mt-2 text-xs font-medium" style="color:${BICING_ORANGE}">${statusParts.join(' · ')}</div>`
          : ''
      }
    </div>
  `;
}

// --- Map controller --------------------------------------------------------

/**
 * @param {object} options
 * @param {() => boolean} options.shouldShow
 * @param {() => boolean} options.isInRouteMode
 * @param {() => boolean} options.isDarkMode
 * @param {() => number} [options.getSymbolMinZoom] — Estações zoomThreshold from layers.json
 * @param {(station: object) => void} options.onStationClick
 */
export function createBicingMapController(map, options) {
  let feed = null;
  let layerListenersBound = false;

  const syncOsmDebounced = debounce(() => {
    syncOsmEstacoesBicingRelation(map, feed?.getStations() || []);
  }, 150);

  function onSourceData(e) {
    if (e.sourceId !== 'pmtiles-source') return;
    if (e.dataType === 'source' && e.sourceDataType === 'content') syncOsmDebounced();
  }

  function applyStations(stations) {
    const source = map.getSource(BICING_SOURCE_ID);
    if (!source) return;
    source.setData(stationsToGeoJSON(stations || []));
    updateVisibility();
    syncOsmEstacoesBicingRelation(map, stations || []);
  }

  function updateVisibility() {
    if (!map.getLayer(BICING_LAYER_ID)) return;
    map.setLayoutProperty(BICING_LAYER_ID, 'visibility', options.shouldShow() ? 'visible' : 'none');
  }

  function ensureFeed() {
    if (!feed) feed = createBicingLiveFeed({ onUpdate: applyStations });
    if (!feed.isRunning()) feed.start();
  }

  function bindLayerInteractions() {
    if (layerListenersBound) return;
    layerListenersBound = true;
    map.on('mouseenter', BICING_LAYER_ID, () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', BICING_LAYER_ID, () => {
      map.getCanvas().style.cursor = '';
    });
    map.on('click', BICING_LAYER_ID, (e) => {
      if (!e.features?.length) return;
      if (options.isInRouteMode()) {
        e.originalEvent?.preventDefault?.();
        return;
      }
      const stationId = e.features[0].properties?.stationId;
      const station = feed?.getStations().find((s) => s.stationId === String(stationId));
      if (!station) return;
      options.onStationClick?.(station);
    });
  }

  async function addLayer() {
    if (map.getLayer(BICING_LAYER_ID)) map.removeLayer(BICING_LAYER_ID);

    let iconsReady = false;
    try {
      await ensureMapImages(map);
      iconsReady = true;
    } catch (err) {
      console.warn('Bicing map icons failed to load, showing counts only:', err);
    }

    const bikesTextColor = [
      'case',
      ['<=', ['get', 'bikes'], DIM_COUNT_AT_OR_BELOW],
      GLYPH_COLOR_DIM,
      GLYPH_COLOR,
    ];
    const docksTextColor = [
      'case',
      ['<=', ['get', 'docks'], DIM_COUNT_AT_OR_BELOW],
      GLYPH_COLOR_DIM,
      GLYPH_COLOR,
    ];
    // bike icon + elétricas · mecânicas · dock icon + vagas
    const countsFormat = iconsReady
      ? [
          'format',
          [
            'case',
            ['<=', ['get', 'bikes'], DIM_COUNT_AT_OR_BELOW],
            ['image', IMAGE_IDS.glyphBikeDim],
            ['image', IMAGE_IDS.glyphBike],
          ],
          ['to-string', ['get', 'ebike']],
          { 'text-color': bikesTextColor },
          ' · ',
          { 'text-color': bikesTextColor },
          ['to-string', ['get', 'mechanical']],
          { 'text-color': bikesTextColor },
          [
            'case',
            ['<=', ['get', 'docks'], DIM_COUNT_AT_OR_BELOW],
            ['image', IMAGE_IDS.glyphDockDim],
            ['image', IMAGE_IDS.glyphDock],
          ],
          ['to-string', ['get', 'docks']],
          { 'text-color': docksTextColor },
        ]
      : [
          'format',
          ['to-string', ['get', 'ebike']],
          { 'text-color': bikesTextColor },
          ' · ',
          { 'text-color': bikesTextColor },
          ['to-string', ['get', 'mechanical']],
          { 'text-color': bikesTextColor },
          ' · ',
          ['to-string', ['get', 'docks']],
          { 'text-color': docksTextColor },
        ];

    map.addLayer({
      id: BICING_LAYER_ID,
      type: 'symbol',
      source: BICING_SOURCE_ID,
      minzoom: options.getSymbolMinZoom?.() ?? 15,
      layout: {
        visibility: 'none',
        'icon-image': iconsReady
          ? IMAGE_IDS.marker
          : options.isDarkMode()
            ? 'poi-rental'
            : 'poi-rental--light',
        'icon-text-fit': iconsReady ? 'both' : 'none',
        'icon-text-fit-padding': iconsReady ? MARKER_LAYOUT.iconTextFitPadding : [0, 0, 0, 0],
        'icon-size': iconsReady ? 1 : 0.5,
        'icon-anchor': 'bottom',
        // Always show every station (no collision hiding). Mapbox still draws icons
        // and text in separate passes, so overlapping labels can interleave.
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'text-field': countsFormat,
        'text-font': MARKER_TEXT_FONT,
        'text-size': MARKER_LAYOUT.textSize,
        'text-anchor': iconsReady ? MARKER_LAYOUT.textAnchor : 'center',
        'text-offset': iconsReady ? MARKER_LAYOUT.textOffset : [0, 0],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
        'symbol-sort-key': ['get', 'bikes'],
      },
      paint: {
        'icon-opacity': 1,
        'text-color': '#ffffff',
        'text-halo-width': 0,
      },
    });

    bindLayerInteractions();
  }

  return {
    async init() {
      if (!map.getSource(BICING_SOURCE_ID)) {
        map.addSource(BICING_SOURCE_ID, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
      }
      await addLayer();
      ensureFeed();
      if (feed.getStations().length) applyStations(feed.getStations());
      updateVisibility();
      map.on('data', onSourceData);
    },
    updateVisibility,
    syncOsm: () => syncOsmDebounced(),
    matchStationForPoi(opts) {
      return matchStationForOsmPoi(feed?.getStations() || [], opts);
    },
    destroy() {
      syncOsmDebounced.cancel();
      map.off('data', onSourceData);
      feed?.stop();
      feed = null;
    },
  };
}
