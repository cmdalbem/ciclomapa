import React, { useEffect, useRef, useState } from 'react';
import {
    Modal,
    Form,
    InputNumber,
    Switch,
    Input,
    Space
} from 'antd';

import { renderPosterDataUrl } from './renderPoster.js';
import { getThemeColors, formatCoords } from './exportMapScreenshot.js';
import { POSTER_PRESETS, POSTER_MAP_THEMES, shouldHideBasemapForTheme } from './posterDefaults.js';
import { withMapBasemapHidden, withMapLabelsHidden } from './mapStyleUtils.js';
import './ScreenshotPanel.css';

const getPresetById = (id) => POSTER_PRESETS.find((preset) => preset.id === id);

const ScreenshotPanel = ({
    open,
    onCancel,
    onExport,
    settings,
    onSettingsChange,
    onMapThemeChange,
    map,
    coords,
    titleFallback,
    subtitleFallback,
    isDarkMode
}) => {
    const [previewUrl, setPreviewUrl] = useState('');
    const [isRendering, setIsRendering] = useState(false);
    const mapSizeRef = useRef(null);
    const presetId = settings?.presetId || 'portrait';
    const isCustom = settings?.useCustomSize || presetId === 'custom';
    const presetShapeSize = 42;

    const handlePresetChange = (value) => {
        const preset = getPresetById(value);
        if (preset && preset.id !== 'custom') {
            onSettingsChange({
                ...settings,
                presetId: preset.id,
                width: preset.width,
                height: preset.height,
                useCustomSize: false
            });
            return;
        }

        onSettingsChange({
            ...settings,
            presetId: 'custom',
            useCustomSize: true
        });
    };

    const getPresetShapeStyle = (preset) => {
        if (!preset?.width || !preset?.height) {
            return {
                width: presetShapeSize,
                height: presetShapeSize
            };
        }

        const ratio = preset.width / preset.height;
        if (ratio >= 1) {
            return {
                width: presetShapeSize,
                height: Math.max(12, Math.round(presetShapeSize / ratio))
            };
        }

        return {
            width: Math.max(12, Math.round(presetShapeSize * ratio)),
            height: presetShapeSize
        };
    };

    const getPresetLabels = (preset) => {
        if (!preset) {
            return { title: '', subtitle: '' };
        }

        if (!preset.width || !preset.height) {
            return { title: preset.label, subtitle: 'Defina o tamanho' };
        }

        const title = preset.label.split('(')[0]?.trim() || preset.label;
        return { title, subtitle: `${preset.width}x${preset.height}` };
    };

    const updateSetting = (key, value) => {
        onSettingsChange({
            ...settings,
            [key]: value
        });
    };

    const handleMapThemeChange = (themeId) => {
        updateSetting('mapTheme', themeId);
        if (onMapThemeChange) {
            onMapThemeChange(themeId);
        }
    };

    const restoreMapSize = () => {
        const stored = mapSizeRef.current;
        if (!stored?.map || !stored?.container) {
            mapSizeRef.current = null;
            return;
        }

        const { container, width, widthPriority, height, heightPriority, map: storedMap } = stored;
        if (width) {
            container.style.setProperty('width', width, widthPriority);
        } else {
            container.style.removeProperty('width');
        }

        if (height) {
            container.style.setProperty('height', height, heightPriority);
        } else {
            container.style.removeProperty('height');
        }

        try {
            storedMap.resize();
        } catch (error) {
            // Ignore resize failures if map was reinitialized
        }

        mapSizeRef.current = null;
    };

    useEffect(() => {
        if (!open) {
            restoreMapSize();
            return;
        }

        if (!map || !map.getContainer) {
            return;
        }

        const targetWidth = Number(settings?.width);
        const targetHeight = Number(settings?.height);

        if (!Number.isFinite(targetWidth) || !Number.isFinite(targetHeight) || targetWidth <= 0 || targetHeight <= 0) {
            return;
        }

        if (mapSizeRef.current?.map && mapSizeRef.current.map !== map) {
            restoreMapSize();
        }

        const container = map.getContainer();
        if (!mapSizeRef.current) {
            mapSizeRef.current = {
                map,
                container,
                width: container.style.getPropertyValue('width'),
                widthPriority: container.style.getPropertyPriority('width'),
                height: container.style.getPropertyValue('height'),
                heightPriority: container.style.getPropertyPriority('height')
            };
        }

        container.style.setProperty('width', `${Math.round(targetWidth)}px`, 'important');
        container.style.setProperty('height', `${Math.round(targetHeight)}px`, 'important');

        try {
            map.resize();
        } catch (error) {
            // Ignore resize failures if map was reinitialized
        }
    }, [open, map, settings, settings?.width, settings?.height]);

    useEffect(() => (
        () => {
            restoreMapSize();
        }
    ), []);

    useEffect(() => {
        let cancelled = false;

        const isMapReady = (mapInstance) => {
            if (!mapInstance) {
                return false;
            }
            try {
                // Check if map has a valid style and canvas
                const style = mapInstance.getStyle && mapInstance.getStyle();
                const canvas = mapInstance.getCanvas && mapInstance.getCanvas();
                return style != null && canvas != null;
            } catch (error) {
                return false;
            }
        };

        const buildPreview = async () => {
            if (!open || !map || !settings || !isMapReady(map)) {
                setPreviewUrl('');
                return;
            }

            setIsRendering(true);
            const hideBasemap = shouldHideBasemapForTheme(settings?.mapTheme);
            await withMapBasemapHidden(map, hideBasemap, async () => (
                withMapLabelsHidden(map, async () => {
                    if (cancelled) {
                        return;
                    }

                    const themeColors = getThemeColors(isDarkMode);

                    const overlay = {
                        showFrame: settings.showFrame !== false,
                        showText: settings.showText !== false,
                        showBackdrop: settings.showBackdrop !== false,
                        showLogo: settings.showLogo !== false,
                        showInnerBorder: settings.showInnerBorder === true,
                        backgroundColor: settings.backgroundColor || themeColors.backgroundColor,
                        title: settings.title || titleFallback || '',
                        subtitle: settings.subtitle || subtitleFallback || '',
                        coords: settings.showCoords !== false && settings.showText !== false
                            ? formatCoords(coords)
                            : '',
                        frameColor: settings.frameColor || themeColors.frameColor,
                        textColor: settings.textColor || themeColors.textColor,
                        backdropColor: settings.backdropColor || themeColors.backdropColor,
                        innerBorderColor: settings.innerBorderColor || themeColors.innerBorderColor || settings.frameColor || themeColors.frameColor
                    };

                    const preview = await renderPosterDataUrl({
                        mapCanvas: map.getCanvas(),
                        width: Number(settings.width) || map.getCanvas().width,
                        height: Number(settings.height) || map.getCanvas().height,
                        overlay
                    });

                    if (!cancelled) {
                        setPreviewUrl(preview);
                        setIsRendering(false);
                    }
                })
            ));
        };

        buildPreview();

        return () => {
            cancelled = true;
        };
    }, [open, map, settings, coords, titleFallback, subtitleFallback, isDarkMode]);

    return (
        <Modal
            className="screenshot-panel"
            title="Exportar imagem"
            open={open}
            onCancel={onCancel}
            onOk={onExport}
            okText="Exportar PNG"
            cancelText="Cancelar"
            width="100vw"
            height="100vh"
        >
            <div className="screenshot-panel__layout flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-1/4 screenshot-panel__controls">
                    <Form layout="vertical">
                            <Form.Item label="Formato e resolução">
                                <div
                                    className="screenshot-panel__preset-grid"
                                    role="radiogroup"
                                    aria-label="Formato e resolução"
                                >
                                    {POSTER_PRESETS.map((preset) => {
                                        const isSelected = presetId === preset.id;
                                        const isCustomPreset = preset.id === 'custom';
                                        const shapeStyle = getPresetShapeStyle(preset);
                                        const { title, subtitle } = getPresetLabels(preset);

                                        return (
                                            <button
                                                key={preset.id}
                                                type="button"
                                                className={`screenshot-panel__option-card screenshot-panel__preset-card${isSelected ? ' is-active' : ''}`}
                                                onClick={() => handlePresetChange(preset.id)}
                                                role="radio"
                                                aria-checked={isSelected}
                                            >
                                                <span className="screenshot-panel__preset-shape">
                                                    <span
                                                        className={`screenshot-panel__preset-shape-inner${isCustomPreset ? ' is-custom' : ''}`}
                                                        style={shapeStyle}
                                                    />
                                                </span>
                                                <span className="screenshot-panel__preset-text">
                                                    <span className="screenshot-panel__preset-label">{title}</span>
                                                    <span className="screenshot-panel__preset-subtitle">{subtitle}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Form.Item>

                            {isCustom && (
                                <Space className="screenshot-panel__size" size="middle">
                                    <Form.Item label="Largura (px)">
                                        <InputNumber
                                            min={256}
                                            max={8192}
                                            value={settings?.width}
                                            onChange={(value) => updateSetting('width', value)}
                                        />
                                    </Form.Item>
                                    <Form.Item label="Altura (px)">
                                        <InputNumber
                                            min={256}
                                            max={8192}
                                            value={settings?.height}
                                            onChange={(value) => updateSetting('height', value)}
                                        />
                                    </Form.Item>
                                </Space>
                            )}

                            <Form.Item label="Estilo do mapa">
                                <div
                                    className="screenshot-panel__theme-grid"
                                    role="radiogroup"
                                    aria-label="Estilo do mapa"
                                >
                                    {POSTER_MAP_THEMES.map((theme) => {
                                        const isSelected = (settings?.mapTheme || 'default') === theme.id;
                                        const subtitle = theme.description || '';

                                        return (
                                            <button
                                                key={theme.id}
                                                type="button"
                                                className={`screenshot-panel__option-card screenshot-panel__theme-card${isSelected ? ' is-active' : ''}`}
                                                onClick={() => handleMapThemeChange(theme.id)}
                                                role="radio"
                                                aria-checked={isSelected}
                                            >
                                                <span className="screenshot-panel__theme-title">{theme.label}</span>
                                                <span className="screenshot-panel__theme-subtitle">{subtitle}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </Form.Item>

                        <div className="screenshot-panel__group border border-gray-300 border-opacity-40 rounded-lg p-3 mb-3">
                            <div className="screenshot-panel__group-title text-xs uppercase tracking-wide mb-2">Elementos</div>
                            <div className="screenshot-panel__toggle flex items-center justify-between gap-3 py-1 pb-3">
                                <span>Moldura</span>
                                <Switch
                                    checked={settings?.showFrame}
                                    onChange={(checked) => updateSetting('showFrame', checked)}
                                />
                            </div>

                            <div className="screenshot-panel__toggle flex items-center justify-between gap-3 py-1 pb-3">
                                <span>Borda</span>
                                <Switch
                                    checked={settings?.showInnerBorder}
                                    onChange={(checked) => updateSetting('showInnerBorder', checked)}
                                />
                            </div>

                            <div className="screenshot-panel__toggle flex items-center justify-between gap-3 py-1 pb-3">
                                <span>Gradiente</span>
                                <Switch
                                    checked={settings?.showBackdrop}
                                    onChange={(checked) => updateSetting('showBackdrop', checked)}
                                />
                            </div>

                            <div className="screenshot-panel__toggle flex items-center justify-between gap-3 py-1 pb-3">
                                <span>Logo</span>
                                <Switch
                                    checked={settings?.showLogo}
                                    onChange={(checked) => updateSetting('showLogo', checked)}
                                />
                            </div>
                        </div>

                        <div className="screenshot-panel__group border border-gray-300 border-opacity-40 rounded-lg p-3 mb-3">
                            <div className="screenshot-panel__group-title text-xs uppercase tracking-wide mb-2">Texto</div>
                            <div className="screenshot-panel__toggle flex items-center justify-between gap-3 py-1 pb-3">
                                <span>Mostrar</span>
                                <Switch
                                    checked={settings?.showText}
                                    onChange={(checked) => updateSetting('showText', checked)}
                                />
                            </div>

                            <Form.Item label="Título">
                                <Input
                                    value={settings?.title}
                                    onChange={(event) => updateSetting('title', event.target.value)}
                                    disabled={!settings?.showText}
                                    placeholder="Cidade, bairro ou rota"
                                />
                            </Form.Item>

                            <Form.Item label="Subtítulo">
                                <Input
                                    value={settings?.subtitle}
                                    onChange={(event) => updateSetting('subtitle', event.target.value)}
                                    disabled={!settings?.showText}
                                    placeholder="Opcional"
                                />
                            </Form.Item>

                            <div className="screenshot-panel__toggle flex items-center justify-between gap-3 py-1 pb-3">
                                <span>Mostrar coordenadas</span>
                                <Switch
                                    checked={settings?.showCoords}
                                    onChange={(checked) => updateSetting('showCoords', checked)}
                                    disabled={!settings?.showText}
                                />
                            </div>
                        </div>
                    </Form>
                </div>

                <div className="screenshot-panel__preview w-full md:w-3/4 bg-black bg-opacity-10 rounded-none p-3 flex items-center justify-center min-h-96">
                    {previewUrl ? (
                        <img
                            src={previewUrl}
                            alt="Pré-visualização do mapa"
                            className="screenshot-panel__poster max-w-full rounded-none shadow-2xl"
                        />
                    ) : (
                        <div className="screenshot-panel__preview-placeholder text-sm text-white text-opacity-80">
                            {isRendering ? 'Gerando pré-visualização…' : 'Pré-visualização indisponível'}
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default ScreenshotPanel;
