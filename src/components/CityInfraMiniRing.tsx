import React from 'react';
import { CITY_SWITCHER_MINI_CHART_LAYER_IDS } from '../config/constants.js';

const RING_WRAP_CLASS =
  'shrink-0 w-6 h-6 leading-none flex items-center justify-center';

export type CityInfraLayer = {
  id: string;
  style?: {
    lineStyle?: string;
    lineColor?: string;
  };
};

export function miniChartSliceTotalKm(
  lengthsKmByLayer: Record<string, number> | null | undefined
): number {
  if (!lengthsKmByLayer) return 0;
  return CITY_SWITCHER_MINI_CHART_LAYER_IDS.reduce((sum, id) => {
    const v = Number(lengthsKmByLayer[id]);
    return Number.isFinite(v) && v > 0 ? sum + v : sum;
  }, 0);
}

/** Degrees clockwise from top (12 o’clock); 0° = top center. */
function polarOnRing(
  cx: number,
  cy: number,
  r: number,
  degCwFromTop: number
): { x: number; y: number } {
  const rad = ((degCwFromTop - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/**
 * Circular arc along one radius (stroke only). `sweepFlag` 1 = clockwise on screen (SVG y-down).
 */
function ringArcD(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const start = polarOnRing(cx, cy, r, startDeg);
  const end = polarOnRing(cx, cy, r, endDeg);
  const delta = endDeg - startDeg;
  const largeArc = delta > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

const CITY_INFRA_RING_SIZE = 18;
const CITY_INFRA_RING_CX = CITY_INFRA_RING_SIZE / 2;
const CITY_INFRA_RING_CY = CITY_INFRA_RING_SIZE / 2;
const CITY_INFRA_RING_R = CITY_INFRA_RING_SIZE / 2;
const CITY_INFRA_RING_STROKE = 2;
/** Angular gap left empty between coloured segments. */
const CITY_INFRA_RING_GAP_DEG = 32;
/** When only one layer has length, opening (no background ring — just empty space). */
const CITY_INFRA_RING_SINGLE_OPENING_DEG = 32;
/** Trim each arc at both ends (deg) so round stroke caps don’t spill into the gap between segments. */
const CITY_INFRA_RING_CAP_TRIM_DEG = 2;

type RingClassProps = {
  className?: string;
  testId?: string;
};

/**
 * Thin circular chart: ciclovia / ciclofaixa only, rounded stroke arcs, wide gaps, no track/background.
 */
export function CityInfraMiniRing({
  lengthsKmByLayer,
  infraLayers,
  className,
  testId,
}: {
  lengthsKmByLayer: Record<string, number>;
  infraLayers: CityInfraLayer[];
} & RingClassProps) {
  const byId = Object.fromEntries(infraLayers.map((l) => [l.id, l]));
  const segments = CITY_SWITCHER_MINI_CHART_LAYER_IDS.map((id) => {
    const raw = Number(lengthsKmByLayer[id]);
    const km = Number.isFinite(raw) && raw > 0 ? raw : 0;
    const layer = byId[id];
    const color = layer?.style?.lineColor || (id === 'ciclovia' ? '#386641' : '#A7C957');
    return { id, km, color };
  }).filter((s) => s.km > 0);

  const totalKm = segments.reduce((sum, s) => sum + s.km, 0);
  if (totalKm <= 0) return null;

  const n = segments.length;
  const gapTotalDeg = n === 1 ? CITY_INFRA_RING_SINGLE_OPENING_DEG : n * CITY_INFRA_RING_GAP_DEG;
  const availDeg = 360 - gapTotalDeg;
  const trimBase = n > 1 ? CITY_INFRA_RING_CAP_TRIM_DEG : CITY_INFRA_RING_CAP_TRIM_DEG * 0.75;

  let cursor = 0;
  const arcs: { id: string; d: string; color: string }[] = [];
  for (let i = 0; i < n; i++) {
    const seg = segments[i];
    const span = (seg.km / totalKm) * availDeg;
    const trim = Math.min(trimBase, Math.max(0, span / 2 - 0.75));
    const arcStart = cursor + trim;
    const arcEnd = cursor + span - trim;
    if (arcEnd > arcStart) {
      arcs.push({
        id: seg.id,
        d: ringArcD(CITY_INFRA_RING_CX, CITY_INFRA_RING_CY, CITY_INFRA_RING_R, arcStart, arcEnd),
        color: seg.color,
      });
    }
    const gapAfter = n === 1 ? CITY_INFRA_RING_SINGLE_OPENING_DEG : CITY_INFRA_RING_GAP_DEG;
    cursor += span + gapAfter;
  }

  return (
    <div
      className={[RING_WRAP_CLASS, className].filter(Boolean).join(' ')}
      data-testid={testId || 'city-infra-mini-ring'}
      aria-hidden
    >
      <svg
        width={CITY_INFRA_RING_SIZE}
        height={CITY_INFRA_RING_SIZE}
        viewBox={`0 0 ${CITY_INFRA_RING_SIZE} ${CITY_INFRA_RING_SIZE}`}
        className="block overflow-visible"
      >
        {/* Horizontal mirror so segments grow counter‑clockwise from the chart’s start (toward the left). */}
        <g
          transform={`translate(${CITY_INFRA_RING_CX} ${CITY_INFRA_RING_CY}) scale(-1, 1) translate(${-CITY_INFRA_RING_CX} ${-CITY_INFRA_RING_CY})`}
        >
          {arcs.map((a) => (
            <path
              key={a.id}
              d={a.d}
              fill="none"
              stroke={a.color}
              strokeWidth={CITY_INFRA_RING_STROKE}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

/** Same ring geometry as `CityInfraMiniRing` (radius, stroke width, caps); neutral stroke only = “empty” chart. */
export function CityInfraMiniRingPlaceholder({ className, testId }: RingClassProps) {
  const s = CITY_INFRA_RING_SIZE;
  const c = CITY_INFRA_RING_CX;
  const r = CITY_INFRA_RING_R;
  return (
    <div
      className={[RING_WRAP_CLASS, className].filter(Boolean).join(' ')}
      data-testid={testId || 'city-infra-ring-placeholder'}
      aria-hidden
    >
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} className="block overflow-visible">
        <circle
          cx={c}
          cy={c}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.2}
          strokeWidth={CITY_INFRA_RING_STROKE}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
