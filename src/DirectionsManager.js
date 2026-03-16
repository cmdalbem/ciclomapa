import { calculateCyclepathCoverage } from './geojsonUtils.js';
import { HYBRID_MAX_RESULTS } from './constants.js';
import { getRouteScore, getCoverageBreakdown, getCoverageBreakdownSimple } from './routeUtils.js';

class DirectionsManager {
    constructor() {
        this.directionsService = null;
    }

    async initialize() {
        // Dynamic import to avoid circular dependencies
        const directionsServiceModule = await import('./directionsService.js');
        this.directionsService = directionsServiceModule.default;
    }

    async calculateDirections(fromCoords, toCoords, provider = 'graphhopper', geoJson, layers, isDarkMode) {
        if (!this.directionsService) {
            await this.initialize();
        }

        try {
            console.debug('Calculating directions from:', fromCoords, 'to:', toCoords, 'using provider:', provider);
            
            /*
             * 1. Calculate directions using the provider(s)
             */

            let directions;
            
            if (provider === 'hybrid') {
                // Use hybrid approach - call all providers simultaneously
                directions = await this.calculateHybridDirections(fromCoords, toCoords);
            } else {
                // Use single provider
                this.directionsService.setProvider(provider);
                directions = await this.directionsService.getCyclingDirections(fromCoords, toCoords);
            }
            
            
            /*
             * 2. Calculate scores for each route
             */

            // Calculate coverage, scores, and prepare routes with all data in one pass
            let routesWithScores = [];
            
            // Check if coverage data is available once for all routes
            const hasCoverageData = geoJson && layers;
            
            if (directions && directions.routes && directions.routes.length > 0) {
                
                if (!hasCoverageData) {
                    console.debug('No coverage data available for any routes');
                }
                
                routesWithScores = directions.routes.map((route, index) => {
                    // console.debug(`Route ${index} geometry:`, route.geometry);
                    
                    let coverageData = {
                        coverage: 0,
                        coverageByType: {},
                        overlappingCyclepaths: [],
                        hasCoverageData
                    };
                    
                    // Calculate coverage if route has valid geometry and coverage data is available
                    if (route.geometry && route.geometry.type === 'LineString' && hasCoverageData) {
                        const coverageResult = calculateCyclepathCoverage(route.geometry, geoJson, layers);
                        coverageData = {
                            coverage: coverageResult.coverage,
                            coverageByType: coverageResult.coverageByType,
                            overlappingCyclepaths: coverageResult.overlappingCyclepaths,
                            hasCoverageData: true
                        };
                        console.debug(`Route ${index} cyclepath coverage calculated:`, coverageResult.coverage + '%');
                        console.debug(`Route ${index} coverage by type:`, coverageResult.coverageByType);
                        console.debug(`Route ${index} overlap segments found:`, coverageResult.overlappingCyclepaths.length);
                    }
                    
                    // Calculate route score using the coverage data
                    // Only calculate score if we have coverage data, otherwise return null
                    let routeScore, routeScoreClass;
                    if (hasCoverageData) {
                        const routeWithCoverage = { ...route, ...coverageData };
                        const scoreResult = getRouteScore(routeWithCoverage);
                        routeScore = scoreResult.score;
                        routeScoreClass = scoreResult.cssClass;
                    } else {
                        routeScore = null;
                        routeScoreClass = null;
                    }
                    
                    // Calculate coverage breakdowns
                    // Only calculate breakdowns if we have coverage data, otherwise return null
                    let coverageBreakdown, coverageBreakdownSimple;
                    if (hasCoverageData) {
                        const routeWithCoverage = { ...route, ...coverageData };
                        coverageBreakdown = getCoverageBreakdown(routeWithCoverage, undefined, isDarkMode);
                        coverageBreakdownSimple = getCoverageBreakdownSimple(routeWithCoverage);
                    } else {
                        coverageBreakdown = null;
                        coverageBreakdownSimple = null;
                    }
                    
                    return {
                        ...route,
                        ...coverageData,
                        score: routeScore,
                        scoreClass: routeScoreClass,
                        coverageBreakdown,
                        coverageBreakdownSimple
                    };
                });
                
            } else {
                console.error('Missing directions data:', {
                    directions: !!directions,
                    routes: directions?.routes?.length || 0
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
                    return (b.coverage || 0) - (a.coverage || 0);
                }
                // If no coverage data, sort by distance (shortest first)
                return (a.distance || 0) - (b.distance || 0);
            });

            // Limit the number of results after scoring and sorting (only for hybrid provider)
            let limitedSortedRoutes = sortedRoutesWithScores;
            if (provider === 'hybrid') {
                limitedSortedRoutes = sortedRoutesWithScores.slice(0, HYBRID_MAX_RESULTS);
            }

            // Create unified route data structure with integrated cyclepath information
            const routes = limitedSortedRoutes.map((route, sortedIndex) => ({
                // Original route properties
                geometry: route.geometry,
                distance: route.distance,
                duration: route.duration,
                provider: route.provider,
                sortedIndex,
                
                // Integrated cyclepath data
                overlappingCyclepaths: route.overlappingCyclepaths || [],
                coverage: route.coverage || 0,
                coverageByType: route.coverageByType || {},
                hasCoverageData: route.hasCoverageData || false,
                
                // Scoring data
                score: route.score,
                scoreClass: route.scoreClass,
                coverageBreakdown: route.coverageBreakdown,
                coverageBreakdownSimple: route.coverageBreakdownSimple
            }));

            const result = {
                routes: routes,
                waypoints: directions.waypoints || [],
                bbox: directions.bbox
            };

            console.log('Unified directions calculated in DirectionsManager:', result);
            
            return result;
            
        } catch (error) {
            console.error('Directions error in DirectionsManager:', error);
            throw error;
        }
    }

    async calculateHybridDirections(fromCoords, toCoords) {
        console.debug('Calculating hybrid directions using all providers');
        
        // const providers = ['mapbox', 'graphhopper', 'valhalla', 'openrouteservice'];
        const providers = ['mapbox', 'graphhopper', 'valhalla'];
        const promises = providers.map(async (providerName) => {
            try {
                this.directionsService.setProvider(providerName);
                const result = await this.directionsService.getCyclingDirections(fromCoords, toCoords);
                return {
                    provider: providerName,
                    routes: result.routes || [],
                    waypoints: result.waypoints || [],
                    bbox: result.bbox
                };
            } catch (error) {
                console.warn(`Provider ${providerName} failed:`, error.message);
                return {
                    provider: providerName,
                    routes: [],
                    waypoints: [],
                    bbox: null,
                    error: error.message
                };
            }
        });

        const results = await Promise.allSettled(promises);
        
        // Combine all successful results
        const allRoutes = [];
        const allWaypoints = [];
        let combinedBbox = null;
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.routes.length > 0) {
                const providerName = result.value.provider;
                
                // Add provider info to each route
                const routesWithProvider = result.value.routes.map(route => ({
                    ...route,
                    provider: providerName.charAt(0).toUpperCase() + providerName.slice(1)
                }));
                
                allRoutes.push(...routesWithProvider);
                
                // Use waypoints from first successful provider
                if (allWaypoints.length === 0 && result.value.waypoints.length > 0) {
                    allWaypoints.push(...result.value.waypoints);
                }
                
                // Combine bounding boxes
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

        console.debug(`Hybrid calculation completed: ${allRoutes.length} routes from ${results.filter(r => r.status === 'fulfilled' && r.value.routes.length > 0).length} providers`);
        console.debug('All hybrid routes:', allRoutes);

        return {
            routes: allRoutes,
            waypoints: allWaypoints,
            bbox: combinedBbox
        };
    }

}

// Export a singleton instance
export default new DirectionsManager();
