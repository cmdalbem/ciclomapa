// Simple test for Mapbox Directions API
// This is a utility function, not integrated into the UI
import mbxDirections from '@mapbox/mapbox-sdk/services/directions';
import { MAPBOX_ACCESS_TOKEN } from './constants';

const directionsClient = mbxDirections({ accessToken: MAPBOX_ACCESS_TOKEN });

export async function testMapboxDirections(from, to) {
    const fromCoords = from || [-43.180278, -22.971177]; // Copacabana
    const toCoords = to || [-43.200278, -22.983333];   // Ipanema

    try {    
        const response = await directionsClient.getDirections({
            profile: 'cycling',
            waypoints: [
                { coordinates: fromCoords },
                { coordinates: toCoords }
            ],
            geometries: 'geojson',
            overview: 'full',
            alternatives: true,
            steps: false
        }).send();
        
        return response.body;
    } catch (err) {
        console.error('Mapbox SDK error:', err);
        throw err;
    }
}
