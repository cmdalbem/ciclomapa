import { adjustColorBrightness, parseAreaLabel } from '../utils.js';

export const POSTER_PRESETS = [
    { id: 'a4_portrait', label: 'A4 Retrato (2480x3508)', width: 2480, height: 3508 },
    { id: 'a4_landscape', label: 'A4 Paisagem (3508x2480)', width: 3508, height: 2480 },
    { id: 'a3_portrait', label: 'A3 Retrato (3508x4961)', width: 3508, height: 4961 },
    { id: 'a3_landscape', label: 'A3 Paisagem (4961x3508)', width: 4961, height: 3508 },
    { id: 'square', label: 'Quadrado (1080x1080)', width: 1080, height: 1080 },
    { id: 'custom', label: 'Personalizado' }
];

export const getPosterThemeColors = (isDarkMode) => {
    if (isDarkMode === false) {
        return {
            frameColor: '#FFFFFF',
            innerBorderColor: '#386641',
            backgroundColor: '#EDEEED',
            textColor: adjustColorBrightness('#386641', -0.2),
            backdropColor: '#EDEEED'
        };
    }

    return {
        frameColor: '#1a1a1a',
        innerBorderColor: '#B9FAB7',
        backgroundColor: '#1a1a1a',
        textColor: adjustColorBrightness('#B9FAB7', 0.2),
        backdropColor: '#1a1a1a'
    };
};

export const POSTER_LAYOUT = {
    frameSizeRatio: 0.05,
    frameSizeMin: 8,
    gradientFadeRatio: 0.4,
    gradientFadeAlpha: 1,
    gradientSolidStop: 0.1,
    titleSizeRatio: 0.04,
    subtitleSizeRatio: 0.02,
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
        presetId: 'a4_portrait',
        width: 2480,
        height: 3508,
        useCustomSize: false,
        showFrame: true,
        showText: true,
        showCoords: true,
        showBackdrop: true,
        showLogo: false,
        showInnerBorder: true,
        hideBasemap: false,
        title: city || '',
        subtitle: country || ''
    };
};
