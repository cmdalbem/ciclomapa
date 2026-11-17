import { calculateCyclepathCoverageFromBrouterMessages } from './utils/geojsonUtils.js';
import {
  getRouteScore,
  getCoverageBreakdown,
  getCoverageBreakdownSimple,
} from './utils/routeUtils.js';

function buildCoverageBundleFromBrouterMessages(route, layers, isDarkMode) {
  if (!route?.brouterMessages || !layers) return null;

  const coverageResult = calculateCyclepathCoverageFromBrouterMessages(
    route.brouterMessages,
    layers,
    route.geometry
  );
  const coverageData = {
    coverage: coverageResult.coverage,
    coverageByType: coverageResult.coverageByType,
    overlappingCyclepaths: coverageResult.overlappingCyclepaths,
    routePaintSegments: coverageResult.routePaintSegments || [],
    hasCoverageData: true,
  };
  const routeWithCoverage = { ...route, ...coverageData };
  const scoreResult = getRouteScore(routeWithCoverage);

  return {
    ...coverageData,
    score: scoreResult.score,
    scoreClass: scoreResult.cssClass,
    coverageBreakdown: getCoverageBreakdown(routeWithCoverage, undefined, isDarkMode),
    coverageBreakdownSimple: getCoverageBreakdownSimple(routeWithCoverage),
  };
}

class DirectionsManager {
  constructor() {
    this.directionsService = null;
  }

  async initialize() {
    const directionsServiceModule = await import('./directionsService.js');
    this.directionsService = directionsServiceModule.default;
  }

  async calculateDirections(
    fromCoords,
    toCoords,
    _provider,
    _geoJson,
    layers,
    isDarkMode,
    { signal, brouterProfile } = {}
  ) {
    if (!this.directionsService) {
      await this.initialize();
    }

    const throwIfAborted = () => {
      signal?.throwIfAborted?.();
      if (signal?.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
    };

    try {
      const directions = await this.directionsService.getCyclingDirections(fromCoords, toCoords, {
        signal,
        brouterProfile,
      });

      throwIfAborted();

      if (!directions?.routes?.length) {
        throw new Error('Não foram encontradas rotas');
      }

      const routesWithScores = directions.routes.map((route) => {
        const active = buildCoverageBundleFromBrouterMessages(route, layers, isDarkMode);
        return {
          geometry: route.geometry,
          distance: route.distance,
          duration: route.duration,
          overlappingCyclepaths: active?.overlappingCyclepaths || [],
          routePaintSegments: active?.routePaintSegments || [],
          coverage: active?.coverage || 0,
          coverageByType: active?.coverageByType || {},
          hasCoverageData: Boolean(active),
          score: active ? active.score : null,
          scoreClass: active ? active.scoreClass : null,
          coverageBreakdown: active ? active.coverageBreakdown : null,
          coverageBreakdownSimple: active ? active.coverageBreakdownSimple : null,
          brouterMessages: route.brouterMessages || null,
          ascend: route.ascend ?? null,
          netElev: route.netElev ?? null,
          elevationProfile: route.elevationProfile || null,
        };
      });

      const hasCoverageData = routesWithScores.some((route) => route.hasCoverageData);
      routesWithScores.sort((a, b) => {
        if (hasCoverageData) {
          if (b.score !== a.score) return (b.score || 0) - (a.score || 0);
          return (b.coverage || 0) - (a.coverage || 0);
        }
        return (a.distance || 0) - (b.distance || 0);
      });

      const routes = routesWithScores.map((route, sortedIndex) => ({
        ...route,
        sortedIndex,
      }));

      throwIfAborted();
      return {
        routes,
        waypoints: directions.waypoints || [],
        bbox: directions.bbox,
      };
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('Directions error in DirectionsManager:', error);
      }
      throw error;
    }
  }
}

const directionsManager = new DirectionsManager();

export default directionsManager;
