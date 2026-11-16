import React, { useId, useState } from 'react';
import PropTypes from 'prop-types';

import { ROUTE_ASCEND_WARNING_M } from '../../../config/constants.js';
import { useDirections } from '../../../contexts/DirectionsContext';
import { formatDistance, formatDuration } from '../../../utils/routeUtils.js';
import { LuBike as IconBike } from 'react-icons/lu';

const nullableNumber = PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]);

function ElevationSparkline({ samples, coordinates, onHoverLngLat, width = 320, height = 48 }) {
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
  const padX = 0;
  const padTop = 10;
  const padBottom = 5;
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

  const clearHover = () => {
    setHover(null);
    onHoverLngLat?.(null);
  };

  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    const t = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const idx = Math.round(t * (samples.length - 1));
    const elev = samples[idx];
    if (elev == null || Number.isNaN(elev)) return;
    const yRatio = padTop / height + (1 - (elev - min) / span) * (innerH / height);
    setHover({ t, elev, yRatio });

    if (coordinates?.length >= 2 && onHoverLngLat) {
      const cIdx = Math.round(t * (coordinates.length - 1));
      const c = coordinates[cIdx];
      if (c && Number.isFinite(c[0]) && Number.isFinite(c[1])) {
        onHoverLngLat([c[0], c[1]]);
      }
    }
  };

  return (
    <div
      className="cm-route-elev__hit"
      onMouseMove={handleMove}
      onMouseLeave={clearHover}
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
          <div
            className="cm-route-elev__tip"
            style={{
              left: `${hover.t * 100}%`,
              transform:
                hover.t < 0.08
                  ? 'translate(0, -110%)'
                  : hover.t > 0.92
                    ? 'translate(-100%, -110%)'
                    : 'translate(-50%, -110%)',
            }}
          >
            {Math.round(hover.elev)} m
          </div>
        </>
      ) : null}
    </div>
  );
}

ElevationSparkline.propTypes = {
  samples: PropTypes.arrayOf(PropTypes.number),
  coordinates: PropTypes.arrayOf(PropTypes.arrayOf(PropTypes.number)),
  onHoverLngLat: PropTypes.func,
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
  const { setElevationHoverLngLat } = useDirections();

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
            className={`cm-route-option rounded-lg p-2 md:p-3 -m-2 cursor-pointer${
              isSelected ? ' cm-route-option--selected' : ''
            }${hoveredRouteIndex === originalIndex ? ' cm-route-option--hover' : ''}`}
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
                  {(() => {
                    let climb = route.ascend;
                    if (
                      (climb == null || !Number.isFinite(climb)) &&
                      route.elevationProfile?.length >= 2
                    ) {
                      climb = 0;
                      for (let i = 1; i < route.elevationProfile.length; i++) {
                        const step = route.elevationProfile[i] - route.elevationProfile[i - 1];
                        if (step > 0) climb += step;
                      }
                    }
                    if (climb == null || !Number.isFinite(climb)) return null;
                    const meters = Math.round(Math.abs(climb));
                    const warnClimb = meters >= ROUTE_ASCEND_WARNING_M;
                    return (
                      <>
                        <span className={warnClimb ? 'cm-route-ascend--warn' : undefined}>
                          ↑ {meters} m
                        </span>
                        {' · '}
                      </>
                    );
                  })()}
                  {formatDistance(route.distance)}
                </span>
              </div>
            </div>
            {showElevation ? (
              <div className="cm-route-elev">
                <ElevationSparkline
                  samples={route.elevationProfile}
                  coordinates={route.geometry?.coordinates}
                  onHoverLngLat={setElevationHoverLngLat}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
