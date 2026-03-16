export const LABEL_LAYER_IDS = [
    'country-label',
    'state-label',
    'settlement-major-label',
    'settlement-minor-label',
    'settlement-subdivision-label',
    'natural-point-label',
    'water-line-label',
    'waterway-label',
    'natural-line-label',
    'road-direction-arrows',
    'road-label',
    'road-label-small',
    'road-label-medium',
    'road-label-large'
];

export const POI_LAYER_IDS = [
    'postos',
    'sanitarios',
    'bebedouros',
    'public transport stations'
];

/**
 * Checks if the map is in a valid state for style operations.
 * The map can become invalid when it's being reinitialized.
 */
const isMapValid = (map) => {
    if (!map) {
        return false;
    }

    try {
        // Check if the map has a valid style
        const style = map.getStyle && map.getStyle();
        return style != null;
    } catch (error) {
        return false;
    }
};

const waitForMapIdle = (map) => new Promise((resolve) => {
    if (!map || !isMapValid(map)) {
        resolve();
        return;
    }

    if (map.loaded && map.loaded() && (!map.isMoving || !map.isMoving())) {
        resolve();
        return;
    }

    const onIdle = () => {
        map.off('idle', onIdle);
        resolve();
    };

    map.on('idle', onIdle);
});

const isMapboxBasemapSource = (sourceDef) => {
    if (!sourceDef) {
        return false;
    }

    const url = sourceDef.url || '';
    if (url.includes('mapbox://mapbox')) {
        return true;
    }

    if (Array.isArray(sourceDef.tiles)) {
        return sourceDef.tiles.some((tileUrl) => tileUrl.includes('api.mapbox.com'));
    }

    return false;
};

const getBasemapSourceIds = (style) => {
    const sources = style?.sources || {};
    return Object.entries(sources)
        .filter(([, sourceDef]) => isMapboxBasemapSource(sourceDef))
        .map(([sourceId]) => sourceId);
};

const shouldHideBasemapLayer = (layer, basemapSourceIds) => {
    if (!layer) {
        return false;
    }

    if (layer.type === 'background') {
        return true;
    }

    if (!layer.source) {
        return false;
    }

    return basemapSourceIds.includes(layer.source);
};

export const withMapLabelsHidden = async (map, fn) => {
    if (!map || !isMapValid(map)) {
        return fn();
    }

    const previousVisibility = {};
    [...LABEL_LAYER_IDS, ...POI_LAYER_IDS].forEach((layerId) => {
        try {
            if (!map.getLayer(layerId)) {
                return;
            }

            const visibility = map.getLayoutProperty(layerId, 'visibility');
            previousVisibility[layerId] = visibility || 'visible';
            map.setLayoutProperty(layerId, 'visibility', 'none');
        } catch (error) {
            // Ignore style mutation failures (map may have been invalidated)
        }
    });

    await waitForMapIdle(map);

    try {
        return await fn();
    } finally {
        [...LABEL_LAYER_IDS, ...POI_LAYER_IDS].forEach((layerId) => {
            try {
                if (!isMapValid(map) || !map.getLayer(layerId)) {
                    return;
                }

                const visibility = previousVisibility[layerId] || 'visible';
                map.setLayoutProperty(layerId, 'visibility', visibility);
            } catch (error) {
                // Ignore style mutation failures (map may have been invalidated)
            }
        });
    }
};

export const withMapBasemapHidden = async (map, enabled, fn) => {
    if (!enabled) {
        return fn();
    }

    if (!map || !isMapValid(map)) {
        return fn();
    }

    const style = map.getStyle();
    const layers = style?.layers || [];
    const basemapSourceIds = getBasemapSourceIds(style);
    const previousVisibility = {};

    layers.forEach((layer) => {
        if (!shouldHideBasemapLayer(layer, basemapSourceIds)) {
            return;
        }

        try {
            const visibility = map.getLayoutProperty(layer.id, 'visibility');
            previousVisibility[layer.id] = visibility || 'visible';
            map.setLayoutProperty(layer.id, 'visibility', 'none');
        } catch (error) {
            // Ignore style mutation failures (map may have been invalidated)
        }
    });

    await waitForMapIdle(map);

    try {
        return await fn();
    } finally {
        Object.keys(previousVisibility).forEach((layerId) => {
            try {
                if (!isMapValid(map) || !map.getLayer(layerId)) {
                    return;
                }

                const visibility = previousVisibility[layerId] || 'visible';
                map.setLayoutProperty(layerId, 'visibility', visibility);
            } catch (error) {
                // Ignore style mutation failures (map may have been invalidated)
            }
        });
    }
};
