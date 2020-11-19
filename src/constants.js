export const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoiY21kYWxiZW0iLCJhIjoiY2pnbXhjZnplMDJ6MjMzbnk0OGthZGE1ayJ9.n1flNO8ndRYKQcR9wNIT9w';
export const DEFAULT_MAPBOX_STYLE = 'mapbox://styles/cmdalbem/ckgpww8gi2nk619kkl0zrlodm';

export const DEFAULT_BORDER_WIDTH = 3;

export const DEFAULT_AREA = 'Fortaleza, Ceará, Brazil';
export const DEFAULT_LNG = -38.5225359;
export const DEFAULT_LAT = -3.7719909;
export const DEFAULT_ZOOM = 10.9;

const ONE_DAY_MS = 1000 * 60 * 60 * 24;
export const OSM_DATA_MAX_AGE_MS = 7 * ONE_DAY_MS;

export const MIN_ZOOM_TO_LOAD_DATA = 10;

export const TOPBAR_HEIGHT = 64;

export const MOBILE_MAX_WIDTH = '430px';
export const DESKTOP_MIN_WIDTH = '430px';
export const IS_MOBILE = window.matchMedia && window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH})`).matches;

export const ENABLE_COMMENTS = true;