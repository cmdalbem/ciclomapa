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

    async calculateDirections(fromCoords, toCoords, provider = 'graphhopper', geoJson, layers) {
        if (!this.directionsService) {
            await this.initialize();
        }

        try {
            console.debug('Calculating directions from:', fromCoords, 'to:', toCoords, 'using provider:', provider);
            
            let directions;
            
            if (provider === 'hybrid') {
                // Use hybrid approach - call all providers simultaneously
                directions = await this.calculateHybridDirections(fromCoords, toCoords);
            } else {
                // Use single provider
                this.directionsService.setProvider(provider);
                directions = await this.directionsService.getCyclingDirections(fromCoords, toCoords);
            }
            
            // Calculate coverage, scores, and prepare routes with all data in one pass
            let routesWithScores = [];
            let routeCoverageData = [];
            
            if (directions && directions.routes && directions.routes.length > 0 && geoJson && layers) {
                routesWithScores = directions.routes.map((route, index) => {
                    console.debug(`Route ${index} geometry:`, route.geometry);
                    
                    let coverageData = {
                        coverage: 0,
                        coverageByType: {},
                        overlappingCyclepaths: []
                    };
                    
                    // Calculate coverage if route has valid geometry
                    if (route.geometry && route.geometry.type === 'LineString') {
                        const coverageResult = calculateCyclepathCoverage(route.geometry, geoJson, layers);
                        coverageData = {
                            coverage: coverageResult.coverage,
                            coverageByType: coverageResult.coverageByType,
                            overlappingCyclepaths: coverageResult.overlappingCyclepaths
                        };
                        console.debug(`Route ${index} cyclepath coverage calculated:`, coverageResult.coverage + '%');
                        console.debug(`Route ${index} coverage by type:`, coverageResult.coverageByType);
                        console.debug(`Route ${index} overlap segments found:`, coverageResult.overlappingCyclepaths.length);
                    }
                    
                    // Calculate route score using the coverage data
                    const { score: routeScore, cssClass: routeScoreClass } = getRouteScore([coverageData], 0);
                    
                    // Calculate coverage breakdowns
                    const coverageBreakdown = getCoverageBreakdown([coverageData], 0);
                    const coverageBreakdownSimple = getCoverageBreakdownSimple([coverageData], 0);
                    
                    // Store coverage data for this route
                    routeCoverageData[index] = {
                        ...coverageData,
                        score: routeScore,
                        scoreClass: routeScoreClass,
                        coverageBreakdown,
                        coverageBreakdownSimple
                    };
                    
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
                console.error('Missing data for coverage calculation:', {
                    directions: !!directions,
                    routes: directions?.routes?.length || 0,
                    geoJson: !!geoJson,
                    layers: !!layers
                });
            }
            
            // Sort routes by score (highest first), then by coverage as tiebreaker
            const sortedRoutesWithScores = routesWithScores.sort((a, b) => {
                if (b.score !== a.score) {
                    return (b.score || 0) - (a.score || 0);
                }
                return (b.coverage || 0) - (a.coverage || 0);
            });

            // Limit the number of results after scoring and sorting (only for hybrid provider)
            let limitedSortedRoutes = sortedRoutesWithScores;
            if (provider === 'hybrid') {
                limitedSortedRoutes = sortedRoutesWithScores.slice(0, HYBRID_MAX_RESULTS);
            }

            // Extract sorted routes and coverage data, adding sorted index
            const sortedRoutes = limitedSortedRoutes.map(({ coverage, coverageByType, overlappingCyclepaths, score, scoreClass, coverageBreakdown, coverageBreakdownSimple, ...route }, sortedIndex) => ({
                ...route,
                sortedIndex
            }));
            const sortedRouteCoverageData = limitedSortedRoutes.map(({ coverage, coverageByType, overlappingCyclepaths, score, scoreClass, coverageBreakdown, coverageBreakdownSimple }, sortedIndex) => ({
                coverage,
                coverageByType,
                overlappingCyclepaths,
                score,
                scoreClass,
                coverageBreakdown,
                coverageBreakdownSimple,
                sortedIndex
            }));

            const result = {
                directions: {
                    ...directions,
                    routes: sortedRoutes
                },
                routeCoverageData: sortedRouteCoverageData
            };

            console.log('Directions calculated in DirectionsManager:', result.directions);
            console.log('Route coverage data with scores calculated in DirectionsManager:', result.routeCoverageData);
            
            return result;
            
        } catch (error) {
            console.error('Directions error in DirectionsManager:', error);
            throw error;
        }
    }

    async calculateHybridDirections(fromCoords, toCoords) {
        console.debug('Calculating hybrid directions using all providers');
        
        const providers = ['mapbox', 'graphhopper', 'valhalla', 'openrouteservice'];
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
