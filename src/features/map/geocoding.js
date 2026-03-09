import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';
import { MAPBOX_ACCESS_TOKEN } from '../../config/constants.js';

const geocodingClient = mbxGeocoding({ accessToken: MAPBOX_ACCESS_TOKEN });

export async function reverseGeocodePlace(lngLat) {
  let query = lngLat;

  if (lngLat && lngLat.lat !== undefined && lngLat.lng !== undefined) {
    query = [lngLat.lng, lngLat.lat];
  }

  if (!query || query[0] === undefined || query[1] === undefined) {
    throw new Error('Invalid coordinates');
  }

  const response = await geocodingClient
    .reverseGeocode({
      query,
      types: ['place'],
      limit: 1,
      language: ['pt-br'],
    })
    .send();

  const features = response.body.features;

  if (features && features[0]) {
    const place = features[0];
    return {
      place_name: place.place_name,
      bbox: place.bbox,
    };
  }

  throw new Error('No geocoding results found');
}
