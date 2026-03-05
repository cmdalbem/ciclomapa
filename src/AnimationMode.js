import React, { Component } from 'react';

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
        };
        this.rafId = null;
        this.effectsRafId = null;
        this.lastFrameTime = 0;
        this.playing = false;

        this.currentBaseFeatures = [];
        this.featureBirthTimes = new Map();
        this.previousFeatureIds = new Set();
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
                if (e.shiftKey) {
                    this.jumpToKeyframe(1);
                } else {
                    this.stepForward();
                }
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (e.shiftKey) {
                    this.jumpToKeyframe(-1);
                } else {
                    this.stepBackward();
                }
                break;
            case 'h':
            case 'H':
                e.preventDefault();
                this.setState(prev => ({ controlsVisible: !prev.controlsVisible }));
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

    buildInterpolatedFrames(snapshots) {
        const frames = [];

        for (let i = 0; i < snapshots.length; i++) {
            const current = snapshots[i];
            const year = new Date(current.date).getUTCFullYear();

            if (i === snapshots.length - 1) {
                frames.push({ label: year.toString(), geoJson: current.geoJson, isKeyframe: true });
                break;
            }

            const next = snapshots[i + 1];
            const currentIds = new Set(current.geoJson.features.map(f => f.properties.id || f.id));
            const persistedFeatures = current.geoJson.features;
            const newFeatures = next.geoJson.features.filter(f => {
                const fid = f.properties.id || f.id;
                return !currentIds.has(fid);
            });

            frames.push({ label: year.toString(), geoJson: current.geoJson, isKeyframe: true });

            if (newFeatures.length === 0) continue;

            const steps = Math.min(INTERPOLATION_STEPS, newFeatures.length);
            const batchSize = Math.ceil(newFeatures.length / steps);
            const batches = [];
            for (let b = 0; b < steps; b++) {
                batches.push(newFeatures.slice(b * batchSize, (b + 1) * batchSize));
            }

            for (let s = 1; s <= steps; s++) {
                const progress = Math.round((s / steps) * 100);
                const addedFeatures = [];
                for (let b = 0; b < s; b++) {
                    addedFeatures.push(...batches[b]);
                }
                frames.push({
                    label: `${year} +${progress}%`,
                    geoJson: {
                        type: 'FeatureCollection',
                        features: [...persistedFeatures, ...addedFeatures],
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

            let cityData;
            if (manifest.cities) {
                const params = new URLSearchParams(window.location.search);
                const requestedCity = params.get('city');
                const cityKeys = Object.keys(manifest.cities);
                const cityKey = requestedCity && manifest.cities[requestedCity]
                    ? requestedCity
                    : cityKeys[0];
                cityData = manifest.cities[cityKey];
                console.log(`Animation: loading city "${cityData.area}" (available: ${cityKeys.join(', ')})`);
            } else {
                cityData = manifest;
            }

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

            if (frames.length > 0) {
                const firstFrame = frames[0];
                this.previousFeatureIds = new Set(
                    firstFrame.geoJson.features.map(f => f.properties.id || f.id)
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
            });

            this.startEffectsLoop();
        } catch (error) {
            this.setState({ error: error.message, isLoading: false });
        }
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
            const nextFrame = this.state.currentFrame + 1;
            if (nextFrame >= this.state.frames.length) {
                this.stopPlayback();
                return;
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

        frame.geoJson.features.forEach(f => {
            const fid = f.properties.id || f.id;
            newFeatureIds.add(fid);
            if (!this.previousFeatureIds.has(fid)) {
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
        this.effectsDirty = true;
    }

    startEffectsLoop() {
        this.effectsRafId = requestAnimationFrame(this.effectsTick);
    }

    effectsTick = (now) => {
        const hasActiveEffects = this.featureBirthTimes.size > 0;

        if ((this.effectsDirty || hasActiveEffects) && this.currentBaseFeatures.length > 0) {
            this.effectsDirty = false;

            let features;
            if (hasActiveEffects) {
                const maxDuration = Math.max(SCALE_DURATION_MS, COLOR_DURATION_MS);
                features = this.currentBaseFeatures.map(f => {
                    const fid = f.properties.id || f.id;
                    const birthTime = this.featureBirthTimes.get(fid);
                    if (birthTime !== undefined) {
                        const age = now - birthTime;
                        if (age < maxDuration) {
                            const opacity = Math.min(1, age / COLOR_DURATION_MS);
                            const t = Math.min(1, age / SCALE_DURATION_MS);
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
        const { isLoading, error, loadProgress, frames, currentFrame, isPlaying, speedMultiplier, baseFrameMs, controlsVisible } = this.state;

        if (isLoading) {
            return (
                <div className="animation-overlay">
                    <div className="animation-loading">
                        Loading snapshots... {loadProgress}%
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
                <div className="animation-year-display">
                    {this.getYearDisplay()}
                </div>

                {controlsVisible && (
                    <div className="animation-controls">
                        <button onClick={() => this.jumpToKeyframe(-1)} title="Previous year (Shift+←)">⏮</button>
                        <button onClick={this.stepBackward} title="Previous frame (←)">◀</button>
                        <button onClick={this.togglePlayback} title="Play/Pause (Space)">
                            {isPlaying ? '⏸' : '▶'}
                        </button>
                        <button onClick={this.stepForward} title="Next frame (→)">▶</button>
                        <button onClick={() => this.jumpToKeyframe(1)} title="Next year (Shift+→)">⏭</button>

                        <div className="animation-timeline">
                            <input
                                type="range"
                                min={0}
                                max={frames.length - 1}
                                value={currentFrame}
                                onChange={this.onScrub}
                                className="animation-scrubber"
                                title="Timeline"
                            />
                            <div className="animation-tick-marks">
                                {this.renderTicks()}
                            </div>
                        </div>

                        <span className="animation-frame-info">
                            {this.getYearDisplay()}
                        </span>

                        <label className="animation-speed-label" title="Playback speed">
                            Speed:
                            <input
                                type="range"
                                min={MIN_SPEED}
                                max={MAX_SPEED}
                                step={SPEED_STEP}
                                value={speedMultiplier}
                                onChange={this.onSpeedChange}
                            />
                            <span>{speedMultiplier.toFixed(2)}x ({Math.round(frames.length * baseFrameMs / speedMultiplier / 1000)}s)</span>
                        </label>

                        <span className="animation-feature-count">
                            {this.getCurrentFeatureCount()} features
                        </span>

                        <span className="animation-hint">
                            H to hide
                        </span>
                    </div>
                )}
            </div>
        );
    }
}

export default AnimationMode;
