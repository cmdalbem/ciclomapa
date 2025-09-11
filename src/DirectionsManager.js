import { calculateCyclepathCoverage } from './geojsonUtils.js';
import { HYBRID_MAX_RESULTS } from './constants.js';

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
            
            // Calculate cyclepath coverage for all routes
            let routeCoverageData = [];
            
            if (directions && directions.routes && directions.routes.length > 0 && geoJson && layers) {
                console.debug('GeoJson features count:', geoJson.features ? geoJson.features.length : 'no features');
                console.debug('Layers count:', layers ? layers.length : 'no layers');
                
                // Calculate coverage for each route
                directions.routes.forEach((route, index) => {
                    console.debug(`Route ${index} geometry:`, route.geometry);
                    
                    if (route.geometry && route.geometry.type === 'LineString') {
                        const coverageResult = calculateCyclepathCoverage(route.geometry, geoJson, layers);
                        routeCoverageData[index] = {
                            coverage: coverageResult.coverage,
                            coverageByType: coverageResult.coverageByType,
                            overlappingCyclepaths: coverageResult.overlappingCyclepaths
                        };
                        console.debug(`Route ${index} cyclepath coverage calculated:`, coverageResult.coverage + '%');
                        console.debug(`Route ${index} coverage by type:`, coverageResult.coverageByType);
                        console.debug(`Route ${index} overlap segments found:`, coverageResult.overlappingCyclepaths.length);
                    } else {
                        routeCoverageData[index] = {
                            coverage: 0,
                            coverageByType: {},
                            overlappingCyclepaths: []
                        };
                    }
                });
                
            } else {
                console.error('Missing data for coverage calculation:', {
                    directions: !!directions,
                    routes: directions?.routes?.length || 0,
                    geoJson: !!geoJson,
                    layers: !!layers
                });
            }
            
            // Sort routes by coverage percentage (highest first)
            const routesWithCoverage = directions.routes.map((route, index) => ({
                ...route,
                coverage: routeCoverageData[index]?.coverage || 0,
                coverageByType: routeCoverageData[index]?.coverageByType || {},
                overlappingCyclepaths: routeCoverageData[index]?.overlappingCyclepaths || []
            })).sort((a, b) => b.coverage - a.coverage);

            // Extract sorted routes and coverage data
            const sortedRoutes = routesWithCoverage.map(({ coverage, coverageByType, overlappingCyclepaths, ...route }) => route);
            const sortedRouteCoverageData = routesWithCoverage.map(({ coverage, coverageByType, overlappingCyclepaths }) => ({
                coverage,
                coverageByType,
                overlappingCyclepaths
            }));

            const result = {
                directions: {
                    ...directions,
                    routes: sortedRoutes
                },
                routeCoverageData: sortedRouteCoverageData
            };

            console.log('Directions calculated in DirectionsManager:', result.directions);
            console.log('Route coverage data calculated in DirectionsManager:', result.routeCoverageData);
            
            return result;
            
        } catch (error) {
            console.error('Directions error in DirectionsManager:', error);
            throw error;
        }
    }

    async calculateHybridDirections(fromCoords, toCoords) {
        console.debug('Calculating hybrid directions using all providers');
        
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

        // Limit the number of results
        const limitedRoutes = allRoutes.slice(0, HYBRID_MAX_RESULTS);
        
        console.debug(`Hybrid calculation completed: ${limitedRoutes.length} routes (limited from ${allRoutes.length} total) from ${results.filter(r => r.status === 'fulfilled' && r.value.routes.length > 0).length} providers`);

        return {
            routes: limitedRoutes,
            waypoints: allWaypoints,
            bbox: combinedBbox
        };
    }

}

// Export a singleton instance
export default new DirectionsManager();
