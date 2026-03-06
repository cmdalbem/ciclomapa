import React, { Component } from 'react';
import { Button, Switch, Slider } from 'antd';
import { HiCog } from 'react-icons/hi';
import { HiPlay, HiPause, HiChevronDown } from 'react-icons/hi2';

// Playback timing
const TARGET_DURATION_MS = 5000;
const DEFAULT_FRAME_MS = 33;
const MIN_FRAME_MS = 10;
const MIN_SPEED = 0.25;
const MAX_SPEED = 4;
const SPEED_STEP = 0.25;

// Transition effects
const INTERPOLATION_STEPS = 12;
const SCALE_DURATION_MS = 400;
const COLOR_DURATION_MS = 800;
export const BIRTH_COLOR_DARK = '#ffffff';
export const BIRTH_COLOR_LIGHT = '#386641';

// Timeline UI
const MIN_LABEL_PCT = 15;

class AnimationMode extends Component {
    constructor(props) {
        super(props);
        this.state = {
            manifest: null,
            cityKeys: [],
            currentCity: null,
            snapshots: [],
            frames: [],
            currentFrame: 0,
            isPlaying: false,
            isLoading: true,
            loadProgress: 0,
            error: null,
            baseFrameMs: DEFAULT_FRAME_MS,
            speedMultiplier: 1,
            controlsVisible: true,
            settingsOpen: false,
            cityPickerOpen: false,
            settings: {
                highlightChanges: true,
                loopPlayback: false,
                showBirthEffect: true,
                effectDuration: 'normal',
                showHud: true,
            },
        };
        this.rafId = null;
        this.effectsRafId = null;
        this.lastFrameTime = 0;
        this.playing = false;

        this.currentBaseFeatures = [];
        this.featureBirthTimes = new Map();
        this.previousFeatureIds = new Set();
        this.previousFingerprints = new Map();
        this.effectsDirty = false;
    }

    async componentDidMount() {
        document.body.classList.add('animation-mode');
        document.addEventListener('keydown', this.handleKeyDown);
        await this.loadSnapshots();
    }

    componentWillUnmount() {
        document.body.classList.remove('animation-mode');
        document.removeEventListener('keydown', this.handleKeyDown);
        this.stopPlayback();
        this.stopEffectsLoop();
    }

    handleKeyDown = (e) => {
        switch (e.key) {
            case ' ':
                e.preventDefault();
                this.togglePlayback();
                break;
            case 'ArrowRight':
                e.preventDefault();
                this.stepForward();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                this.stepBackward();
                break;
            case 'h':
            case 'H':
                e.preventDefault();
                this.setState(prev => ({ controlsVisible: !prev.controlsVisible }));
                break;
            case 'Escape':
                if (this.state.cityPickerOpen) {
                    e.preventDefault();
                    this.setState({ cityPickerOpen: false });
                } else if (this.state.settingsOpen) {
                    e.preventDefault();
                    this.setState({ settingsOpen: false });
                }
                break;
            default:
                break;
        }
    }

    withEffects(feature, opacity, width) {
        return {
            ...feature,
            properties: {
                ...feature.properties,
                _opacity: opacity,
                ...(width !== 1 && { _width: width }),
            },
        };
    }

    featureFingerprint(feature) {
        const { id, _opacity, _width, ...props } = feature.properties;
        return JSON.stringify(feature.geometry) + JSON.stringify(props);
    }

    buildInterpolatedFrames(snapshots, settings = this.state?.settings) {
        const highlightChanges = settings?.highlightChanges ?? true;
        const frames = [];

        for (let i = 0; i < snapshots.length; i++) {
            const current = snapshots[i];
            const year = new Date(current.date).getUTCFullYear();

            if (i === snapshots.length - 1) {
                frames.push({ label: year.toString(), geoJson: current.geoJson, isKeyframe: true });
                break;
            }

            const next = snapshots[i + 1];
            const currentMap = new Map(
                current.geoJson.features.map(f => [f.properties.id || f.id, f])
            );

            const newFeatures = [];
            const changedFeatures = [];

            next.geoJson.features.forEach(f => {
                const fid = f.properties.id || f.id;
                const existing = currentMap.get(fid);
                if (!existing) {
                    newFeatures.push(f);
                } else if (this.featureFingerprint(existing) !== this.featureFingerprint(f)) {
                    changedFeatures.push(f);
                }
            });

            frames.push({ label: year.toString(), geoJson: current.geoJson, isKeyframe: true });

            const transitioning = highlightChanges
                ? [...newFeatures, ...changedFeatures]
                : [...newFeatures];
            if (transitioning.length === 0) continue;

            const changedIds = highlightChanges
                ? new Set(changedFeatures.map(f => f.properties.id || f.id))
                : new Set();
            const steps = Math.min(INTERPOLATION_STEPS, transitioning.length);
            const batchSize = Math.ceil(transitioning.length / steps);
            const batches = [];
            for (let b = 0; b < steps; b++) {
                batches.push(transitioning.slice(b * batchSize, (b + 1) * batchSize));
            }

            for (let s = 1; s <= steps; s++) {
                const progress = Math.round((s / steps) * 100);
                const revealed = [];
                const revealedChangedIds = new Set();
                for (let b = 0; b < s; b++) {
                    for (const f of batches[b]) {
                        revealed.push(f);
                        const fid = f.properties.id || f.id;
                        if (changedIds.has(fid)) {
                            revealedChangedIds.add(fid);
                        }
                    }
                }
                const baseFeatures = current.geoJson.features.filter(f => {
                    const fid = f.properties.id || f.id;
                    return !revealedChangedIds.has(fid);
                });
                frames.push({
                    label: `${year} +${progress}%`,
                    geoJson: {
                        type: 'FeatureCollection',
                        features: [...baseFeatures, ...revealed],
                    },
                    isKeyframe: false,
                });
            }
        }

        return frames;
    }

    async loadSnapshots() {
        try {
            const manifestResponse = await fetch('/history/manifest.json');
            if (!manifestResponse.ok) {
                throw new Error(`Failed to load manifest: ${manifestResponse.status}. Run scripts/fetch-history.js first.`);
            }
            const manifest = await manifestResponse.json();

            let cityKey = null;
            let cityKeys = [];
            if (manifest.cities) {
                const params = new URLSearchParams(window.location.search);
                const requestedCity = params.get('city');
                cityKeys = Object.keys(manifest.cities);
                cityKey = requestedCity && manifest.cities[requestedCity]
                    ? requestedCity
                    : cityKeys[0];
            }

            this.setState({ manifest, cityKeys, currentCity: cityKey });
            await this.loadCity(manifest, cityKey);
            this.startEffectsLoop();
        } catch (error) {
            this.setState({ error: error.message, isLoading: false });
        }
    }

    async loadCity(manifest, cityKey) {
        this.stopPlayback();
        this.setState({ isLoading: true, loadProgress: 0 });

        const cityData = manifest.cities ? manifest.cities[cityKey] : manifest;
        const total = cityData.snapshots.length;
        const loaded = [];

        const loadPromises = cityData.snapshots.map(async (snapshot) => {
            const response = await fetch(`/history/${snapshot.file}`);
            if (!response.ok) {
                console.warn(`Failed to load ${snapshot.file}: ${response.status}`);
                return null;
            }
            const geoJson = await response.json();
            this.setState({ loadProgress: Math.round(((loaded.push(1)) / total) * 100) });
            return { date: snapshot.date, geoJson };
        });

        const results = await Promise.all(loadPromises);
        const snapshots = results.filter(Boolean);

        if (snapshots.length === 0) {
            throw new Error('No snapshots loaded. Run scripts/fetch-history.js first.');
        }

        snapshots.sort((a, b) => new Date(a.date) - new Date(b.date));

        const frames = this.buildInterpolatedFrames(snapshots);
        const baseFrameMs = Math.max(MIN_FRAME_MS, Math.round(TARGET_DURATION_MS / frames.length));

        this.featureBirthTimes.clear();
        this.previousFeatureIds = new Set();
        this.previousFingerprints = new Map();

        if (frames.length > 0) {
            const firstFrame = frames[0];
            this.previousFeatureIds = new Set(
                firstFrame.geoJson.features.map(f => f.properties.id || f.id)
            );
            this.previousFingerprints = new Map(
                firstFrame.geoJson.features.map(f => [
                    f.properties.id || f.id,
                    this.featureFingerprint(f),
                ])
            );
            this.currentBaseFeatures = firstFrame.geoJson.features;
            this.effectsDirty = true;
        }

        this.setState({
            snapshots,
            frames,
            isLoading: false,
            currentFrame: 0,
            baseFrameMs,
            currentCity: cityKey,
        });

        this.fitMapToData(snapshots);
    }

    switchCity = async (cityKey) => {
        try {
            await this.loadCity(this.state.manifest, cityKey);
        } catch (error) {
            this.setState({ error: error.message, isLoading: false });
        }
    }

    fitMapToData(snapshots) {
        const mapComponent = window.map;
        if (!mapComponent?.map || snapshots.length === 0) return;

        const lastSnapshot = snapshots[snapshots.length - 1];
        const features = lastSnapshot.geoJson.features;
        if (features.length === 0) return;

        let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
        for (const feature of features) {
            const coords = feature.geometry?.coordinates;
            if (!coords) continue;
            const flat = feature.geometry.type === 'Point' ? [coords]
                : feature.geometry.type === 'LineString' ? coords
                : feature.geometry.type === 'Polygon' ? coords.flat()
                : feature.geometry.type === 'MultiLineString' ? coords.flat()
                : feature.geometry.type === 'MultiPolygon' ? coords.flat(2)
                : [];
            for (const [lng, lat] of flat) {
                if (lng < minLng) minLng = lng;
                if (lng > maxLng) maxLng = lng;
                if (lat < minLat) minLat = lat;
                if (lat > maxLat) maxLat = lat;
            }
        }

        if (!isFinite(minLng)) return;

        mapComponent.map.fitBounds(
            [[minLng, minLat], [maxLng, maxLat]],
            { padding: 60, duration: 1200 }
        );
    }

    togglePlayback = () => {
        if (this.state.isPlaying) {
            this.stopPlayback();
        } else {
            this.startPlayback();
        }
    }

    getFrameMs() {
        return this.state.baseFrameMs / this.state.speedMultiplier;
    }

    startPlayback = () => {
        if (this.state.frames.length === 0) return;
        if (this.state.currentFrame >= this.state.frames.length - 1) {
            this.showFrame(0);
            this.setState({ currentFrame: 0 });
        }
        this.playing = true;
        this.setState({ isPlaying: true });
        this.lastFrameTime = performance.now();
        this.rafId = requestAnimationFrame(this.tick);
    }

    tick = (now) => {
        if (!this.playing) return;

        const elapsed = now - this.lastFrameTime;
        const frameMs = this.getFrameMs();

        if (elapsed >= frameMs) {
            this.lastFrameTime = now;
            let nextFrame = this.state.currentFrame + 1;
            if (nextFrame >= this.state.frames.length) {
                if (this.state.settings.loopPlayback) {
                    nextFrame = 0;
                } else {
                    this.stopPlayback();
                    return;
                }
            }
            this.showFrame(nextFrame);
            this.setState({ currentFrame: nextFrame });
        }

        this.rafId = requestAnimationFrame(this.tick);
    }

    stopPlayback = () => {
        this.playing = false;
        this.setState({ isPlaying: false });
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    showFrame = (index) => {
        const frame = this.state.frames[index];
        if (!frame) return;

        const now = performance.now();
        const newFeatureIds = new Set();
        const newFingerprints = new Map();

        frame.geoJson.features.forEach(f => {
            const fid = f.properties.id || f.id;
            const fp = this.featureFingerprint(f);
            newFeatureIds.add(fid);
            newFingerprints.set(fid, fp);
            const isNew = !this.previousFeatureIds.has(fid);
            const isChanged = !isNew && this.previousFingerprints.get(fid) !== fp;
            if (isNew || (isChanged && this.state.settings.highlightChanges)) {
                this.featureBirthTimes.set(fid, now);
            }
        });

        for (const fid of this.featureBirthTimes.keys()) {
            if (!newFeatureIds.has(fid)) {
                this.featureBirthTimes.delete(fid);
            }
        }

        this.currentBaseFeatures = frame.geoJson.features;
        this.previousFeatureIds = newFeatureIds;
        this.previousFingerprints = newFingerprints;
        this.effectsDirty = true;
    }

    startEffectsLoop() {
        this.effectsRafId = requestAnimationFrame(this.effectsTick);
    }

    effectsTick = (now) => {
        const { showBirthEffect, effectDuration } = this.state.settings;
        const hasActiveEffects = showBirthEffect && this.featureBirthTimes.size > 0;

        if ((this.effectsDirty || hasActiveEffects) && this.currentBaseFeatures.length > 0) {
            this.effectsDirty = false;

            let features;
            if (hasActiveEffects) {
                const durationScale = { fast: 0.5, normal: 1, slow: 2 }[effectDuration] || 1;
                const scaleDur = SCALE_DURATION_MS * durationScale;
                const colorDur = COLOR_DURATION_MS * durationScale;
                const maxDuration = Math.max(scaleDur, colorDur);
                features = this.currentBaseFeatures.map(f => {
                    const fid = f.properties.id || f.id;
                    const birthTime = this.featureBirthTimes.get(fid);
                    if (birthTime !== undefined) {
                        const age = now - birthTime;
                        if (age < maxDuration) {
                            const opacity = Math.min(1, age / colorDur);
                            const t = Math.min(1, age / scaleDur);
                            const width = t < 0.5
                                ? t * 4        // 0 → 2
                                : 2 - (t - 0.5) * 2; // 2 → 1
                            return this.withEffects(f, opacity, width);
                        }
                        this.featureBirthTimes.delete(fid);
                    }
                    return f;
                });
            } else {
                features = this.currentBaseFeatures;
            }

            if (this.props.onDataChange) {
                this.props.onDataChange({
                    type: 'FeatureCollection',
                    features,
                });
            }
        }

        this.effectsRafId = requestAnimationFrame(this.effectsTick);
    }

    stopEffectsLoop() {
        if (this.effectsRafId) {
            cancelAnimationFrame(this.effectsRafId);
            this.effectsRafId = null;
        }
    }

    stepForward = () => {
        this.stopPlayback();
        this.setState(prev => {
            const nextFrame = Math.min(prev.currentFrame + 1, prev.frames.length - 1);
            this.showFrame(nextFrame);
            return { currentFrame: nextFrame };
        });
    }

    stepBackward = () => {
        this.stopPlayback();
        this.setState(prev => {
            const nextFrame = Math.max(prev.currentFrame - 1, 0);
            this.showFrame(nextFrame);
            return { currentFrame: nextFrame };
        });
    }

    jumpToKeyframe = (direction) => {
        this.stopPlayback();
        this.setState(prev => {
            const { frames, currentFrame } = prev;
            let target = currentFrame;
            if (direction > 0) {
                for (let i = currentFrame + 1; i < frames.length; i++) {
                    if (frames[i].isKeyframe) { target = i; break; }
                }
            } else {
                for (let i = currentFrame - 1; i >= 0; i--) {
                    if (frames[i].isKeyframe) { target = i; break; }
                }
            }
            this.showFrame(target);
            return { currentFrame: target };
        });
    }

    onSpeedChange = (e) => {
        this.setState({ speedMultiplier: parseFloat(e.target.value) });
    }

    onScrub = (e) => {
        const index = parseInt(e.target.value, 10);
        this.stopPlayback();
        this.showFrame(index);
        this.setState({ currentFrame: index });
    }

    toggleSettings = () => {
        this.setState(prev => ({ settingsOpen: !prev.settingsOpen }));
    }

    updateSetting = (key, value) => {
        this.setState(prev => {
            const newSettings = { ...prev.settings, [key]: value };

            if (key === 'highlightChanges') {
                const frames = this.buildInterpolatedFrames(prev.snapshots, newSettings);
                const baseFrameMs = Math.max(MIN_FRAME_MS, Math.round(TARGET_DURATION_MS / frames.length));
                const currentFrame = Math.min(prev.currentFrame, frames.length - 1);
                return { settings: newSettings, frames, baseFrameMs, currentFrame };
            }

            return { settings: newSettings };
        }, () => {
            if (key === 'highlightChanges') {
                this.showFrame(this.state.currentFrame);
            }
        });
    }

    renderTicks() {
        const { frames } = this.state;
        if (frames.length < 2) return null;

        const keyframes = frames
            .map((f, i) => f.isKeyframe ? { index: i, label: f.label, pct: (i / (frames.length - 1)) * 100 } : null)
            .filter(Boolean);

        let lastLabelPct = -Infinity;
        const labeled = new Set();
        // Always label the last keyframe
        labeled.add(keyframes[keyframes.length - 1].index);
        // Walk forward, labeling when there's enough space
        for (const kf of keyframes) {
            if (kf.pct - lastLabelPct >= MIN_LABEL_PCT) {
                labeled.add(kf.index);
                lastLabelPct = kf.pct;
            }
        }

        return keyframes.map(kf => {
            const showLabel = labeled.has(kf.index);
            return (
                <span
                    key={kf.index}
                    className={`animation-tick${showLabel ? ' animation-tick--labeled' : ''}`}
                    style={{ left: `${kf.pct}%` }}
                    onClick={() => { this.stopPlayback(); this.showFrame(kf.index); this.setState({ currentFrame: kf.index }); }}
                >
                    {showLabel ? kf.label : ''}
                </span>
            );
        });
    }

    getCurrentLabel() {
        const { frames, currentFrame } = this.state;
        if (frames.length === 0) return '';
        return frames[currentFrame].label;
    }

    getYearDisplay() {
        const label = this.getCurrentLabel();
        return label.split(' ')[0];
    }

    getCurrentFeatureCount() {
        const { frames, currentFrame } = this.state;
        if (frames.length === 0) return 0;
        return frames[currentFrame].geoJson.features.length;
    }

    render() {
        const { isLoading, error, loadProgress, frames, currentFrame, isPlaying, speedMultiplier, baseFrameMs, controlsVisible, settingsOpen, settings, manifest, cityKeys, currentCity } = this.state;

        if (isLoading) {
            return (
                <div className="animation-overlay">
                    <div className="animation-loading">
                        Carregando dados... {loadProgress}%
                    </div>
                </div>
            );
        }

        if (error) {
            return (
                <div className="animation-overlay">
                    <div className="animation-error">{error}</div>
                </div>
            );
        }

        return (
            <div className="animation-overlay">
                {settings.showHud && (
                    <div className="animation-hud">
                        {cityKeys.length > 1 && (
                            <div className="animation-city-picker">
                                <button
                                    className="animation-city-picker-trigger"
                                    onClick={() => this.setState(s => ({ cityPickerOpen: !s.cityPickerOpen }))}
                                >
                                    {manifest.cities[currentCity].area}
                                    <HiChevronDown className={`animation-city-picker-chevron ${this.state.cityPickerOpen ? 'open' : ''}`} />
                                </button>
                                {this.state.cityPickerOpen && (
                                    <>
                                        <div
                                            className="animation-city-picker-backdrop"
                                            onClick={() => this.setState({ cityPickerOpen: false })}
                                        />
                                        <ul className="animation-city-picker-menu">
                                            {cityKeys.map(key => (
                                                <li
                                                    key={key}
                                                    className={`animation-city-picker-item ${key === currentCity ? 'active' : ''}`}
                                                    onClick={() => {
                                                        this.setState({ cityPickerOpen: false });
                                                        if (key !== currentCity) this.switchCity(key);
                                                    }}
                                                >
                                                    {manifest.cities[key].area}
                                                </li>
                                            ))}
                                        </ul>
                                    </>
                                )}
                            </div>
                        )}
                        <span className="animation-hud-year">{this.getYearDisplay()}</span>
                        <span className="animation-hud-count">
                            {this.getCurrentFeatureCount()} elementos
                        </span>
                    </div>
                )}

                {controlsVisible && (
                    <>
                        {settingsOpen && (
                            <div className="pointer-events-auto flex gap-0 mb-2 rounded-xl overflow-hidden glass-bg text-xs select-none animation-settings-panel">
                                <div className="flex flex-col gap-2 px-4 py-3 w-52 animation-settings-divider">
                                    <span className="text-xs font-semibold opacity-60">Efeitos</span>
                                    <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap" title="Elementos novos aparecem com efeito de escala e transparência">
                                        <Switch size="small" checked={settings.showBirthEffect} onChange={v => this.updateSetting('showBirthEffect', v)} />
                                        <span>Animação de entrada</span>
                                    </label>
                                    <label className={`flex items-center gap-2 whitespace-nowrap ${settings.showBirthEffect ? 'cursor-pointer' : 'opacity-35 pointer-events-none'}`} title="Animar elementos cuja geometria ou tipo mudou entre períodos">
                                        <Switch size="small" checked={settings.highlightChanges} onChange={v => this.updateSetting('highlightChanges', v)} disabled={!settings.showBirthEffect} />
                                        <span>Destacar modificados</span>
                                    </label>
                                    <div className={`flex items-center gap-2 whitespace-nowrap ${settings.showBirthEffect ? '' : 'opacity-35 pointer-events-none'}`} title="Quão rápido os efeitos de entrada são reproduzidos">
                                        <span>Vel. do efeito</span>
                                        <Slider
                                            min={0} max={2} step={1}
                                            value={{ fast: 0, normal: 1, slow: 2 }[settings.effectDuration] ?? 1}
                                            onChange={v => this.updateSetting('effectDuration', ['fast', 'normal', 'slow'][v])}
                                            disabled={!settings.showBirthEffect}
                                            tooltipVisible={false}
                                            className="w-16 m-0"
                                        />
                                        <span className="tabular-nums min-w-[38px] text-right opacity-70">{{ fast: 'Rápido', normal: 'Normal', slow: 'Lento' }[settings.effectDuration]}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 px-4 py-3 w-52 animation-settings-divider">
                                    <span className="text-xs font-semibold opacity-60">Reprodução</span>
                                    <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap" title="Reiniciar automaticamente do início quando chegar ao fim">
                                        <Switch size="small" checked={settings.loopPlayback} onChange={v => this.updateSetting('loopPlayback', v)} />
                                        <span>Reiniciar automaticamente</span>
                                    </label>
                                    <div className="flex items-center gap-2 whitespace-nowrap" title={'Duração total estimada: ' + Math.round(frames.length * baseFrameMs / speedMultiplier / 1000) + 's'}>
                                        <span>Velocidade</span>
                                        <Slider
                                            min={MIN_SPEED} max={MAX_SPEED} step={SPEED_STEP}
                                            value={speedMultiplier}
                                            onChange={v => this.setState({ speedMultiplier: v })}
                                            tooltipVisible={false}
                                            className="w-16 m-0"
                                        />
                                        <span className="tabular-nums min-w-[38px] text-right opacity-70">{speedMultiplier.toFixed(2)}x</span>
                                    </div>
                                    <div className="opacity-40 mt-auto pt-2 flex flex-col gap-1">
                                        <span><kbd className="px-1.5 py-0.5 rounded border border-current opacity-60 text-[10px] font-mono">Espaço</kbd> play/pause</span>
                                        <span><kbd className="px-1.5 py-0.5 rounded border border-current opacity-60 text-[10px] font-mono">← →</kbd> avançar/voltar</span>
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 px-4 py-3 w-52">
                                    <span className="text-xs font-semibold opacity-60">Exibição</span>
                                    <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap" title="Mostrar o ano atual e a quantidade de elementos sobre o mapa">
                                        <Switch size="small" checked={settings.showHud} onChange={v => this.updateSetting('showHud', v)} />
                                        <span>Ano e contagem</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap" title="Alternar entre o tema claro e escuro do mapa">
                                        <Switch size="small" checked={this.props.isDarkMode} onChange={() => this.props.toggleTheme()} />
                                        <span>Modo escuro</span>
                                    </label>
                                    <span className="opacity-40 mt-auto pt-2"><kbd className="px-1.5 py-0.5 rounded border border-current opacity-60 text-[10px] font-mono">H</kbd> ocultar UI</span>
                                </div>
                            </div>
                        )}
                        <div className="animation-controls glass-bg">
                            <Button
                                type="primary"
                                shape="circle"
                                icon={isPlaying ? <HiPause /> : <HiPlay />}
                                onClick={this.togglePlayback}
                                title="Reproduzir/Pausar (Espaço)"
                            />

                            <div className="animation-timeline">
                                <input
                                    type="range"
                                    min={0}
                                    max={frames.length - 1}
                                    value={currentFrame}
                                    onChange={this.onScrub}
                                    className="animation-scrubber"
                                    title="Linha do tempo"
                                />
                                <div className="animation-tick-marks">
                                    {this.renderTicks()}
                                </div>
                            </div>

                            <Button
                                type={settingsOpen ? 'primary' : 'default'}
                                shape="circle"
                                icon={<HiCog />}
                                onClick={this.toggleSettings}
                                title="Configurações"
                            />
                        </div>
                    </>
                )}
            </div>
        );
    }
}

export default AnimationMode;
