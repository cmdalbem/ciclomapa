import { calculateCyclepathCoverage } from './geojsonUtils.js';

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
            
            // Switch to the selected provider and get directions
            this.directionsService.setProvider(provider);
            const directions = await this.directionsService.getCyclingDirections(fromCoords, toCoords);
            
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
                            overlappingCyclepaths: coverageResult.overlappingCyclepaths
                        };
                        console.debug(`Route ${index} cyclepath coverage calculated:`, coverageResult.coverage + '%');
                        console.debug(`Route ${index} overlap segments found:`, coverageResult.overlappingCyclepaths.length);
                    } else {
                        routeCoverageData[index] = {
                            coverage: 0,
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
                overlappingCyclepaths: routeCoverageData[index]?.overlappingCyclepaths || []
            })).sort((a, b) => b.coverage - a.coverage);

            // Extract sorted routes and coverage data
            const sortedRoutes = routesWithCoverage.map(({ coverage, overlappingCyclepaths, ...route }) => route);
            const sortedRouteCoverageData = routesWithCoverage.map(({ coverage, overlappingCyclepaths }) => ({
                coverage,
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

}

// Export a singleton instance
export default new DirectionsManager();
