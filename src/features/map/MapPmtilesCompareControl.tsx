import React, { useEffect } from 'react';
import { Segmented } from 'antd';
import { useDirections, type MapPmtilesKind } from '../../contexts/DirectionsContext';
import { MAP_PMTILES_COMPARE_KINDS, PMTILES_COMPARE_KIND } from '../../config/constants';
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

/**
 * Disposable on-map controls for São Paulo PMTiles maxzoom + lane offset compare.
 * Shortcuts: 1/2/3 = zg/z13/z15+, O = toggle offset.
 */
export default function MapPmtilesCompareControl() {
  const { mapPmtilesKind, setMapPmtilesKind, laneSideOffsetEnabled, setLaneSideOffsetEnabled } =
    useDirections();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === '1' || key === '2' || key === '3') {
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
  }, [laneSideOffsetEnabled, setLaneSideOffsetEnabled, setMapPmtilesKind]);

  return (
    <div className="cm-map-pmtiles-compare glass-bg">
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
            { value: PMTILES_COMPARE_KIND.zg, label: 'zg 1' },
            { value: PMTILES_COMPARE_KIND.z13, label: 'z13 2' },
            { value: PMTILES_COMPARE_KIND.analysis, label: 'z15+ 3' },
          ]}
          className="cm-map-pmtiles-compare__segmented"
        />
      </div>
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
        <span className="cm-map-pmtiles-compare__hint" aria-hidden="true">
          O
        </span>
      </div>
    </div>
  );
}
