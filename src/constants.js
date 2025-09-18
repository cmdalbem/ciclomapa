// OSM & Overpass

export const OVERPASS_SERVERS = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
    'https://overpass.osm.ch/api/interpreter',
    'https://overpass.nchc.org.tw/api/interpreter'
];

export const AREA_ID_OVERRIDES = {
    'Vitória, Espirito Santo, Brasil': 3601825817,
    'Brasília, Distrito Federal, Brasil': 3602662005,
    'København, Capital RegionDenmark, Denmark': 3613707878,
    'Comuna 1, Buenos Aires, Argentina': 3601224652,
    'Stockholm, Stockholm, Sweden': 3600398021,
    'Madri, Madrid, Espanha': 3605326784,
};


// Mapbox

export const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

export const MAP_STYLES = {
    DARK: 'mapbox://styles/cmdalbem/ckgpww8gi2nk619kkl0zrlodm',
    LIGHT: 'mapbox://styles/cmdalbem/cjxseldep7c0a1doc7ezn6aeb'
    // LIGHT: 'mapbox://styles/cmdalbem/cmf6j71jk00cv01sjezoh6fky'
};
 

// Routing providers

export const OPENROUTESERVICE_API_KEY = process.env.REACT_APP_OPENROUTESERVICE_API_KEY;
export const OPENROUTESERVICE_BASE_URL = 'https://api.openrouteservice.org/v2/directions';

export const GRAPHHOPPER_API_KEY = process.env.REACT_APP_GRAPHHOPPER_API_KEY;
export const GRAPHHOPPER_BASE_URL = 'https://graphhopper.com/api/1/route';

export const VALHALLA_BASE_URL = 'https://valhalla1.openstreetmap.de/route';



// Layers

export const DEFAULT_BORDER_WIDTH = 3;
export const DEFAULT_LINE_WIDTH_MULTIPLIER = 1;
export const LINE_WIDTH_MULTIPLIER_HOVER = 2;

export const DIRECTIONS_LINE_WIDTH = 24;
export const DIRECTIONS_LINE_BORDER_WIDTH = 4;

// Map

export const DEFAULT_AREA = 'Fortaleza, Ceará, Brasil';
export const DEFAULT_LNG = -38.5225359;
export const DEFAULT_LAT = -3.7719909;
export const DEFAULT_ZOOM = 12;
export const POI_ZOOM_THRESHOLD = 15;
export const COMMENTS_ZOOM_THRESHOLD = 13;


// Layout

export const TOPBAR_HEIGHT = 64;

export const MOBILE_MAX_WIDTH = '430px';
export const DESKTOP_MIN_WIDTH = '430px';
export const IS_MOBILE = window.matchMedia && window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH})`).matches;


// Debug & local development

export const IS_PROD = window.location.hostname === 'ciclomapa.org.br';
export const ENABLE_COMMENTS = true;
export const SAVE_TO_FIREBASE = true;
export const DISABLE_DATA_HEALTY_TEST = false;
export const THRESHOLD_NEW_VS_OLD_DATA_TOLERANCE = 0.1;
export const DISABLE_LOCAL_STORAGE = true;
export const FORCE_RECALCULATE_LENGTHS_ALWAYS = false;


// Other

const ONE_DAY_MS = 1000 * 60 * 60 * 24;
export const OSM_DATA_MAX_AGE_MS = 7 * ONE_DAY_MS;
export const LENGTH_CALCULATE_STRATEGIES = [
    'random',       // Consider a random side each time
    'optimistic',   // Consider always the side the longest
    'pessimistic',  // Consider always the side the shortest
    'average',  // Ignore sides, cut total raw street length by half and call it a day
]
export const DEFAULT_LENGTH_CALCULATE_STRATEGIES = 'average';

// Hybrid routing
export const HYBRID_MAX_RESULTS = 5;

// Whitelisted cities for OSM data queries
export const WHITELISTED_CITIES = [
    'Barcelona, Barcelona, Espanha'
];