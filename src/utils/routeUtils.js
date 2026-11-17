// Shared utilities for route calculations and formatting

import React from 'react';
import {
  MIN_ROUTE_COVERAGE_PERCENT_TO_DISPLAY,
  ROUTE_INFRASTRUCTURE_QUALITY_WEIGHTS,
} from '../config/constants.js';
import InfrastructureBadge from '../components/InfrastructureBadge';

/** Unicode thin space (U+2009) between a numeric value and the km unit (typographic convention). */
export const THIN_SPACE = '\u2009';

/**
 * @param {string} formattedNumber - Number string without unit (e.g. from toFixed), any decimal separator.
 * @returns {string} e.g. "12,4\u2009km"
 */
export function appendKmUnit(formattedNumber) {
  return `${formattedNumber}${THIN_SPACE}km`;
}

export const getRouteScore = (routeCoverageData, index) => {
  // Handle both old array format and new unified format
  let route;
  if (Array.isArray(routeCoverageData)) {
    // Old format: array with index
    if (
      !routeCoverageData ||
      !routeCoverageData[index] ||
      !routeCoverageData[index].coverageByType
    ) {
      return { score: null, cssClass: null };
    }
    route = routeCoverageData[index];
  } else {
    // New format: direct route object
    if (!routeCoverageData || !routeCoverageData.coverageByType) {
      return { score: null, cssClass: null };
    }
    route = routeCoverageData;
  }

  const coverageByType = route.coverageByType;

  // Calculate weighted score
  let weightedScore = 0;
  let totalCoverage = 0;

  Object.keys(coverageByType).forEach((type) => {
    const percentage = coverageByType[type];
    const weight = ROUTE_INFRASTRUCTURE_QUALITY_WEIGHTS[type] || 0;
    weightedScore += percentage * weight;
    totalCoverage += percentage;
  });

  if (totalCoverage === 0) {
    return { score: 0, cssClass: 'bg-red-600' };
  }

  // Calculate final score considering BOTH quality and coverage
  // The score should be: (weighted average quality) * (actual route coverage percentage)
  const weightedAverage = weightedScore / totalCoverage; // Quality score (0-1)
  const routeCoveragePercentage = route.coverage || 0; // Actual coverage % (0-100)
  const finalScore = Math.round(weightedAverage * routeCoveragePercentage);

  // Determine CSS class based on score
  let cssClass;
  if (finalScore < 50) {
    cssClass = 'bg-red-600';
  } else if (finalScore < 75) {
    cssClass = 'bg-yellow-600';
  } else {
    cssClass = 'bg-green-600';
  }
  return { score: finalScore, cssClass: cssClass };
};

export const getCoverageBreakdown = (routeCoverageData, index, isDarkMode) => {
  // Handle both old array format and new unified format
  let route;
  if (Array.isArray(routeCoverageData)) {
    // Old format: array with index
    if (
      !routeCoverageData ||
      !routeCoverageData[index] ||
      !routeCoverageData[index].coverageByType
    ) {
      return [];
    }
    route = routeCoverageData[index];
  } else {
    // New format: direct route object
    if (!routeCoverageData || !routeCoverageData.coverageByType) {
      return [];
    }
    route = routeCoverageData;
  }

  const coverageByType = route.coverageByType;
  const breakdown = [];

  const typeNames = {
    Ciclovia: 'ciclovia',
    Ciclofaixa: 'ciclofaixa',
    Ciclorrota: 'ciclorrota',
    'Calçada compartilhada': 'calçada',
  };

  let totalPercentage = 100;

  Object.keys(coverageByType).forEach((type) => {
    const percentage = coverageByType[type];
    if (percentage > MIN_ROUTE_COVERAGE_PERCENT_TO_DISPLAY) {
      const shortName = typeNames[type] || type.toLowerCase();
      breakdown.push(`${percentage.toFixed(0)}% ${shortName}`);
      totalPercentage -= percentage;
    }
  });

  if (totalPercentage > 0) {
    breakdown.push(`${totalPercentage.toFixed(0)}% rua`);
  }

  const getInfrastructureType = (item) => {
    if (item.includes('ciclovia')) return 'ciclovia';
    if (item.includes('calçada')) return 'calçada';
    if (item.includes('ciclofaixa')) return 'ciclofaixa';
    if (item.includes('ciclorrota')) return 'ciclorrota';
    if (item.includes('rua')) return 'rua';
    return null;
  };

  return (
    <div className="flex flex-wrap gap-1 ">
      {' '}
      {breakdown.map((item, index) => (
        <InfrastructureBadge
          key={index}
          infrastructure={getInfrastructureType(item)}
          isDarkMode={isDarkMode}
        >
          {item}
        </InfrastructureBadge>
      ))}
    </div>
  );
};

export const getCoverageBreakdownSimple = (routeCoverageData, index) => {
  // Handle both old array format and new unified format
  let route;
  if (Array.isArray(routeCoverageData)) {
    // Old format: array with index
    if (
      !routeCoverageData ||
      !routeCoverageData[index] ||
      !routeCoverageData[index].coverageByType
    ) {
      return null;
    }
    route = routeCoverageData[index];
  } else {
    // New format: direct route object
    if (!routeCoverageData || !routeCoverageData.coverageByType) {
      return null;
    }
    route = routeCoverageData;
  }

  const coverageByType = route.coverageByType;
  const breakdown = [];

  // Map infrastructure type names to shorter display names
  const typeNames = {
    Ciclovia: 'ciclovia',
    Ciclofaixa: 'ciclofaixa',
    Ciclorrota: 'ciclorrota',
    'Calçada compartilhada': 'calçada',
  };

  Object.keys(coverageByType).forEach((type) => {
    const percentage = coverageByType[type];
    if (percentage > MIN_ROUTE_COVERAGE_PERCENT_TO_DISPLAY) {
      const shortName = typeNames[type] || type.toLowerCase();
      breakdown.push(`${percentage.toFixed(0)}% ${shortName}`);
    }
  });

  return <span className="text-xs text-gray-400">{breakdown.join('∙')}</span>;
};

export const formatDistance = (distance) => {
  if (!distance) return 'N/A';
  return appendKmUnit((distance / 1000).toFixed(1));
};

export const formatDuration = (duration) => {
  if (!duration) return 'N/A';
  const totalMin = Math.round(duration / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return mins === 0 ? `${hours}h` : `${hours}h ${mins}min`;
};

/** Matches ciclomapa.brf assigns. */
export const BROUTER_PROFILE_DEFAULTS = {
  consider_elevation: true,
  unpavedPenalty: 1,
  consider_noise: false,
  consider_river: false,
  consider_forest: false,
};

/** Surface chip: BRouter `unpavedPenalty` multiplier (<1 favors dirt, >1 favors asphalt). */
export const BROUTER_SURFACE_OPTIONS = [
  { value: 4, label: 'Só asfalto', shortLabel: 'Só asfalto' },
  { value: 2, label: 'Prefiro asfalto', shortLabel: 'Pref. asfalto' },
  { value: 1, label: 'Qualquer terreno', shortLabel: 'Qualquer terreno' },
  { value: 0.5, label: 'Prefiro terra', shortLabel: 'Pref. terra' },
  { value: 0.25, label: 'Só terra', shortLabel: 'Só terra' },
];

/** Objective dropdown: maps UI sort keys → ciclomapa.brf `routingObjective`. */
export const BROUTER_OBJECTIVE_OPTIONS = [
  { key: 'score', label: 'Mais protegida', routingObjective: 0 },
  { key: 'fastest', label: 'Mais rápida', routingObjective: 1 },
  { key: 'shortest', label: 'Mais curta', routingObjective: 2 },
];

export function brouterRoutingObjectiveFromSort(sortKey) {
  const opt = BROUTER_OBJECTIVE_OPTIONS.find((o) => o.key === sortKey);
  return opt ? opt.routingObjective : 0;
}
