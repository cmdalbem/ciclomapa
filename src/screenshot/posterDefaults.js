import { adjustColorBrightness, parseAreaLabel } from '../utils.js';
import { MAP_STYLES } from '../constants.js';

/**
 * Map themes available for poster export.
 * Each theme has a light and dark variant.
 */
export const POSTER_MAP_THEMES = [
    {
        id: 'minimalistic',
        label: 'Minimalista',
        description: 'Traços limpos, pouca interferência visual e sem cores.',
        styles: {
            // New styles
            // dark: 'mapbox://styles/cmdalbem/cmkvrqoe2007x01se22vk16ol',
            // light: 'mapbox://styles/cmdalbem/cmkv57ppb003801shbjefcb6y'
            
            // Classic styles
            dark: 'mapbox://styles/cmdalbem/cmkvtc3uy001g01sbdwh3227b',
            light: 'mapbox://styles/cmdalbem/cmkvtc3z8004401sh7skp0css'
        }
    },
    {
        id: 'default',
        label: 'Padrão CicloMapa',
        description: 'Ruas e detalhes do mapa visíveis com cores sutis.',
        styles: {
            dark: MAP_STYLES.DARK,
            light: MAP_STYLES.LIGHT
        }
    },
    {
        id: 'accented',
        label: 'Destacado',
        description: 'Contraste forte com corpos d\'agua para um efeito mais dramático.',
        styles: {
            dark: 'mapbox://styles/cmdalbem/cmkvub5js007b01sb0wcu31kv',
            light: 'mapbox://styles/cmdalbem/cmkvu318h001i01sbhhgj2l0b'
        }
    },
    {
        id: 'none',
        label: 'Nenhum',
        description: 'Só ciclovias e camadas, sem ruas.',
        hideBasemap: true,
        styles: {
            // Uses the default styles but hides the basemap layers
            dark: MAP_STYLES.DARK,
            light: MAP_STYLES.LIGHT
        }
    }
];

export const POSTER_COLOR_OVERLAYS = [
    { id: 'none', label: null, color: null },
    { id: '#386641', label: null, color: '#386641' },
    { id: '#A7C957', label: null, color: '#A7C957' },
    { id: '#4FA0AD', label: null, color: '#4FA0AD' },
    { id: '#583707', label: null, color: '#583707' },
    { id: '#B61815', label: null, color: '#B61815' },
    { id: '#2A7BF4', label: null, color: '#2A7BF4' },
    { id: '#E56119', label: null, color: '#E56119' }
];

export const POSTER_OVERLAY_BLEND_MODES = [
    { id: 'soft-light', label: 'Soft light', mode: 'soft-light' },
    { id: 'multiply', label: 'Multiply', mode: 'multiply' },
    { id: 'screen', label: 'Screen', mode: 'screen' },
    { id: 'overlay', label: 'Overlay', mode: 'overlay' },
    { id: 'hard-light', label: 'Hard light', mode: 'hard-light' },
    { id: 'color-burn', label: 'Color burn', mode: 'color-burn' },
    { id: 'color', label: 'Color', mode: 'color' },
    { id: 'normal', label: 'Normal', mode: 'source-over' },
];

export const getPosterMapThemeById = (id) => 
    POSTER_MAP_THEMES.find((theme) => theme.id === id) || POSTER_MAP_THEMES[0];

export const getPosterMapStyle = (themeId, isDarkMode) => {
    const theme = getPosterMapThemeById(themeId);
    return isDarkMode ? theme.styles.dark : theme.styles.light;
};

export const shouldHideBasemapForTheme = (themeId) => {
    const theme = getPosterMapThemeById(themeId);
    return theme.hideBasemap === true;
};

export const POSTER_PRESETS = [
    { id: 'a5_portrait', label: 'A5 Retrato (1748x2480)', width: 1748, height: 2480 },
    { id: 'a5_landscape', label: 'A5 Paisagem (2480x1748)', width: 2480, height: 1748 },
    { id: 'a4_portrait', label: 'A4 Retrato (2480x3508)', width: 2480, height: 3508 },
    { id: 'a4_landscape', label: 'A4 Paisagem (3508x2480)', width: 3508, height: 2480 },
    { id: 'a3_portrait', label: 'A3 Retrato (3508x4961)', width: 3508, height: 4961 },
    { id: 'a3_landscape', label: 'A3 Paisagem (4961x3508)', width: 4961, height: 3508 },
    { id: 'square', label: 'Quadrado (1080x1080)', width: 1080, height: 1080 },
    { id: 'custom', label: 'Personalizado' }
];

const POSTER_THEME_COLOR_OVERRIDES = {
    minimalistic: {
        light: {
            frameColor: '#f7f7f7',
            backdropColor: '#f7f7f7'
        },
        dark: {
            frameColor: '#0f0f0f',
            backdropColor: '#0f0f0f'
        }
    },
    default: {
        light: {
            frameColor: '#dcdad8',
            backdropColor: '#dcdad8'
        },
        dark: {
            frameColor: '#131313',
            backdropColor: '#131313'
        }
    },
    accented: {
        light: {
            frameColor: '#446f4e',
            backdropColor: '#f7f7f7'
        },
        dark: {
            frameColor: '#b9fab7',
            backdropColor: '#b9fab7'
        }
    },
    none: { 
        light: {
            frameColor: '#FFFFFF',
            backdropColor: '#FFFFFF'
        },
        dark: {
            frameColor: '#1a1a1a',
            backdropColor: '#1a1a1a'
        }
    }
};

export const getPosterThemeColors = (themeId, isDarkMode) => {
    const baseColors = isDarkMode === false
        ? {
            frameColor: '#FFFFFF',
            innerBorderColor: '#386641',
            backgroundColor: '#EDEEED',
            textColor: adjustColorBrightness('#386641', -0.2),
            backdropColor: '#EDEEED'
        }
        : {
            frameColor: '#1a1a1a',
            innerBorderColor: '#B9FAB7',
            backgroundColor: '#1a1a1a',
            textColor: adjustColorBrightness('#B9FAB7', 0.2),
            backdropColor: '#1a1a1a'
        };

    const variant = isDarkMode ? 'dark' : 'light';
    const themeOverrides = POSTER_THEME_COLOR_OVERRIDES[themeId]?.[variant] || {};

    return {
        ...baseColors,
        ...themeOverrides
    };
};

export const POSTER_LAYOUT = {
    frameSizeRatio: 0.05,
    frameSizeMin: 8,
    overlayAlpha: 1,
    gradientFadeRatio: 0.3,
    gradientFadeAlpha: 1,
    gradientSolidStop: 0.1,
    titleSizeRatio: 0.04,
    subtitleSizeRatio: 0.015,
    coordsSizeRatio: 0.01,
    coordsSpacingRatio: 4,
    subtitleSpacingRatio: 1.6,
    titleTrackingRatio: 0.2,
    logoWidthRatio: 0.08,
    logoPaddingRatio: 0.025,
    logoPaddingMin: 16,
    textMarginRatio: 0.05,
    innerBorderRatio: 0.005,
    innerBorderMin: 4
};

export const getDefaultPosterSettings = (areaLabel) => {
    const { city, country } = parseAreaLabel(areaLabel);

    return {
        presetId: 'a5_portrait',
        width: 1748,
        height: 2480,
        useCustomSize: false,
        showFrame: true,
        showText: true,
        showCoords: true,
        showBackdrop: true,
        showLogo: false,
        showInnerBorder: true,
        overlayColor: null,
        overlayBlendMode: 'soft-light',
        overlayAlpha: POSTER_LAYOUT.overlayAlpha,
        mapTheme: 'minimalistic',
        title: city || '',
        subtitle: country || ''
    };
};
