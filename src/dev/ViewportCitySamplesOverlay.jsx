import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import { getViewportSamplePoints, reverseGeocodePlace } from '../features/map/mapboxGeocoding.js';

const LABELS = ['C', 'NW', 'NE', 'SW', 'SE'];
// Inline on purpose: global CSS remaps Tailwind grays/white inside the map container.
const LABEL_STYLE = { backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff' };
const DIM_STYLE = { color: 'rgba(255,255,255,0.6)' };

/**
 * Debug-only. Draws the sample points `guessPlaceFromViewport` uses, each with the
 * city Mapbox returns for it, and the resulting vote. Fires 5 reverse geocodes per
 * moveend, which is why it only exists behind a debug toggle.
 */
export default function ViewportCitySamplesOverlay({ map }) {
  const [samples, setSamples] = useState([]); // { lngLat, label, place, error }
  const [, forceRender] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!map) return undefined;

    const geocode = async () => {
      const requestId = ++requestIdRef.current;
      const center = map.getCenter();
      const points = getViewportSamplePoints({ lng: center.lng, lat: center.lat }, map.getBounds());
      setSamples(points.map((lngLat, i) => ({ lngLat, label: LABELS[i], place: null })));

      const results = await Promise.allSettled(points.map((p) => reverseGeocodePlace(p)));
      if (requestId !== requestIdRef.current) return;
      setSamples(
        points.map((lngLat, i) => ({
          lngLat,
          label: LABELS[i],
          place: results[i].status === 'fulfilled' ? results[i].value.place_name : null,
          error:
            results[i].status === 'rejected' ? String(results[i].reason?.message || '?') : null,
        }))
      );
    };
    const reposition = () => forceRender((n) => n + 1);

    geocode();
    map.on('moveend', geocode);
    map.on('move', reposition);
    return () => {
      requestIdRef.current += 1;
      map.off('moveend', geocode);
      map.off('move', reposition);
    };
  }, [map]);

  if (!map || samples.length === 0) return null;

  const votes = new Map();
  samples.forEach((s) => s.place && votes.set(s.place, (votes.get(s.place) || 0) + 1));
  const winner = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];

  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[50] font-['Inter',system-ui,sans-serif] text-[10px]">
      {samples.map((s) => {
        const { x, y } = map.project([s.lngLat.lng, s.lngLat.lat]);
        const isWinner = winner && s.place === winner[0];
        return (
          <div
            key={s.label}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: x, top: y }}
          >
            <div
              className={`h-3 w-3 rounded-full border-2 ${isWinner ? 'border-emerald-400' : 'border-red-400'} bg-white/60 shadow`}
            />
            <div
              className="mt-1 whitespace-nowrap rounded px-1.5 py-0.5 shadow"
              style={LABEL_STYLE}
            >
              <span className="font-bold" style={DIM_STYLE}>
                {s.label}{' '}
              </span>
              {s.place ? s.place.split(',')[0] : s.error ? `⚠ ${s.error}` : '…'}
            </div>
          </div>
        );
      })}
      {winner && (
        <div
          className="absolute left-1/2 top-16 -translate-x-1/2 whitespace-nowrap rounded px-2 py-1 shadow"
          style={LABEL_STYLE}
        >
          <span style={DIM_STYLE}>viewport city: </span>
          <span className="font-bold text-emerald-400">{winner[0]}</span>
          <span style={DIM_STYLE}>
            {' '}
            ({winner[1]}/{samples.length})
          </span>
        </div>
      )}
    </div>,
    map.getContainer()
  );
}

ViewportCitySamplesOverlay.propTypes = {
  map: PropTypes.object,
};
