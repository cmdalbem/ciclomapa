// Shared utilities for route calculations and formatting

import React from 'react';
import {
  HYBRID_MAX_RESULTS,
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
  return `${Math.round(duration / 60)} min`;
};

/** Query keys for directions prefs (App.updateURL leaves unknown keys alone). */
export const DIRECTIONS_URL_KEYS = {
  provider: 'provider',
  sort: 'sort',
  maxRoutes: 'maxroutes',
  coverage: 'cobertura',
  elevation: 'elev',
  unpaved: 'unpaved',
  noise: 'noise',
  river: 'river',
  forest: 'forest',
};

/** Matches ciclomapa.brf assigns. Only BRouter (and hybrid's BR rows) honor these. */
export const BROUTER_PROFILE_DEFAULTS = {
  consider_elevation: true,
  unpavedPenalty: 1,
  consider_noise: false,
  consider_river: false,
  consider_forest: false,
};

function parseUrlFlag(raw) {
  if (raw == null) return null;
  if (raw === '1' || raw === 'true') return true;
  if (raw === '0' || raw === 'false') return false;
  return null;
}

const DIRECTIONS_PROVIDER_IDS = new Set(['hybrid', 'valhalla', 'graphhopper', 'brouter', 'mapbox']);
const DIRECTIONS_SORT_IDS = new Set(['score', 'fastest', 'shortest']);
const DIRECTIONS_COVERAGE_IDS = new Set([
  'cityOriginal',
  'city',
  'pmtiles',
  'analysis',
  'ghDetails',
  'brTags',
]);

/**
 * Read directions UI prefs from the URL. Missing/invalid → null (caller keeps its default).
 * @returns {{ provider: string|null, sort: string|null, maxRoutes: number|null, coverage: string|null, consider_elevation: boolean|null, unpavedPenalty: number|null, consider_noise: boolean|null, consider_river: boolean|null, consider_forest: boolean|null }}
 */
export function readDirectionsUrlParams(
  search = typeof window !== 'undefined' ? window.location.search : ''
) {
  const params = new URLSearchParams(search);
  const providerRaw = params.get(DIRECTIONS_URL_KEYS.provider);
  const sortRaw = params.get(DIRECTIONS_URL_KEYS.sort);
  const maxRaw = params.get(DIRECTIONS_URL_KEYS.maxRoutes);
  const coverageRaw = params.get(DIRECTIONS_URL_KEYS.coverage);
  const unpavedRaw = params.get(DIRECTIONS_URL_KEYS.unpaved);

  const maxParsed = maxRaw != null ? Number(maxRaw) : NaN;
  const unpavedParsed = unpavedRaw != null ? Number(unpavedRaw) : NaN;

  return {
    provider: DIRECTIONS_PROVIDER_IDS.has(providerRaw) ? providerRaw : null,
    sort: DIRECTIONS_SORT_IDS.has(sortRaw) ? sortRaw : null,
    maxRoutes: Number.isFinite(maxParsed) && maxParsed >= 0 ? maxParsed : null,
    coverage: DIRECTIONS_COVERAGE_IDS.has(coverageRaw) ? coverageRaw : null,
    consider_elevation: parseUrlFlag(params.get(DIRECTIONS_URL_KEYS.elevation)),
    unpavedPenalty: Number.isFinite(unpavedParsed) && unpavedParsed >= 0 ? unpavedParsed : null,
    consider_noise: parseUrlFlag(params.get(DIRECTIONS_URL_KEYS.noise)),
    consider_river: parseUrlFlag(params.get(DIRECTIONS_URL_KEYS.river)),
    consider_forest: parseUrlFlag(params.get(DIRECTIONS_URL_KEYS.forest)),
  };
}

/**
 * Patch directions prefs into the current URL (replaceState). Pass null/undefined to delete a key.
 * Omits values that match `defaults` so the URL stays short.
 */
export function writeDirectionsUrlParams(updates, defaults = {}) {
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const apply = (key, value, defaultValue) => {
    if (value == null || value === '' || value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, String(value));
    }
  };

  if ('provider' in updates) {
    apply(DIRECTIONS_URL_KEYS.provider, updates.provider, defaults.provider ?? 'hybrid');
  }
  if ('sort' in updates) {
    apply(DIRECTIONS_URL_KEYS.sort, updates.sort, defaults.sort ?? 'score');
  }
  if ('maxRoutes' in updates) {
    apply(
      DIRECTIONS_URL_KEYS.maxRoutes,
      updates.maxRoutes,
      defaults.maxRoutes ?? HYBRID_MAX_RESULTS
    );
  }
  if ('coverage' in updates) {
    apply(DIRECTIONS_URL_KEYS.coverage, updates.coverage, defaults.coverage);
  }
  if ('consider_elevation' in updates) {
    apply(
      DIRECTIONS_URL_KEYS.elevation,
      updates.consider_elevation ? '1' : '0',
      (defaults.consider_elevation ?? BROUTER_PROFILE_DEFAULTS.consider_elevation) ? '1' : '0'
    );
  }
  if ('unpavedPenalty' in updates) {
    apply(
      DIRECTIONS_URL_KEYS.unpaved,
      updates.unpavedPenalty,
      defaults.unpavedPenalty ?? BROUTER_PROFILE_DEFAULTS.unpavedPenalty
    );
  }
  if ('consider_noise' in updates) {
    apply(
      DIRECTIONS_URL_KEYS.noise,
      updates.consider_noise ? '1' : '0',
      (defaults.consider_noise ?? BROUTER_PROFILE_DEFAULTS.consider_noise) ? '1' : '0'
    );
  }
  if ('consider_river' in updates) {
    apply(
      DIRECTIONS_URL_KEYS.river,
      updates.consider_river ? '1' : '0',
      (defaults.consider_river ?? BROUTER_PROFILE_DEFAULTS.consider_river) ? '1' : '0'
    );
  }
  if ('consider_forest' in updates) {
    apply(
      DIRECTIONS_URL_KEYS.forest,
      updates.consider_forest ? '1' : '0',
      (defaults.consider_forest ?? BROUTER_PROFILE_DEFAULTS.consider_forest) ? '1' : '0'
    );
  }

  const qs = params.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash || ''}`;
  if (
    next !== `${window.location.pathname}${window.location.search}${window.location.hash || ''}`
  ) {
    window.history.replaceState(null, '', next);
  }
}
