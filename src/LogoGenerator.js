import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Slider, Select, Switch, Button, InputNumber, Checkbox, Tooltip } from 'antd';
import { HiDownload, HiRefresh, HiX } from 'react-icons/hi';
import {
    drawLogo,
    downloadCanvas,
    downloadMatrixAsPng,
    DEFAULT_PARAMS,
    COLORS,
} from './logoGeneratorUtils';

const { Option } = Select;

const SECTION_STYLE = {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottom: '1px solid rgba(255,255,255,0.08)',
};

const LABEL_STYLE = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 2,
    fontWeight: 500,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
};

const SECTION_TITLE = {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.3)',
    marginBottom: 10,
};

function ParamSlider({ label, value, onChange, min, max, step = 1, tipFormatter }) {
    return (
        <div style={{ marginBottom: 8 }}>
            <div style={LABEL_STYLE}>
                <span>{label}</span>
                <span style={{ color: 'rgba(255,255,255,0.35)', fontVariantNumeric: 'tabular-nums' }}>
                    {tipFormatter ? tipFormatter(value) : value}
                </span>
            </div>
            <Slider
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={onChange}
                tooltipVisible={false}
            />
        </div>
    );
}

export default function LogoGenerator({ visible, onClose }) {
    const [params, setParams] = useState(DEFAULT_PARAMS);
    const [selectedIndex, setSelectedIndex] = useState(null);
    const cellCanvasRefs = useRef([]);

    const updateParam = useCallback((key, value) => {
        setParams(prev => ({ ...prev, [key]: value }));
    }, []);

    const totalCells = params.gridCols * params.gridRows;
    const seeds = Array.from({ length: totalCells }, (_, i) => params.masterSeed + i * 7);

    const handleDownloadSingle = useCallback(() => {
        if (selectedIndex === null) return;
        const canvases = cellCanvasRefs.current;
        if (canvases[selectedIndex]) {
            downloadCanvas(canvases[selectedIndex], `ciclomapa-logo-${seeds[selectedIndex]}.png`);
        }
    }, [selectedIndex, seeds]);

    const handleDownloadMatrix = useCallback(() => {
        const canvases = cellCanvasRefs.current.filter(Boolean);
        if (canvases.length) {
            downloadMatrixAsPng(canvases, params.gridCols, 8, 'ciclomapa-logo-matrix.png');
        }
    }, [params.gridCols]);

    const randomizeSeed = useCallback(() => {
        updateParam('masterSeed', Math.floor(Math.random() * 100000));
    }, [updateParam]);

    // Collect canvas refs from cells
    const setCellRef = useCallback((index, canvas) => {
        cellCanvasRefs.current[index] = canvas;
    }, []);

    useEffect(() => {
        if (!visible) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [visible, onClose]);

    if (!visible) return null;

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 1000,
                display: 'flex',
                background: 'rgba(0,0,0,0.95)',
                color: 'white',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
        >
            {/* Sidebar */}
            <div style={{
                width: 300,
                minWidth: 300,
                height: '100vh',
                overflowY: 'auto',
                padding: '20px 16px',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>
                        Logo Generator
                    </h2>
                    <Button
                        type="text"
                        size="small"
                        onClick={onClose}
                        icon={<HiX />}
                        style={{ color: 'rgba(255,255,255,0.5)' }}
                    />
                </div>

                {/* Street Grid */}
                <div style={SECTION_STYLE}>
                    <div style={SECTION_TITLE}>Street Grid</div>
                    <div style={{ marginBottom: 8 }}>
                        <div style={LABEL_STYLE}><span>Pattern</span></div>
                        <Select
                            value={params.pattern}
                            onChange={v => updateParam('pattern', v)}
                            style={{ width: '100%' }}
                            size="small"
                        >
                            <Option value="grid">Grid</Option>
                            <Option value="organic">Organic</Option>
                            <Option value="radial">Radial</Option>
                        </Select>
                    </div>
                    <ParamSlider
                        label="Street Count"
                        value={params.streetCount}
                        onChange={v => updateParam('streetCount', v)}
                        min={4} max={24}
                    />
                    <ParamSlider
                        label="Deformation"
                        value={params.curviness}
                        onChange={v => updateParam('curviness', v)}
                        min={0} max={1} step={0.05}
                        tipFormatter={v => `${Math.round(v * 100)}%`}
                    />
                    <ParamSlider
                        label="Street Width"
                        value={params.streetWidth}
                        onChange={v => updateParam('streetWidth', v)}
                        min={0.5} max={8} step={0.5}
                        tipFormatter={v => `${v}px`}
                    />
                    <ParamSlider
                        label="Irregularity"
                        value={params.irregularity}
                        onChange={v => updateParam('irregularity', v)}
                        min={0} max={1} step={0.05}
                        tipFormatter={v => `${Math.round(v * 100)}%`}
                    />
                </div>

                {/* Cycling Infrastructure */}
                <div style={SECTION_STYLE}>
                    <div style={SECTION_TITLE}>Infrastructure</div>
                    <ParamSlider
                        label="Infra Lines"
                        value={params.infraDensity}
                        onChange={v => updateParam('infraDensity', v)}
                        min={0} max={12}
                    />
                    <ParamSlider
                        label="Ciclovia Weight"
                        value={params.cicloviaWeight}
                        onChange={v => updateParam('cicloviaWeight', v)}
                        min={0} max={1} step={0.05}
                        tipFormatter={v => `${Math.round(v * 100)}%`}
                    />
                    <ParamSlider
                        label="Infra Line Width"
                        value={params.infraLineWidth}
                        onChange={v => updateParam('infraLineWidth', v)}
                        min={1} max={10} step={0.5}
                        tipFormatter={v => `${v}px`}
                    />
                    <ParamSlider
                        label="Border"
                        value={params.infraBorder}
                        onChange={v => updateParam('infraBorder', v)}
                        min={0} max={6} step={0.5}
                        tipFormatter={v => `${v}px`}
                    />
                    <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                        <div style={{ flex: 1 }}>
                            <div style={LABEL_STYLE}><span>Dashed</span></div>
                            <Switch
                                size="small"
                                checked={params.showDashed}
                                onChange={v => updateParam('showDashed', v)}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <div style={LABEL_STYLE}><span>Light Colors</span></div>
                            <Switch
                                size="small"
                                checked={params.useLightColors}
                                onChange={v => updateParam('useLightColors', v)}
                            />
                        </div>
                    </div>
                </div>

                {/* POIs */}
                <div style={SECTION_STYLE}>
                    <div style={SECTION_TITLE}>Points of Interest</div>
                    <ParamSlider
                        label="POI Count"
                        value={params.poiCount}
                        onChange={v => updateParam('poiCount', v)}
                        min={0} max={20}
                    />
                    <ParamSlider
                        label="POI Size"
                        value={params.poiSize}
                        onChange={v => updateParam('poiSize', v)}
                        min={1} max={10} step={0.5}
                        tipFormatter={v => `${v}px`}
                    />
                    <div style={{ marginBottom: 8 }}>
                        <div style={LABEL_STYLE}><span>POI Types</span></div>
                        <Checkbox.Group
                            value={params.poiTypes}
                            onChange={v => updateParam('poiTypes', v)}
                            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                        >
                            <Checkbox value="shops" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                                <span style={{ color: COLORS.poiShops }}>●</span> Shops
                            </Checkbox>
                            <Checkbox value="rental" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                                <span style={{ color: COLORS.poiRental }}>●</span> Rental
                            </Checkbox>
                            <Checkbox value="parking" style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
                                <span style={{ color: COLORS.poiParking }}>●</span> Parking
                            </Checkbox>
                        </Checkbox.Group>
                    </div>
                </div>

                {/* Shape & Canvas */}
                <div style={SECTION_STYLE}>
                    <div style={SECTION_TITLE}>Shape & Canvas</div>
                    <div style={{ marginBottom: 8 }}>
                        <div style={LABEL_STYLE}><span>Shape</span></div>
                        <Select
                            value={params.shape}
                            onChange={v => updateParam('shape', v)}
                            style={{ width: '100%' }}
                            size="small"
                        >
                            <Option value="circle">Circle</Option>
                            <Option value="rounded-square">Rounded Square</Option>
                            <Option value="squircle">Squircle</Option>
                            <Option value="square">Square</Option>
                        </Select>
                    </div>
                    <ParamSlider
                        label="Logo Size"
                        value={params.logoSize}
                        onChange={v => updateParam('logoSize', v)}
                        min={48} max={512} step={8}
                        tipFormatter={v => `${v}px`}
                    />
                    <ParamSlider
                        label="Padding"
                        value={params.padding}
                        onChange={v => updateParam('padding', v)}
                        min={0} max={0.25} step={0.01}
                        tipFormatter={v => `${Math.round(v * 100)}%`}
                    />
                    <div style={{ marginBottom: 8 }}>
                        <div style={LABEL_STYLE}><span>Line Cap</span></div>
                        <Select
                            value={params.lineCap}
                            onChange={v => updateParam('lineCap', v)}
                            style={{ width: '100%' }}
                            size="small"
                        >
                            <Option value="round">Round</Option>
                            <Option value="butt">Butt</Option>
                            <Option value="square">Square</Option>
                        </Select>
                    </div>
                </div>

                {/* Matrix & Randomness */}
                <div style={SECTION_STYLE}>
                    <div style={SECTION_TITLE}>Matrix & Randomness</div>
                    <ParamSlider
                        label="Columns"
                        value={params.gridCols}
                        onChange={v => updateParam('gridCols', v)}
                        min={1} max={10}
                    />
                    <ParamSlider
                        label="Rows"
                        value={params.gridRows}
                        onChange={v => updateParam('gridRows', v)}
                        min={1} max={8}
                    />
                    <div style={{ marginBottom: 8 }}>
                        <div style={LABEL_STYLE}><span>Master Seed</span></div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <InputNumber
                                size="small"
                                value={params.masterSeed}
                                onChange={v => updateParam('masterSeed', v || 0)}
                                style={{ flex: 1 }}
                                min={0}
                                max={999999}
                            />
                            <Tooltip title="Randomize seed">
                                <Button
                                    size="small"
                                    icon={<HiRefresh />}
                                    onClick={randomizeSeed}
                                    style={{ display: 'flex', alignItems: 'center' }}
                                />
                            </Tooltip>
                        </div>
                    </div>
                </div>

                {/* Export */}
                <div style={{ marginBottom: 20 }}>
                    <div style={SECTION_TITLE}>Export</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <Button
                            size="small"
                            icon={<HiDownload style={{ marginRight: 6 }} />}
                            disabled={selectedIndex === null}
                            onClick={handleDownloadSingle}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            Download Selected
                        </Button>
                        <Button
                            size="small"
                            icon={<HiDownload style={{ marginRight: 6 }} />}
                            onClick={handleDownloadMatrix}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            Download Matrix
                        </Button>
                    </div>
                </div>
            </div>

            {/* Matrix area */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                padding: 24,
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${params.gridCols}, ${params.logoSize + 4}px)`,
                    gap: 8,
                }}>
                    {seeds.map((seed, i) => (
                        <LogoCellWithRef
                            key={`${seed}-${JSON.stringify(params)}`}
                            params={params}
                            seed={seed}
                            index={i}
                            selected={selectedIndex === i}
                            onSelect={setSelectedIndex}
                            refCallback={setCellRef}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

// Wrapper to forward canvas ref up for export
function LogoCellWithRef({ params, seed, index, selected, onSelect, refCallback }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (canvasRef.current) {
            drawLogo(canvasRef.current, params, seed);
            refCallback(index, canvasRef.current);
        }
    }, [params, seed, index, refCallback]);

    return (
        <div
            onClick={() => onSelect(index)}
            style={{
                cursor: 'pointer',
                border: selected ? '2px solid #A7C957' : '2px solid transparent',
                borderRadius: 8,
                padding: 2,
                transition: 'border-color 0.15s',
                position: 'relative',
            }}
        >
            <canvas
                ref={canvasRef}
                style={{ display: 'block', borderRadius: 6 }}
            />
            <div style={{
                position: 'absolute',
                bottom: 6,
                right: 6,
                fontSize: 9,
                color: 'rgba(255,255,255,0.2)',
                fontVariantNumeric: 'tabular-nums',
            }}>
                #{seed}
            </div>
        </div>
    );
}
