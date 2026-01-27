import React, { useEffect, useState } from 'react';
import {
    Modal,
    Form,
    Select,
    InputNumber,
    Switch,
    Input,
    Space
} from 'antd';

import { renderPosterDataUrl } from './renderPoster.js';
import { getThemeColors } from './exportMapScreenshot.js';
import { POSTER_PRESETS, POSTER_MAP_THEMES } from './posterDefaults.js';
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
    const presetId = settings?.presetId || 'portrait';
    const isCustom = settings?.useCustomSize || presetId === 'custom';

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
            await withMapBasemapHidden(map, settings?.hideBasemap === true, async () => (
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
                        coords: settings.showCoords !== false && settings.showText !== false && coords
                            ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
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
    }, [open, map, settings, coords, titleFallback]);

    return (
        <Modal
            className="screenshot-panel"
            title="Exportar imagem"
            open={open}
            onCancel={onCancel}
            onOk={onExport}
            okText="Exportar PNG"
            cancelText="Cancelar"
            width="90vw"
            style={{ top: 24 }}
            bodyStyle={{ maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }}
        >
            <div className="flex flex-col md:flex-row gap-4">
                <div className="w-full md:w-1/4">
                    <Form layout="vertical">
                        <Form.Item label="Formato e resolução">
                            <Select
                                value={presetId}
                                onChange={handlePresetChange}
                                options={POSTER_PRESETS.map((preset) => ({
                                    value: preset.id,
                                    label: preset.label
                                }))}
                            />
                        </Form.Item>

                        <Form.Item label="Estilo do mapa">
                            <Select
                                value={settings?.mapTheme || 'default'}
                                onChange={handleMapThemeChange}
                                options={POSTER_MAP_THEMES.map((theme) => ({
                                    value: theme.id,
                                    label: theme.label
                                }))}
                            />
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

                        <div className="screenshot-panel__toggle flex items-center justify-between gap-3 py-1 pb-3">
                            <span>Moldura</span>
                            <Switch
                                checked={settings?.showFrame}
                                onChange={(checked) => updateSetting('showFrame', checked)}
                            />
                        </div>

                        <div className="screenshot-panel__toggle flex items-center justify-between gap-3 py-1 pb-3">
                            <span>Borda interna</span>
                            <Switch
                                checked={settings?.showInnerBorder}
                                onChange={(checked) => updateSetting('showInnerBorder', checked)}
                            />
                        </div>

                        <div className="screenshot-panel__toggle flex items-center justify-between gap-3 py-1 pb-3">
                            <span>Ocultar base do mapa</span>
                            <Switch
                                checked={settings?.hideBasemap}
                                onChange={(checked) => updateSetting('hideBasemap', checked)}
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

                        <div className="screenshot-panel__toggle flex items-center justify-between gap-3 py-1 pb-3">
                            <span>Texto</span>
                            <Switch
                                checked={settings?.showText}
                                onChange={(checked) => updateSetting('showText', checked)}
                            />
                        </div>

                        <div className="screenshot-panel__group border border-gray-300 border-opacity-40 rounded-lg p-3 mb-3">
                            <div className="screenshot-panel__group-title text-xs tracking-wider uppercase mb-2">
                                Texto do pôster
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

                <div className="w-full md:w-3/4 bg-black bg-opacity-10 rounded-none p-3 flex items-center justify-center min-h-96">
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
