/**
 * Bicing on the map: marker images, OSM Estações sync, live overlay controller,
 * and the availability HTML used in popups.
 */

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
  markerLight: 'bicing-marker-light-v27',
  markerDark: 'bicing-marker-dark-v27',
  glyphBolt: 'bicing-glyph-bolt-v27',
  glyphBoltDim: 'bicing-glyph-bolt-dim-v27',
  glyphBoltFollow: 'bicing-glyph-bolt-follow-v27',
  glyphBoltFollowDim: 'bicing-glyph-bolt-follow-dim-v27',
  glyphBike: 'bicing-glyph-bike-v27',
  glyphBikeDim: 'bicing-glyph-bike-dim-v27',
  glyphDock: 'bicing-glyph-dock-v27',
  glyphDockDim: 'bicing-glyph-dock-dim-v27',
};
const MARKER_BORDER_LIGHT = '#ffffff';
const MARKER_BORDER_DARK = '#000000';
const GLYPH_COLOR = '#ffffff';
/** Marker/popup dim when bikes or docks are at or below this count. */
const DIM_COUNT_AT_OR_BELOW = 2;
/** Matches popup low-count opacity */
const GLYPH_COLOR_DIM = 'rgba(255,255,255,0.5)';

// --- Icons -----------------------------------------------------------------

/** Maki “bicycle” (Mapbox) — https://github.com/mapbox/maki — inlined for Mapbox glyph images. */
const BIKE_PATH =
  'M7.5 2.00001C6.8239 1.99001 6.8239 3.00961 7.5 3.00001H9V4.26561L6.1973 6.59961L5.2226 4.00001H5.5C6.1761 4.01001 6.1761 2.99041 5.5 3.00001H3.5C2.8239 2.99001 2.8239 4.00961 3.5 4.00001H4.1523L5.043 6.37501C4.5752 6.14241 4.0559 6.00001 3.5 6.00001C1.5729 6.00001 0 7.57291 0 9.50001C0 11.4271 1.5729 13 3.5 13C5.4271 13 7 11.4271 7 9.50001C7 8.83011 6.7997 8.20891 6.4707 7.67581L9.291 5.32621L9.7539 6.48641C8.7114 7.09371 8 8.21121 8 9.50001C8 11.4271 9.5729 13 11.5 13C13.4271 13 15 11.4271 15 9.50001C15 7.57291 13.4271 6.00001 11.5 6.00001C11.2169 6.00001 10.9456 6.04341 10.6816 6.10741L10 4.40231V2.50001C10 2.22391 9.7761 2.00001 9.5 2.00001H7.5ZM3.5 7.00001C4.0923 7.00001 4.6276 7.21191 5.0547 7.55271L3.1797 9.11521C2.6688 9.54251 3.3075 10.3097 3.8203 9.88471L5.6953 8.32221C5.8835 8.67401 6 9.07111 6 9.50001C6 10.8866 4.8866 12 3.5 12C2.1134 12 1 10.8866 1 9.50001C1 8.11341 2.1133 7.00001 3.5 7.00001ZM11.5 7.00001C12.8866 7.00001 14 8.11341 14 9.50001C14 10.8866 12.8866 12 11.5 12C10.1134 12 9 10.8866 9 9.50001C9 8.62301 9.4468 7.85791 10.125 7.41211L11.0352 9.68551C11.2812 10.3086 12.2156 9.93561 11.9649 9.31441L11.0567 7.04491C11.2009 7.01931 11.3481 7.00001 11.5 7.00001Z';

/** E-bike marker glyph (15×15 filled) — Maki-style bike + charge cue. */
const EBIKE_PATHS = [
  'M9.5 2.00018C9.7761 2.00018 10 2.22408 10 2.50018V4.40252L10.0068 4.42108C10.0795 6.23641 10.7344 7.78535 11.6621 8.5578L11.9648 9.31463C12.2152 9.93563 11.2813 10.3085 11.0352 9.68573L10.125 7.41229C9.44686 7.8581 9 8.62323 9 9.50018C9.00012 10.8867 10.1135 12.0002 11.5 12.0002C12.8865 12.0002 13.9999 10.8867 14 9.50018C14 9.27367 13.9669 9.05513 13.9111 8.84686C14.2081 8.68911 14.4846 8.45669 14.7334 8.16229C14.9051 8.57479 15 9.0269 15 9.50018C14.9999 11.4272 13.427 13.0002 11.5 13.0002C9.57297 13.0002 8.00012 11.4272 8 9.50018C8 8.2114 8.71144 7.09382 9.75391 6.48651L9.29102 5.32635L6.4707 7.67596C6.79965 8.20903 7 8.83034 7 9.50018C6.99988 11.4272 5.42703 13.0002 3.5 13.0002C1.57297 13.0002 0.000119802 11.4272 0 9.50018C0 7.57308 1.5729 6.00018 3.5 6.00018C4.0559 6.00018 4.57517 6.14258 5.04297 6.37518L4.15234 4.00018H3.5C2.8239 4.00978 2.8239 2.99018 3.5 3.00018H5.5C6.1761 2.99058 6.1761 4.01018 5.5 4.00018H5.22266L6.19727 6.59979L9 4.2658V3.00018H7.5C6.8239 3.00978 6.8239 1.99018 7.5 2.00018H9.5ZM3.5 7.00018C2.1133 7.00018 1 8.11358 1 9.50018C1.00012 10.8867 2.11347 12.0002 3.5 12.0002C4.88653 12.0002 5.99988 10.8867 6 9.50018C6 9.07137 5.88344 8.67419 5.69531 8.32245L3.82031 9.88495C3.30758 10.3097 2.66907 9.5427 3.17969 9.11541L5.05469 7.55291C4.62759 7.21211 4.0923 7.00018 3.5 7.00018Z',
  'M12.7502 8.33333L12.7502 5L11.0835 5L13.5835 -4.87765e-06L13.5835 3.33333L15.2502 3.33333L12.7502 8.33333Z',
];

function bikeSvg({ size, color, className = '' }) {
  const cls = className ? ` class="${className}"` : '';
  return `<svg width="${size}" height="${size}" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"${cls}><path d="${BIKE_PATH}" fill="${color}"/></svg>`;
}

function boltSvg({ size, color, className = '' }) {
  const cls = className ? ` class="${className}"` : '';
  const paths = EBIKE_PATHS.map((d) => `<path d="${d}" fill="${color}"/>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"${cls}>${paths}</svg>`;
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
  if (kind === 'ebike') {
    return boltSvg({ size: 16, color: 'currentColor', className: 'w-4 h-4 shrink-0' });
  }
  return bikeSvg({ size: 16, color: 'currentColor', className: 'w-4 h-4 shrink-0' });
}

// --- Stretchable bubble marker ---------------------------------------------

/** Unpadded bubble path (96×48). Canvas grows by borderPad so the stroke isn’t clipped. */
const BUBBLE_PATH =
  'M14 0h68a14 14 0 0 1 14 14v8a14 14 0 0 1-14 14H54l-6 12-6-12H14A14 14 0 0 1 0 22v-8A14 14 0 0 1 14 0z';
/** 1 CSS px outer border → 2 SVG units at pixelRatio 2; pad = half stroke. */
const BUBBLE_BORDER_SVG = 2;
const BUBBLE_BORDER_PAD = BUBBLE_BORDER_SVG / 2;
const BUBBLE = {
  width: 96 + BUBBLE_BORDER_SVG,
  height: 48 + BUBBLE_BORDER_SVG,
  pixelRatio: 2,
  labelBox: [
    10 + BUBBLE_BORDER_PAD,
    3 + BUBBLE_BORDER_PAD,
    86 + BUBBLE_BORDER_PAD,
    35 + BUBBLE_BORDER_PAD,
  ],
  stretchX: [
    [26 + BUBBLE_BORDER_PAD, 40 + BUBBLE_BORDER_PAD],
    [56 + BUBBLE_BORDER_PAD, 70 + BUBBLE_BORDER_PAD],
  ],
  stretchY: [[10 + BUBBLE_BORDER_PAD, 30 + BUBBLE_BORDER_PAD]],
};

function bubbleMarkerSvg(borderColor) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BUBBLE.width}" height="${BUBBLE.height}" viewBox="0 0 ${BUBBLE.width} ${BUBBLE.height}">
  <path fill="${BICING_ORANGE}" stroke="${borderColor}" stroke-width="${BUBBLE_BORDER_SVG}" stroke-linejoin="round" transform="translate(${BUBBLE_BORDER_PAD},${BUBBLE_BORDER_PAD})" d="${BUBBLE_PATH}"/>
</svg>`;
}
const LABEL_PADDING = [1, 2, 3, 2];
const LABEL_FONT_SIZE = 12;
const ICON = { size: 26, pixelRatio: 2, gapAfterIconPx: 2, gapBetweenGroupsPx: 6 };
/** Same draw size as mechanical bike; 16×16 e-bike artwork scales into this slot. */
const BOLT_ICON = { size: 26, gapAfterPx: 2 };
/** Slightly smaller than bike glyphs — the P-in-circle reads larger at equal size. */
const DOCK_ICON = { size: 25 };
/**
 * Mapbox `format` pins image bottoms to the text baseline, so glyphs sit a bit low
 * next to digits. Transparent bottom padding lifts the drawn icon to match.
 */
const GLYPH_BASELINE_NUDGE_PX = 1;
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

function withGlyphPadding(
  innerSvg,
  { drawSize, paddingLeft = 0, paddingRight = 0, lineSize, paddingBottom = 0 }
) {
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
  const slot = lineSize ?? drawSize;
  const y = Math.max(0, Math.round((slot - drawSize) / 2));
  const width = drawSize + paddingLeft + paddingRight;
  const height = slot + paddingBottom;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <svg x="${paddingLeft}" y="${y}" width="${drawSize}" height="${drawSize}" viewBox="${viewBox}" ${presentation} xmlns="http://www.w3.org/2000/svg">${body}</svg>
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
  const gapBeforeGroup = ICON.gapBetweenGroupsPx * ICON.pixelRatio;
  const boltGapAfter = BOLT_ICON.gapAfterPx * ICON.pixelRatio;
  const baselineNudge = GLYPH_BASELINE_NUDGE_PX * ICON.pixelRatio;
  const bubbleImageOpts = {
    pixelRatio: BUBBLE.pixelRatio,
    stretchX: BUBBLE.stretchX,
    stretchY: BUBBLE.stretchY,
    content: BUBBLE.labelBox,
  };

  const pack = (svg, { drawSize, paddingLeft = 0, paddingRight = 0 }) =>
    withGlyphPadding(svg, {
      drawSize,
      paddingLeft,
      paddingRight,
      lineSize: ICON.size,
      paddingBottom: baselineNudge,
    });

  const boltGlyph = (color) =>
    pack(boltSvg({ size: BOLT_ICON.size, color }), {
      drawSize: BOLT_ICON.size,
      paddingRight: boltGapAfter,
    });
  const boltFollowGlyph = (color) =>
    pack(boltSvg({ size: BOLT_ICON.size, color }), {
      drawSize: BOLT_ICON.size,
      paddingLeft: gapBeforeGroup,
      paddingRight: boltGapAfter,
    });
  const bikeGlyph = (color) =>
    pack(bikeSvg({ size: ICON.size, color }), {
      drawSize: ICON.size,
      paddingRight: gapAfter,
    });
  const dockGlyph = (color) =>
    pack(parkingSvg({ size: DOCK_ICON.size, color }), {
      drawSize: DOCK_ICON.size,
      paddingLeft: gapBeforeGroup,
      paddingRight: gapAfter,
    });

  const glyphOpts = { pixelRatio: ICON.pixelRatio };
  await Promise.all([
    addMapImage(
      map,
      IMAGE_IDS.markerLight,
      toDataUrl(bubbleMarkerSvg(MARKER_BORDER_LIGHT)),
      bubbleImageOpts
    ),
    addMapImage(
      map,
      IMAGE_IDS.markerDark,
      toDataUrl(bubbleMarkerSvg(MARKER_BORDER_DARK)),
      bubbleImageOpts
    ),
    addMapImage(map, IMAGE_IDS.glyphBolt, toDataUrl(boltGlyph(GLYPH_COLOR)), glyphOpts),
    addMapImage(map, IMAGE_IDS.glyphBoltDim, toDataUrl(boltGlyph(GLYPH_COLOR_DIM)), glyphOpts),
    addMapImage(map, IMAGE_IDS.glyphBoltFollow, toDataUrl(boltFollowGlyph(GLYPH_COLOR)), glyphOpts),
    addMapImage(
      map,
      IMAGE_IDS.glyphBoltFollowDim,
      toDataUrl(boltFollowGlyph(GLYPH_COLOR_DIM)),
      glyphOpts
    ),
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
      if (options.isInRouteMode()) return;
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
    const bikeImage = [
      'case',
      ['<=', ['get', 'bikes'], DIM_COUNT_AT_OR_BELOW],
      ['image', IMAGE_IDS.glyphBikeDim],
      ['image', IMAGE_IDS.glyphBike],
    ];
    const boltImage = [
      'case',
      ['<=', ['get', 'bikes'], DIM_COUNT_AT_OR_BELOW],
      ['image', IMAGE_IDS.glyphBoltDim],
      ['image', IMAGE_IDS.glyphBolt],
    ];
    const boltFollowImage = [
      'case',
      ['<=', ['get', 'bikes'], DIM_COUNT_AT_OR_BELOW],
      ['image', IMAGE_IDS.glyphBoltFollowDim],
      ['image', IMAGE_IDS.glyphBoltFollow],
    ];
    const dockImage = [
      'case',
      ['<=', ['get', 'docks'], DIM_COUNT_AT_OR_BELOW],
      ['image', IMAGE_IDS.glyphDockDim],
      ['image', IMAGE_IDS.glyphDock],
    ];
    const dockSection = [
      dockImage,
      ['to-string', ['get', 'docks']],
      { 'text-color': docksTextColor },
    ];
    // Zero bikes: hide electric. Both types: mechanical then electric. Else show the non-empty type.
    const countsFormat = iconsReady
      ? [
          'case',
          ['==', ['get', 'bikes'], 0],
          [
            'format',
            bikeImage,
            ['to-string', ['get', 'mechanical']],
            { 'text-color': bikesTextColor },
            ...dockSection,
          ],
          ['all', ['>', ['get', 'mechanical'], 0], ['>', ['get', 'ebike'], 0]],
          [
            'format',
            bikeImage,
            ['to-string', ['get', 'mechanical']],
            { 'text-color': bikesTextColor },
            boltFollowImage,
            ['to-string', ['get', 'ebike']],
            { 'text-color': bikesTextColor },
            ...dockSection,
          ],
          ['==', ['get', 'mechanical'], 0],
          [
            'format',
            boltImage,
            ['to-string', ['get', 'ebike']],
            { 'text-color': bikesTextColor },
            ...dockSection,
          ],
          [
            'format',
            bikeImage,
            ['to-string', ['get', 'mechanical']],
            { 'text-color': bikesTextColor },
            ...dockSection,
          ],
        ]
      : [
          'case',
          ['==', ['get', 'bikes'], 0],
          [
            'format',
            ['to-string', ['get', 'mechanical']],
            { 'text-color': bikesTextColor },
            ' · ',
            ['to-string', ['get', 'docks']],
            { 'text-color': docksTextColor },
          ],
          ['all', ['>', ['get', 'mechanical'], 0], ['>', ['get', 'ebike'], 0]],
          [
            'format',
            ['to-string', ['get', 'mechanical']],
            { 'text-color': bikesTextColor },
            ' · ',
            { 'text-color': bikesTextColor },
            ['to-string', ['get', 'ebike']],
            { 'text-color': bikesTextColor },
            ' · ',
            ['to-string', ['get', 'docks']],
            { 'text-color': docksTextColor },
          ],
          ['==', ['get', 'mechanical'], 0],
          [
            'format',
            ['to-string', ['get', 'ebike']],
            { 'text-color': bikesTextColor },
            ' · ',
            ['to-string', ['get', 'docks']],
            { 'text-color': docksTextColor },
          ],
          [
            'format',
            ['to-string', ['get', 'mechanical']],
            { 'text-color': bikesTextColor },
            ' · ',
            ['to-string', ['get', 'docks']],
            { 'text-color': docksTextColor },
          ],
        ];

    map.addLayer({
      id: BICING_LAYER_ID,
      type: 'symbol',
      source: BICING_SOURCE_ID,
      minzoom: options.getSymbolMinZoom?.() ?? 15,
      layout: {
        visibility: 'none',
        'icon-image': iconsReady
          ? options.isDarkMode()
            ? IMAGE_IDS.markerDark
            : IMAGE_IDS.markerLight
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
