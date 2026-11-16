import React, { useEffect, useState } from 'react';
import { Segmented, Select, Slider } from 'antd';
import {
  useDirections,
  type MapPmtilesKind,
  type MapPmtilesPocRegion,
} from '../../contexts/DirectionsContext';
import {
  MAP_PMTILES_COMPARE_KINDS,
  MAP_PMTILES_POC_REGION_IDS,
  PMTILES_COMPARE_KIND,
  PMTILES_POC_REGIONS,
} from '../../config/constants';
import { getDirectionsProviderOptions } from '../../utils/routeUtils.js';
import './MapPmtilesCompareControl.css';

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]'))
  );
}

type Props = {
  /** Jump the map to the PoC city's catalog slug when the region changes. */
  onJumpToCitySlug?: (citySlug: string) => void;
};

/**
 * Disposable on-map controls for PMTiles PoC region + maxzoom + lane offset compare.
 * Shortcuts: 1/2/3 = zg/z13/z15+, O = toggle offset.
 */
export default function MapPmtilesCompareControl({ onJumpToCitySlug }: Props) {
  const {
    mapPmtilesKind,
    setMapPmtilesKind,
    mapPmtilesPocRegion,
    setMapPmtilesPocRegion,
    laneSideOffsetEnabled,
    setLaneSideOffsetEnabled,
    routingProvider,
    setRoutingProvider,
    hideRouteOverlay,
    setHideRouteOverlay,
    segmentedRoutePaint,
    setSegmentedRoutePaint,
    brouterAltMaxShare,
    setBrouterAltMaxShare,
  } = useDirections();

  const [shareDraft, setShareDraft] = useState(brouterAltMaxShare);
  useEffect(() => {
    setShareDraft(brouterAltMaxShare);
  }, [brouterAltMaxShare]);

  const region = PMTILES_POC_REGIONS[mapPmtilesPocRegion];
  const files = region?.filenames;
  // Tile zg/z13/z15 compare is only meaningful when those files differ (SP PoC).
  const hasDistinctTileVariants = Boolean(files && files.zg !== files.z13);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (hasDistinctTileVariants && (key === '1' || key === '2' || key === '3')) {
        const kind = MAP_PMTILES_COMPARE_KINDS[Number(key) - 1] as MapPmtilesKind | undefined;
        if (!kind) return;
        event.preventDefault();
        setMapPmtilesKind(kind);
        return;
      }
      if (key === 'o') {
        event.preventDefault();
        setLaneSideOffsetEnabled(!laneSideOffsetEnabled);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasDistinctTileVariants, laneSideOffsetEnabled, setLaneSideOffsetEnabled, setMapPmtilesKind]);

  const handleRegionChange = (value: string | number) => {
    const regionId = String(value) as MapPmtilesPocRegion;
    if (!MAP_PMTILES_POC_REGION_IDS.includes(regionId) || regionId === mapPmtilesPocRegion) {
      return;
    }
    setMapPmtilesPocRegion(regionId);
    const citySlug = PMTILES_POC_REGIONS[regionId]?.citySlug;
    if (citySlug && onJumpToCitySlug) {
      onJumpToCitySlug(citySlug);
    }
  };

  return (
    <div className="cm-map-pmtiles-compare glass-bg">
      <div
        className="cm-map-pmtiles-compare__row"
        role="group"
        aria-label="PoC de tiles: desligado, São Paulo, Brasil ou Espanha"
      >
        <span className="cm-map-pmtiles-compare__label">PoC</span>
        <Segmented
          size="small"
          value={mapPmtilesPocRegion}
          onChange={handleRegionChange}
          options={MAP_PMTILES_POC_REGION_IDS.map((id) => ({
            value: id,
            label: PMTILES_POC_REGIONS[id].label,
          }))}
          className="cm-map-pmtiles-compare__segmented"
        />
      </div>
      {hasDistinctTileVariants ? (
        <div
          className="cm-map-pmtiles-compare__row"
          role="group"
          aria-label="Versão dos tiles no mapa. Atalhos 1, 2 e 3."
        >
          <span className="cm-map-pmtiles-compare__label">Tiles</span>
          <Segmented
            size="small"
            value={mapPmtilesKind}
            onChange={(value) => setMapPmtilesKind(value as MapPmtilesKind)}
            options={[
              {
                value: PMTILES_COMPARE_KIND.zg,
                label: (
                  <span className="cm-map-pmtiles-compare__opt">
                    zg <kbd className="cm-map-pmtiles-compare__kbd">1</kbd>
                  </span>
                ),
              },
              {
                value: PMTILES_COMPARE_KIND.z13,
                label: (
                  <span className="cm-map-pmtiles-compare__opt">
                    z13 <kbd className="cm-map-pmtiles-compare__kbd">2</kbd>
                  </span>
                ),
              },
              {
                value: PMTILES_COMPARE_KIND.analysis,
                label: (
                  <span className="cm-map-pmtiles-compare__opt">
                    z15+ <kbd className="cm-map-pmtiles-compare__kbd">3</kbd>
                  </span>
                ),
              },
            ]}
            className="cm-map-pmtiles-compare__segmented"
          />
        </div>
      ) : null}
      <div
        className="cm-map-pmtiles-compare__row"
        role="group"
        aria-label="Deslocamento lateral das faixas. Atalho O."
      >
        <span className="cm-map-pmtiles-compare__label">Offset</span>
        <Segmented
          size="small"
          value={laneSideOffsetEnabled ? 'on' : 'off'}
          onChange={(value) => setLaneSideOffsetEnabled(value === 'on')}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
          ]}
          className="cm-map-pmtiles-compare__segmented"
        />
        <kbd className="cm-map-pmtiles-compare__kbd" aria-hidden="true">
          O
        </kbd>
      </div>
      <div className="cm-map-pmtiles-compare__row" role="group" aria-label="Motor de rotas">
        <span className="cm-map-pmtiles-compare__label">Rota</span>
        <Select
          size="small"
          value={routingProvider}
          onChange={(value) => setRoutingProvider(String(value))}
          options={getDirectionsProviderOptions()}
          popupMatchSelectWidth={false}
          className="cm-map-pmtiles-compare__select"
        />
      </div>
      <div
        className="cm-map-pmtiles-compare__row"
        role="group"
        aria-label="Máxima fração de células em comum entre alternativas do BRouter. 1 mantém todas."
      >
        <span className="cm-map-pmtiles-compare__label">Share</span>
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={shareDraft}
          onChange={(value) => {
            if (typeof value === 'number' && Number.isFinite(value)) setShareDraft(value);
          }}
          onChangeComplete={(value) => {
            if (typeof value !== 'number' || !Number.isFinite(value)) return;
            const next = Math.min(1, Math.max(0, value));
            setShareDraft(next);
            if (next !== brouterAltMaxShare) setBrouterAltMaxShare(next);
          }}
          tooltip={{ formatter: (value) => Number(value).toFixed(2) }}
          className="cm-map-pmtiles-compare__slider"
        />
        <span className="cm-map-pmtiles-compare__share-val">{shareDraft.toFixed(2)}</span>
      </div>
      <div
        className="cm-map-pmtiles-compare__row"
        role="group"
        aria-label="Ocultar rota calculada no mapa"
      >
        <span className="cm-map-pmtiles-compare__label">Ocultar</span>
        <Segmented
          size="small"
          value={hideRouteOverlay ? 'on' : 'off'}
          onChange={(value) => setHideRouteOverlay(value === 'on')}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
          ]}
          className="cm-map-pmtiles-compare__segmented"
        />
      </div>
      <div
        className="cm-map-pmtiles-compare__row"
        role="group"
        aria-label="Desenhar rota em segmentos coloridos em vez de laranja + sobreposição"
      >
        <span className="cm-map-pmtiles-compare__label">Segs</span>
        <Segmented
          size="small"
          value={segmentedRoutePaint ? 'on' : 'off'}
          onChange={(value) => setSegmentedRoutePaint(value === 'on')}
          options={[
            { value: 'off', label: 'Off' },
            { value: 'on', label: 'On' },
          ]}
          className="cm-map-pmtiles-compare__segmented"
        />
      </div>
    </div>
  );
}
