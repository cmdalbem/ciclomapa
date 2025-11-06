/* 
 * OSM & Overpass
 */

export const OSM_DATA_MAX_AGE_DAYS = 30;

export const WHITELISTED_CITIES = [
    // 'Barcelona, Barcelona, Espanha'
];

export const LENGTH_CALCULATE_STRATEGIES = [
    'random',       // Consider a random side each time
    'optimistic',   // Consider always the side the longest
    'pessimistic',  // Consider always the side the shortest
    'average',  // Ignore sides, cut total raw street length by half and call it a day
];
export const DEFAULT_LENGTH_CALCULATE_STRATEGIES = 'average';


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



/* 
 * Layout
 */


export const MOBILE_MAX_WIDTH = '430px';
export const IS_MOBILE = window.matchMedia && window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH})`).matches;

export const TOPBAR_HEIGHT = 64;


/* 
 * Routing
 */


// Settings

export const HYBRID_MAX_RESULTS = 3;
export const MIN_ROUTE_COVERAGE_PERCENT_TO_DISPLAY = 5;
export const ENABLE_MAP_CLICK_TO_SET_POINTS = false;
export const ENABLE_AUTO_AREA_CHANGE_ON_POINT = false;

export const ROUTE_COLORS = {
    DARK: {
        SELECTED: '#C8681E',
        // SELECTED: '#000000',
        UNSELECTED: '#999999'
        
        // SELECTED: '#3170EF',
        // UNSELECTED: '#6083B8'
    },
    LIGHT: {
        SELECTED: '#EA9010',
        // SELECTED: '#FFFFFF',
        UNSELECTED: '#cac7c4'

        // SELECTED: '#00A5CF',
        // UNSELECTED: '#BEE7F3'
    }
};




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
export const ROUTE_LINE_BORDER_OPACITY = 0.6;

export const ROUTE_LINE_WIDTH = ROUTE_FIXED_WIDTH;
export const ROUTE_LINE_PADDING_GAP_WIDTH = ROUTE_FIXED_WIDTH + ROUTE_LINE_PADDING_WIDTH;
export const ROUTE_LINE_GAP_WIDTH = ROUTE_FIXED_WIDTH - ROUTE_LINE_BORDER_WIDTH - 1;

export const NEAR_DESTINATION_POI_RADIUS_KM = 0.6; // Radius in kilometers for showing POIs near destination during route planning

// const ROUTE_MIN_WIDTH = 6;
// const ROUTE_MAX_WIDTH = 12;
// const ROUTE_LINE_WIDTH = [
//     "interpolate",
//         ["exponential", 1.5],
//         ["zoom"],
//         12, ROUTE_MIN_WIDTH,
//         18, ROUTE_MAX_WIDTH
// ];

// const ROUTE_LINE_PADDING_GAP_WIDTH = [
//     "interpolate",
//         ["exponential", 1.5],
//         ["zoom"],
//         12, ROUTE_MIN_WIDTH+ROUTE_LINE_PADDING_WIDTH,
//         18, ROUTE_MAX_WIDTH+ROUTE_LINE_PADDING_WIDTH
// ];
// const ROUTE_LINE_GAP_WIDTH = [
//     "interpolate",
//         ["exponential", 1.5],
//         ["zoom"],
//         12, ROUTE_MIN_WIDTH-ROUTE_LINE_BORDER_WIDTH,
//         18, ROUTE_MAX_WIDTH-ROUTE_LINE_BORDER_WIDTH
// ];

/* 
 * Map
 */

export const DEFAULT_AREA = 'Fortaleza, Ceará, Brasil';
export const DEFAULT_LNG = -38.5225359;
export const DEFAULT_LAT = -3.7719909;
export const DEFAULT_ZOOM = 12;
export const INTERACTIVE_LAYERS_ZOOM_THRESHOLD = 12;
export const COMMENTS_ZOOM_THRESHOLD = 13;
export const MAP_AUTOCHANGE_AREA_ZOOM_THRESHOLD = 11;



/* 
 * Debug & local development
 */

export const IS_PROD = window.location.hostname === 'ciclomapa.org.br';
export const ENABLE_COMMENTS = true;
export const SAVE_TO_FIREBASE = true;
export const DISABLE_DATA_HEALTY_TEST = false;
export const THRESHOLD_NEW_VS_OLD_DATA_TOLERANCE = 0.1;
export const DISABLE_LOCAL_STORAGE = true;
export const FORCE_RECALCULATE_LENGTHS_ALWAYS = false;

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
    LIGHT: 'mapbox://styles/cmdalbem/cjxseldep7c0a1doc7ezn6aeb'
    // LIGHT: 'mapbox://styles/cmdalbem/cmf6j71jk00cv01sjezoh6fky'
};
