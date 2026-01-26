import { saveAs } from 'file-saver';
import { renderPoster } from './renderPoster.js';
import { withMapBasemapHidden, withMapLabelsHidden } from './mapStyleUtils.js';
import { getPosterThemeColors } from './posterDefaults.js';

const DEFAULT_FILENAME_PREFIX = 'ciclomapa';

const pad2 = (value) => String(value).padStart(2, '0');

const buildTimestamp = (date) => (
    `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-` +
    `${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`
);

const buildFilename = (prefix) => {
    const stamp = buildTimestamp(new Date());
    return `${prefix}-${stamp}.png`;
};

const formatCoords = (coords) => {
    if (!coords || coords.lat == null || coords.lng == null) {
        return '';
    }
    return `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
};

const getOutputSize = (settings, mapCanvas) => {
    if (!settings) {
        return {
            width: mapCanvas.width,
            height: mapCanvas.height
        };
    }

    const width = Number(settings.width);
    const height = Number(settings.height);

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        return {
            width: mapCanvas.width,
            height: mapCanvas.height
        };
    }

    return { width, height };
};

export const getThemeColors = (isDarkMode) => getPosterThemeColors(isDarkMode);

const normalizeOverlay = (settings, titleFallback, coords, isDarkMode) => {
    const themeColors = getThemeColors(isDarkMode);
    const showText = settings?.showText !== false;
    const showCoords = settings?.showCoords !== false;
    const frameColor = settings?.frameColor || themeColors.frameColor;
    const backgroundColor = settings?.backgroundColor || themeColors.backgroundColor;
    const innerBorderColor = settings?.innerBorderColor || themeColors.innerBorderColor || frameColor;

    return {
        showFrame: settings?.showFrame !== false,
        showText,
        showBackdrop: settings?.showBackdrop !== false,
        showLogo: settings?.showLogo !== false,
        showInnerBorder: settings?.showInnerBorder === true,
        title: settings?.title || titleFallback || '',
        subtitle: settings?.subtitle || '',
        coords: showText && showCoords ? formatCoords(coords) : '',
        frameColor,
        textColor: settings?.textColor || themeColors.textColor,
        backdropColor: settings?.backdropColor || themeColors.backdropColor,
        backgroundColor: backgroundColor,
        innerBorderColor: innerBorderColor
    };
};

export const exportMapScreenshot = async ({
    map,
    settings,
    filenamePrefix = DEFAULT_FILENAME_PREFIX,
    titleFallback = '',
    coords,
    isDarkMode
}) => {
    if (!map || !map.getCanvas) {
        throw new Error('Mapa indisponível para exportação.');
    }

    const blob = await withMapBasemapHidden(map, settings?.hideBasemap === true, async () => (
        withMapLabelsHidden(map, async () => {
            const mapCanvas = map.getCanvas();
            const { width, height } = getOutputSize(settings, mapCanvas);
            const overlay = normalizeOverlay(settings, titleFallback, coords, isDarkMode);

            return renderPoster({
                mapCanvas,
                width,
                height,
                overlay
            });
        })
    ));

    saveAs(blob, buildFilename(filenamePrefix));
    return blob;
};
