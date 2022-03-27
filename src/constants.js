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
};


// Mapbox

export const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoiY21kYWxiZW0iLCJhIjoiY2pnbXhjZnplMDJ6MjMzbnk0OGthZGE1ayJ9.n1flNO8ndRYKQcR9wNIT9w';
export const DEFAULT_MAPBOX_STYLE = 'mapbox://styles/cmdalbem/ckgpww8gi2nk619kkl0zrlodm';


// Layers

export const DEFAULT_BORDER_WIDTH = 3;
export const DEFAULT_LINE_WIDTH_MULTIPLIER = 2;
export const LINE_WIDTH_MULTIPLIER_HOVER = 3;


// Map

export const DEFAULT_AREA = 'Fortaleza, Ceará, Brasil';
export const DEFAULT_LNG = -38.5225359;
export const DEFAULT_LAT = -3.7719909;
export const DEFAULT_ZOOM = 12;
export const POI_ZOOM_THRESHOLD = 14;
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
export const FORCE_RECALCULATE_LENGTHS_ALWAYS = !IS_PROD;


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