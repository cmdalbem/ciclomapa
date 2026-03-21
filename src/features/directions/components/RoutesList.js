import React from 'react';
import PropTypes from 'prop-types';

import { formatDistance, formatDuration } from '../../../utils/routeUtils.js';
import { LuBike as IconBike } from 'react-icons/lu';

const nullableNumber = PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]);

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
        return (
          <div
            key={index}
            className={`rounded-lg p-2 md:p-3 -m-2 cursor-pointer transition-colors ${
              selectedRouteIndex === originalIndex ? 'bg-black bg-opacity-70' : ''
            } ${hoveredRouteIndex === originalIndex ? 'bg-black bg-opacity-40 opacity-100' : ''}`}
            onMouseEnter={() => onRouteHover(originalIndex)}
            onMouseLeave={onRouteLeave}
            onClick={() => onRouteClick(originalIndex)}
          >
            <div className="flex justify-between gap-1">
              <div className="flex items-start">
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

                <div className="flex flex-col flex-end">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="cm-panel__leg-label directions--legLabel md:text-sm text-xs">{`Opção ${index + 1}`}</span>
                  </div>

                  {selectedRouteIndex === originalIndex
                    ? route.coverageBreakdown
                    : route.coverageBreakdownSimple || null}
                </div>
              </div>

              <div className="flex flex-col flex-end flex-shrink-0">
                <span className="md:text-sm text-xs text-right mb-1">
                  {formatDuration(route.duration)}
                </span>
                <span className="md:text-sm text-xs text-gray-400 text-right">
                  {formatDistance(route.distance)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
