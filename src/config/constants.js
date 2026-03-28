/*
 * OSM & Overpass
 */

export const OSM_DATA_MAX_AGE_DAYS = 30;

export const BLACKLISTED_CITIES_FOR_EXTRA_LAYERS = [
  3600062422, // Berlin, Berlin, Germany
];

export const LENGTH_CALCULATE_STRATEGIES = [
  'random', // Consider a random side each time
  'optimistic', // Consider always the side the longest
  'pessimistic', // Consider always the side the shortest
  'average', // Ignore sides, cut total raw street length by half and call it a day
];
export const DEFAULT_LENGTH_CALCULATE_STRATEGIES = 'average';
export const LENGTH_COUNTED_LAYER_IDS = [
  'ciclovia',
  'ciclofaixa',
  'ciclorrota',
  'calcada-compartilhada',
  // 'baixa-velocidade',
  // 'trilha',
  // 'proibido',
];

export const OVERPASS_SERVERS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
];

export const AREA_ID_OVERRIDES = {
  'Vitória, Espirito Santo, Brasil': 3601825817,
  'Brasília, Distrito Federal, Brasil': 3602662005,
  'København, Capital RegionDenmark, Denmark': 3613707878,
  'Comuna 1, Buenos Aires, Argentina': 3601224652,
  'Stockholm, Stockholm, Sweden': 3600398021,
  'Madri, Madrid, Espanha': 3605326784,
};

/*
 * Layout
 */

export const MOBILE_MAX_WIDTH = '480px';
export const IS_MOBILE =
  window.matchMedia && window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH})`).matches;

export { TOPBAR_HEIGHT, ROUTE_COLORS, MAP_COLORS } from './design-tokens.js';

/*
 * Routing
 */

// Settings

export const HYBRID_MAX_RESULTS_DESKTOP = 5;
export const HYBRID_MAX_RESULTS_MOBILE = 3;
export const HYBRID_MAX_RESULTS = IS_MOBILE
  ? HYBRID_MAX_RESULTS_MOBILE
  : HYBRID_MAX_RESULTS_DESKTOP;
export const MIN_ROUTE_COVERAGE_PERCENT_TO_DISPLAY = 5;

/*
 * City picker
 */
export const MAX_RECENT_CITIES = IS_MOBILE ? 3 : 6;
export const ENABLE_MAP_CLICK_TO_SET_POINTS = false;
export const ENABLE_AUTO_AREA_CHANGE_ON_POINT = false;
export const ENABLE_COMMENTS = true;
export const ENABLE_SATELLITE_TOGGLE = false;

/*
 * Supported countries (geocoding, city search, UI labels — not PMTiles).
 * Keep in sync with entries in `citySlugCatalog.js`. Order: primary market,
 * Iberia, then Latin America by Portuguese name.
 */
export const SUPPORTED_COUNTRIES = Object.freeze([
  { code: 'br', labelPt: 'Brasil', flag: '🇧🇷' },
  { code: 'pt', labelPt: 'Portugal', flag: '🇵🇹' },
  { code: 'es', labelPt: 'Espanha', flag: '🇪🇸' },
  // { code: 'ar', labelPt: 'Argentina', flag: '🇦🇷' },
  // { code: 'bo', labelPt: 'Bolívia', flag: '🇧🇴' },
  // { code: 'cl', labelPt: 'Chile', flag: '🇨🇱' },
  // { code: 'co', labelPt: 'Colômbia', flag: '🇨🇴' },
  // { code: 'ec', labelPt: 'Equador', flag: '🇪🇨' },
  // { code: 'py', labelPt: 'Paraguai', flag: '🇵🇾' },
  // { code: 'pe', labelPt: 'Peru', flag: '🇵🇪' },
  // { code: 'uy', labelPt: 'Uruguai', flag: '🇺🇾' },
  // { code: 've', labelPt: 'Venezuela', flag: '🇻🇪' },
]);

export const SUPPORTED_COUNTRY_CODES = Object.freeze(SUPPORTED_COUNTRIES.map((c) => c.code));

/** Mapbox Geocoder `countries`: comma-separated ISO 3166-1 alpha-2. */
export const MAPBOX_GEOCODER_COUNTRIES = SUPPORTED_COUNTRY_CODES.join(',');

/**
 * Google Places script/Autocomplete region bias (one ccTLD). Searches still
 * restrict to all `SUPPORTED_COUNTRY_CODES` via componentRestrictions.
 */
export const GOOGLE_PLACES_DEFAULT_REGION = 'br';

export const SUPPORTED_COUNTRY_LABEL_PT_BY_CODE = Object.freeze(
  SUPPORTED_COUNTRIES.reduce((acc, { code, labelPt }) => {
    acc[code] = labelPt;
    return acc;
  }, /** @type {Record<string, string>} */ ({}))
);

/*
 * Map Layers
 */

export const DEFAULT_BORDER_WIDTH = 3;
export const DEFAULT_LINE_WIDTH_MULTIPLIER = 1;
export const LINE_WIDTH_MULTIPLIER_HOVER = 2;

export const DIRECTIONS_LINE_WIDTH = 24;
export const DIRECTIONS_LINE_BORDER_WIDTH = 4;

export const ROUTE_FIXED_WIDTH = 8;
export const ROUTE_LINE_PADDING_WIDTH = 2;
export const ROUTE_LINE_BORDER_WIDTH = 1;
export const ROUTE_LINE_BORDER_OPACITY = 0.1;

export const ROUTE_LINE_WIDTH = ROUTE_FIXED_WIDTH;
export const ROUTE_LINE_PADDING_GAP_WIDTH = ROUTE_FIXED_WIDTH + ROUTE_LINE_PADDING_WIDTH;
export const ROUTE_LINE_GAP_WIDTH = ROUTE_FIXED_WIDTH - ROUTE_LINE_BORDER_WIDTH - 1;

export const NEAR_DESTINATION_POI_RADIUS_KM = 0.6; // Radius in kilometers for showing POIs near destination during route planning

// At low zoom, line widths are scaled down by dividing lineWidth by these values.
export const LOW_ZOOM_WIDTH_DIVISOR = 5;
export const ROUTES_ACTIVE_LOW_ZOOM_WIDTH_DIVISOR = 15;

// At high zoom, line widths are scaled by multiplying lineWidth by these values.
export const ROUTES_ACTIVE_HIGH_ZOOM_WIDTH_MULTIPLIER = 0.5;

/*
 * Map
 */

export const DEFAULT_AREA = 'Fortaleza, Ceará, Brasil';
export const DEFAULT_LNG = -38.5225359;
export const DEFAULT_LAT = -3.7719909;
export const DEFAULT_ZOOM = 12;
export const INTERACTIVE_LAYERS_ZOOM_THRESHOLD = 15;
export const COMMENTS_ZOOM_THRESHOLD = 13;
export const MAP_AUTOCHANGE_AREA_ZOOM_THRESHOLD = 12;

// const DEFAULT_PMTILES_FILENAME = 'europe.pmtiles';
const DEFAULT_PMTILES_FILENAME = 'la_es_pt.pmtiles';
export const PMTILES_FILENAME = process.env.REACT_APP_PMTILES_FILENAME || DEFAULT_PMTILES_FILENAME;

/*
 * Debug & local development
 */

export const IS_PROD = window.location.hostname === 'ciclomapa.app';
export const DEFAULT_SIDEBAR_OPEN = false;
export const SAVE_TO_FIREBASE = true;
export const DISABLE_DATA_HEALTY_TEST = false;
export const THRESHOLD_NEW_VS_OLD_DATA_TOLERANCE = 0.1;
export const DISABLE_LOCAL_STORAGE = true;
const URL_PARAMS = new URLSearchParams(window.location.search);
export const FORCE_RECALCULATE_LENGTHS_ALWAYS = URL_PARAMS.get('debug') === 'true';

export const USE_GEOJSON_SOURCE = true;
export const USE_PMTILES_SOURCE = true;

// Providers

export const OPENROUTESERVICE_API_KEY = process.env.REACT_APP_OPENROUTESERVICE_API_KEY;
export const OPENROUTESERVICE_BASE_URL = 'https://api.openrouteservice.org/v2/directions';

export const GRAPHHOPPER_API_KEY = process.env.REACT_APP_GRAPHHOPPER_API_KEY;
export const GRAPHHOPPER_BASE_URL = 'https://graphhopper.com/api/1/route';

export const VALHALLA_BASE_URL = 'https://valhalla1.openstreetmap.de/route';

/*
 * Mapbox
 */

export const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

export const GOOGLE_PLACES_API_KEY = process.env.REACT_APP_GOOGLE_PLACES_API_KEY;

export const MAP_STYLES = {
  DARK: 'mapbox://styles/cmdalbem/ckgpww8gi2nk619kkl0zrlodm',
  LIGHT: 'mapbox://styles/cmdalbem/cjxseldep7c0a1doc7ezn6aeb',
  // LIGHT: 'mapbox://styles/cmdalbem/cmf6j71jk00cv01sjezoh6fky'
};
