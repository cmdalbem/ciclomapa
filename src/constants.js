// OSM & Overpass

export const OVERPASS_SERVERS = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'http://overpass.openstreetmap.fr/api/interpreter',
    'http://overpass.osm.ch/api/interpreter',
    'https://overpass.nchc.org.tw'
];

export const AREA_ID_OVERRIDES = {
    'Vitória, Espirito Santo, Brazil': 3601825817,
    'Brasília, Distrito Federal, Brazil': 3602662005,
    'Brasília, Federal District, Brazil': 3602662005,
    'København, Capital RegionDenmark, Denmark': 3613707878,
    'Comuna 01, Buenos Aires, Argentina': 3601224652,
    'Stockholm, Stockholm, Sweden': 3600398021,
};


// Mapbox

export const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoiY21kYWxiZW0iLCJhIjoiY2pnbXhjZnplMDJ6MjMzbnk0OGthZGE1ayJ9.n1flNO8ndRYKQcR9wNIT9w';
export const DEFAULT_MAPBOX_STYLE = 'mapbox://styles/cmdalbem/ckgpww8gi2nk619kkl0zrlodm';


// Layers

export const DEFAULT_BORDER_WIDTH = 3;


// Map

export const DEFAULT_AREA = 'Fortaleza, Ceará, Brazil';
export const DEFAULT_LNG = -38.5225359;
export const DEFAULT_LAT = -3.7719909;
export const DEFAULT_ZOOM = 10.9;


// Layout

export const TOPBAR_HEIGHT = 64;

export const MOBILE_MAX_WIDTH = '430px';
export const DESKTOP_MIN_WIDTH = '430px';
export const IS_MOBILE = window.matchMedia && window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH})`).matches;


// Debug & local development

export const ENABLE_COMMENTS = true;
export const SAVE_TO_FIREBASE = true;
export const DISABLE_DATA_HEALTY_TEST = false;
export const DISABLE_LOCAL_STORAGE = true;
export const IS_PROD = window.location.hostname === 'ciclomapa.org.br';


// Other

const ONE_DAY_MS = 1000 * 60 * 60 * 24;
export const OSM_DATA_MAX_AGE_MS = 7 * ONE_DAY_MS;