import React, { useId, useState } from 'react';
import PropTypes from 'prop-types';

import { ROUTE_ASCEND_WARNING_M } from '../../../config/constants.js';
import { formatDistance, formatDuration } from '../../../utils/routeUtils.js';
import { LuBike as IconBike } from 'react-icons/lu';

const nullableNumber = PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]);

function ElevationSparkline({ samples, scoreWidth, width = 320, height = 48 }) {
  const gradId = useId().replace(/:/g, '');
  const [hover, setHover] = useState(null);
  if (!samples || samples.length < 2) return null;

  // Cap point density so the line stays readable when stretched full-width.
  const maxPoints = 64;
  const step = samples.length > maxPoints ? samples.length / maxPoints : 1;
  const plotted = [];
  for (let i = 0; i < samples.length; i += step) {
    plotted.push(samples[Math.floor(i)]);
  }
  if (plotted[plotted.length - 1] !== samples[samples.length - 1]) {
    plotted.push(samples[samples.length - 1]);
  }

  const min = Math.min(...plotted);
  const max = Math.max(...plotted);
  const span = max - min || 1;
  const padX = 2;
  const padTop = 8;
  const padBottom = 3;
  const innerH = height - padTop - padBottom;
  const coords = plotted.map((ele, i) => {
    const x = padX + (i / (plotted.length - 1)) * (width - padX * 2);
    const y = padTop + innerH - ((ele - min) / span) * innerH;
    return [x, y];
  });
  const line = `M ${coords.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(' L ')}`;
  const last = coords[coords.length - 1];
  const first = coords[0];
  const area = `${line} L ${last[0].toFixed(1)} ${height} L ${first[0].toFixed(1)} ${height} Z`;

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const t = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const idx = Math.round(t * (samples.length - 1));
    const elev = samples[idx];
    if (elev == null || Number.isNaN(elev)) return;
    const yRatio = padTop / height + (1 - (elev - min) / span) * (innerH / height);
    setHover({ t, elev, yRatio });
  };

  const minLabel = Math.round(min);
  const maxLabel = Math.round(max);

  return (
    <div className="cm-route-elev__frame">
      <div className="cm-route-elev__yaxis" aria-hidden="true">
        <span className="cm-route-elev__yaxis-val">{maxLabel} m</span>
        <span className="cm-route-elev__yaxis-sizer">{scoreWidth ?? '00'}</span>
        {maxLabel !== minLabel ? (
          <span className="cm-route-elev__yaxis-val">{minLabel} m</span>
        ) : (
          <span className="cm-route-elev__yaxis-val" />
        )}
      </div>
      <div
        className="cm-route-elev__hit"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => e.stopPropagation()}
      >
        <svg
          className="cm-route-elev__chart"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`cm-elev-fill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" className="cm-route-elev__grad-top" />
              <stop offset="100%" className="cm-route-elev__grad-bottom" />
            </linearGradient>
          </defs>
          <path className="cm-route-elev__fill" d={area} fill={`url(#cm-elev-fill-${gradId})`} />
          <path className="cm-route-elev__line" d={line} />
        </svg>
        {hover ? (
          <>
            <div className="cm-route-elev__scrub" style={{ left: `${hover.t * 100}%` }} />
            <div
              className="cm-route-elev__dot"
              style={{ left: `${hover.t * 100}%`, top: `${hover.yRatio * 100}%` }}
            />
            <div className="cm-route-elev__tip" style={{ left: `${hover.t * 100}%` }}>
              {Math.round(hover.elev)} m
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

ElevationSparkline.propTypes = {
  samples: PropTypes.arrayOf(PropTypes.number),
  scoreWidth: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  width: PropTypes.number,
  height: PropTypes.number,
};

RoutesList.propTypes = {
  routes: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedRouteIndex: nullableNumber.isRequired,
  hoveredRouteIndex: nullableNumber.isRequired,
  onRouteHover: PropTypes.func.isRequired,
  onRouteLeave: PropTypes.func.isRequired,
  onRouteClick: PropTypes.func.isRequired,
};

export default function RoutesList({
  routes,
  selectedRouteIndex,
  hoveredRouteIndex,
  onRouteHover,
  onRouteLeave,
  onRouteClick,
}) {
  return (
    <div className="space-y-2">
      {routes.map((route, index) => {
        const originalIndex = route._originalIndex !== undefined ? route._originalIndex : index;
        const isSelected = selectedRouteIndex === originalIndex;
        const isLocal = /local|brouter/i.test(route.provider || '');
        const showElevation = isSelected && route.elevationProfile?.length >= 2;
        return (
          <div
            key={index}
            className={`rounded-lg p-2 md:p-3 -m-2 cursor-pointer transition-colors ${
              isSelected ? 'bg-black bg-opacity-70' : ''
            } ${hoveredRouteIndex === originalIndex ? 'bg-black bg-opacity-40 opacity-100' : ''}`}
            onMouseEnter={() => onRouteHover(originalIndex)}
            onMouseLeave={onRouteLeave}
            onClick={() => onRouteClick(originalIndex)}
          >
            <div className="flex justify-between gap-1">
              <div className="flex items-start min-w-0">
                {route.score !== null && route.score !== undefined ? (
                  <div
                    className={`flex items-center mr-2 ${route.scoreClass || 'bg-gray-600'} px-1.5 py-1.5 rounded-md md:text-sm text-xs leading-none font-mono text-center`}
                    style={{ color: 'white' }}
                  >
                    {route.score}
                  </div>
                ) : (
                  <IconBike className="w-4 h-4 mr-2" title="Dados de cobertura não disponíveis" />
                )}

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="cm-panel__leg-label directions--legLabel md:text-sm text-xs">
                      {`Opção ${index + 1}`}
                    </span>
                    {route.provider ? (
                      <span
                        className={
                          isLocal
                            ? 'cm-route-tag cm-route-tag--primary'
                            : 'cm-route-tag cm-route-tag--outline'
                        }
                      >
                        {isLocal ? `local · ${route.provider}` : route.provider}
                      </span>
                    ) : null}
                  </div>
                  {isSelected ? route.coverageBreakdown : route.coverageBreakdownSimple || null}
                </div>
              </div>

              <div className="flex flex-col flex-shrink-0 items-end">
                <span className="md:text-sm text-xs text-right mb-1">
                  {formatDuration(route.duration)}
                </span>
                <span className="md:text-sm text-xs text-gray-400 text-right">
                  {route.ascend != null ? (
                    <>
                      <span
                        className={
                          route.ascend >= ROUTE_ASCEND_WARNING_M
                            ? 'cm-route-ascend--warn'
                            : undefined
                        }
                      >
                        ↑ {Math.round(route.ascend)} m
                      </span>
                      {' · '}
                    </>
                  ) : null}
                  {formatDistance(route.distance)}
                </span>
              </div>
            </div>
            {showElevation ? (
              <div className="cm-route-elev mt-1.5">
                <ElevationSparkline
                  samples={route.elevationProfile}
                  scoreWidth={route.score != null ? route.score : '00'}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
