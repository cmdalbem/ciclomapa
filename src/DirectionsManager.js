import {
  calculateCyclepathCoverage,
  calculateCyclepathCoverageByOverlap,
  calculateCyclepathCoverageFromPathDetails,
  calculateCyclepathCoverageFromBrouterMessages,
} from './utils/geojsonUtils.js';
import { USE_BROUTER_LOCAL, USE_PMTILES_ROUTE_COVERAGE } from './config/constants.js';
import {
  getRouteScore,
  getCoverageBreakdown,
  getCoverageBreakdownSimple,
} from './utils/routeUtils.js';

/**
 * Score + overlap bundle for one coverage data source / matcher.
 * @param {'nearest'|'overlap'} [matcher='nearest']
 */
export function buildCoverageBundle(
  route,
  geoJson,
  layers,
  isDarkMode,
  { matcher = 'nearest' } = {}
) {
  if (!route?.geometry || route.geometry.type !== 'LineString' || !geoJson || !layers) {
    return null;
  }

  const coverageResult =
    matcher === 'overlap'
      ? calculateCyclepathCoverageByOverlap(route.geometry, geoJson, layers)
      : calculateCyclepathCoverage(route.geometry, geoJson, layers);

  const coverageData = {
    coverage: coverageResult.coverage,
    coverageByType: coverageResult.coverageByType,
    overlappingCyclepaths: coverageResult.overlappingCyclepaths,
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

/** Score from GraphHopper path details (no GeoJSON snap). */
export function buildCoverageBundleFromPathDetails(route, layers, isDarkMode) {
  if (!route?.geometry || route.geometry.type !== 'LineString' || !route.pathDetails || !layers) {
    return null;
  }

  const coverageResult = calculateCyclepathCoverageFromPathDetails(
    route.geometry,
    route.pathDetails,
    layers
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

/** Score from BRouter WayTags (layers.json typology, no GeoJSON snap). */
export function buildCoverageBundleFromBrouterMessages(route, layers, isDarkMode) {
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

/** Copy the active coverage fields from a stored variant onto the route. */
export function applyCoverageVariant(route, source) {
  const variant = route?.coverageVariants?.[source];
  if (!variant) {
    console.warn(`applyCoverageVariant: no variant "${source}" on route`, {
      available: route?.coverageVariants ? Object.keys(route.coverageVariants) : [],
    });
    return route;
  }
  return {
    ...route,
    ...variant,
    coverageSource: source,
  };
}

function formatCoverageCompare(bundle) {
  return bundle ? `${bundle.coverage.toFixed(1)}%` : 'n/a';
}

class DirectionsManager {
  constructor() {
    this.directionsService = null;
  }

  async initialize() {
    // Dynamic import to avoid circular dependencies
    const directionsServiceModule = await import('./directionsService.js');
    this.directionsService = directionsServiceModule.default;
  }

  async calculateDirections(
    fromCoords,
    toCoords,
    provider = 'graphhopper',
    geoJson,
    layers,
    isDarkMode,
    { signal, brouterProfile, pmtilesPocRegion } = {}
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
      console.debug(
        'Calculating directions from:',
        fromCoords,
        'to:',
        toCoords,
        'using provider:',
        provider
      );

      /*
       * 1. Calculate directions using the provider(s)
       */

      let directions;

      if (provider === 'hybrid') {
        // Use hybrid approach - call all providers simultaneously
        directions = await this.calculateHybridDirections(fromCoords, toCoords, {
          signal,
          brouterProfile,
        });
      } else {
        // Use single provider
        this.directionsService.setProvider(provider);
        directions = await this.directionsService.getCyclingDirections(fromCoords, toCoords, {
          signal,
          brouterProfile,
        });
      }

      throwIfAborted();

      /*
       * 2. Calculate scores for each route
       */

      let routesWithScores = [];
      let pmtilesGeoJson = null;
      let analysisGeoJson = null;

      // BRouter scores from WayTags. Don't fetch/snap a PMTiles corridor unless
      // another engine actually needs geometric coverage (hybrid GH/Mapbox).
      const skipPmtilesCorridor = provider === 'brouter';
      if (
        USE_PMTILES_ROUTE_COVERAGE &&
        !skipPmtilesCorridor &&
        directions?.routes?.length &&
        layers
      ) {
        const { loadCorridorCyclepaths } = await import('./features/directions/pmtilesCorridor');
        const loadArchive = async (archive) => {
          try {
            return await loadCorridorCyclepaths(directions.routes, layers, {
              signal,
              archive,
              pocRegionId: pmtilesPocRegion,
            });
          } catch (err) {
            if (err?.name === 'AbortError') throw err;
            console.warn(`PMTiles corridor (${archive}) failed:`, err);
            return null;
          }
        };
        try {
          const [displayResult, analysisResult] = await Promise.all([
            loadArchive('display'),
            loadArchive('analysis'),
          ]);
          throwIfAborted();
          pmtilesGeoJson = displayResult;
          analysisGeoJson = analysisResult;
          if (!pmtilesGeoJson && !analysisGeoJson) {
            console.debug('PMTiles corridor returned no features; falling back to city GeoJSON');
          } else {
            console.debug(
              `PMTiles corridor feature counts: display=${pmtilesGeoJson?.features?.length ?? 0} analysis=${analysisGeoJson?.features?.length ?? 0}`
            );
          }
        } catch (err) {
          if (err?.name === 'AbortError') throw err;
          console.warn('PMTiles corridor coverage failed, falling back to city GeoJSON:', err);
        }
      }

      // Geometric default for engines without tags. BRouter rows pick brTags below.
      const geometricDefault = analysisGeoJson
        ? 'analysis'
        : pmtilesGeoJson
          ? 'pmtiles'
          : provider === 'brouter'
            ? null
            : geoJson
              ? 'city'
              : null;
      const hasTagCoverage = Boolean(
        directions?.routes?.some((r) => r.brouterMessages || r.pathDetails)
      );
      const hasCoverageData = Boolean(
        layers && (geoJson || pmtilesGeoJson || analysisGeoJson || hasTagCoverage)
      );

      if (directions && directions.routes && directions.routes.length > 0) {
        if (!hasCoverageData) {
          console.debug('No coverage data available for any routes');
        }

        routesWithScores = directions.routes.map((route, index) => {
          const coverageVariants = {};
          const skipCityCoverage = provider === 'brouter' || Boolean(route.brouterMessages);
          // City GeoJSON: original lineOverlap (baseline) + nearest-only (new matcher).
          const cityOriginalBundle = skipCityCoverage
            ? null
            : buildCoverageBundle(route, geoJson, layers, isDarkMode, {
                matcher: 'overlap',
              });
          const cityBundle = skipCityCoverage
            ? null
            : buildCoverageBundle(route, geoJson, layers, isDarkMode, {
                matcher: 'nearest',
              });
          const pmtilesBundle = skipCityCoverage
            ? null
            : buildCoverageBundle(route, pmtilesGeoJson, layers, isDarkMode, {
                matcher: 'nearest',
              });
          const analysisBundle = skipCityCoverage
            ? null
            : buildCoverageBundle(route, analysisGeoJson, layers, isDarkMode, {
                matcher: 'nearest',
              });
          const ghDetailsBundle = buildCoverageBundleFromPathDetails(route, layers, isDarkMode);
          const brTagsBundle = buildCoverageBundleFromBrouterMessages(route, layers, isDarkMode);
          if (cityOriginalBundle) coverageVariants.cityOriginal = cityOriginalBundle;
          if (cityBundle) coverageVariants.city = cityBundle;
          if (pmtilesBundle) coverageVariants.pmtiles = pmtilesBundle;
          if (analysisBundle) coverageVariants.analysis = analysisBundle;
          if (ghDetailsBundle) coverageVariants.ghDetails = ghDetailsBundle;
          if (brTagsBundle) coverageVariants.brTags = brTagsBundle;

          if (Object.keys(coverageVariants).length > 0) {
            console.debug(
              `Route ${index} coverage compare: old=${formatCoverageCompare(cityOriginalBundle)} near=${formatCoverageCompare(cityBundle)} pmtiles=${formatCoverageCompare(pmtilesBundle)} analysis=${formatCoverageCompare(analysisBundle)} ghDetails=${formatCoverageCompare(ghDetailsBundle)} brTags=${formatCoverageCompare(brTagsBundle)}`
            );
          }

          const activeSource = coverageVariants.brTags
            ? 'brTags'
            : coverageVariants[geometricDefault]
              ? geometricDefault
              : null;
          const active = activeSource ? coverageVariants[activeSource] : null;

          if (active) {
            console.debug(
              `Route ${index} cyclepath coverage (${activeSource}):`,
              active.coverage + '%'
            );
            console.debug(`Route ${index} coverage by type:`, active.coverageByType);
            console.debug(
              `Route ${index} overlap segments found:`,
              active.overlappingCyclepaths.length
            );
          }

          return {
            ...route,
            coverage: active?.coverage || 0,
            coverageByType: active?.coverageByType || {},
            overlappingCyclepaths: active?.overlappingCyclepaths || [],
            routePaintSegments: active?.routePaintSegments || [],
            hasCoverageData: Boolean(active),
            score: active ? active.score : null,
            scoreClass: active ? active.scoreClass : null,
            coverageBreakdown: active ? active.coverageBreakdown : null,
            coverageBreakdownSimple: active ? active.coverageBreakdownSimple : null,
            coverageSource: activeSource,
            coverageVariants,
          };
        });
      } else {
        console.error('Missing directions data:', {
          directions: !!directions,
          routes: directions?.routes?.length || 0,
        });
      }

      /*
       * 3. Prepare return data: sort and limit routes
       */

      // Sort routes by score (highest first), then by coverage as tiebreaker
      // Routes without coverage data are sorted by distance (shortest first)
      const sortedRoutesWithScores = routesWithScores.sort((a, b) => {
        // If coverage data is available, sort by score
        if (hasCoverageData) {
          if (b.score !== a.score) {
            return (b.score || 0) - (a.score || 0);
          }
          // If scores are equal, sort by coverage percentage
          return (b.coverage || 0) - (a.coverage || 0);
        } else {
          // No coverage data, sort by distance (shortest first)
          return (a.distance || 0) - (b.distance || 0);
        }
      });

      const routes = sortedRoutesWithScores.map((route, sortedIndex) => ({
        // Basic route data
        geometry: route.geometry,
        distance: route.distance,
        duration: route.duration,
        provider: route.provider,
        sortedIndex,

        // Integrated cyclepath data
        overlappingCyclepaths: route.overlappingCyclepaths || [],
        routePaintSegments: route.routePaintSegments || [],
        coverage: route.coverage || 0,
        coverageByType: route.coverageByType || {},
        hasCoverageData: route.hasCoverageData || false,

        // Scoring data
        score: route.score,
        scoreClass: route.scoreClass,
        coverageBreakdown: route.coverageBreakdown,
        coverageBreakdownSimple: route.coverageBreakdownSimple,

        // Both sources kept so the panel can toggle without recalculating
        coverageSource: route.coverageSource,
        coverageVariants: route.coverageVariants,
        pathDetails: route.pathDetails || null,
        brouterMessages: route.brouterMessages || null,
        ascend: route.ascend ?? null,
        netElev: route.netElev ?? null,
        elevationProfile: route.elevationProfile || null,
      }));

      const availableCoverageSources = [];
      if (routes.some((r) => r.coverageVariants?.cityOriginal)) {
        availableCoverageSources.push('cityOriginal');
      }
      if (routes.some((r) => r.coverageVariants?.city)) availableCoverageSources.push('city');
      if (routes.some((r) => r.coverageVariants?.pmtiles)) {
        availableCoverageSources.push('pmtiles');
      }
      if (routes.some((r) => r.coverageVariants?.analysis)) {
        availableCoverageSources.push('analysis');
      }
      if (routes.some((r) => r.coverageVariants?.ghDetails)) {
        availableCoverageSources.push('ghDetails');
      }
      if (routes.some((r) => r.coverageVariants?.brTags)) {
        availableCoverageSources.push('brTags');
      }

      const result = {
        routes: routes,
        waypoints: directions.waypoints || [],
        bbox: directions.bbox,
        coverageSource:
          provider === 'brouter' && routes.some((r) => r.coverageVariants?.brTags)
            ? 'brTags'
            : geometricDefault ||
              (routes.some((r) => r.coverageVariants?.brTags) ? 'brTags' : 'city'),
        availableCoverageSources,
      };

      console.log('Unified directions calculated in DirectionsManager:', result);

      throwIfAborted();
      return result;
    } catch (error) {
      if (error?.name !== 'AbortError') {
        console.error('Directions error in DirectionsManager:', error);
      }
      throw error;
    }
  }

  async calculateHybridDirections(fromCoords, toCoords, { signal, brouterProfile } = {}) {
    console.debug('Calculating hybrid directions using all providers');

    const providers = ['mapbox', 'graphhopper', 'valhalla'];
    if (USE_BROUTER_LOCAL) providers.push('brouter');
    const promises = providers.map(async (providerName) => {
      try {
        const result = await this.directionsService.getCyclingDirections(fromCoords, toCoords, {
          signal,
          providerName,
          brouterProfile,
        });
        return {
          provider: providerName,
          routes: result.routes || [],
          waypoints: result.waypoints || [],
          bbox: result.bbox,
        };
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        console.warn(`Provider ${providerName} failed:`, error.message);
        return {
          provider: providerName,
          routes: [],
          waypoints: [],
          bbox: null,
          error: error.message,
        };
      }
    });

    const results = await Promise.allSettled(promises);
    if (signal?.aborted) {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      throw err;
    }

    const allRoutes = [];
    const allWaypoints = [];
    let combinedBbox = null;

    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value.routes.length > 0) {
        const providerName = result.value.provider;
        const labels = {
          mapbox: 'Mapbox',
          graphhopper: 'GraphHopper',
          brouter: 'BRouter',
          valhalla: 'Valhalla',
        };
        const routesWithProvider = result.value.routes.map((route) => ({
          ...route,
          provider: labels[providerName] || providerName,
        }));

        allRoutes.push(...routesWithProvider);

        if (allWaypoints.length === 0 && result.value.waypoints.length > 0) {
          allWaypoints.push(...result.value.waypoints);
        }

        if (result.value.bbox) {
          if (!combinedBbox) {
            combinedBbox = [...result.value.bbox];
          } else {
            combinedBbox[0] = Math.min(combinedBbox[0], result.value.bbox[0]);
            combinedBbox[1] = Math.min(combinedBbox[1], result.value.bbox[1]);
            combinedBbox[2] = Math.max(combinedBbox[2], result.value.bbox[2]);
            combinedBbox[3] = Math.max(combinedBbox[3], result.value.bbox[3]);
          }
        }
      }
    });

    console.debug(
      `Hybrid calculation completed: ${allRoutes.length} routes from ${results.filter((r) => r.status === 'fulfilled' && r.value.routes.length > 0).length} providers`
    );

    return {
      routes: allRoutes,
      waypoints: allWaypoints,
      bbox: combinedBbox,
    };
  }
}

// Create a singleton instance
const directionsManager = new DirectionsManager();

export default directionsManager;
