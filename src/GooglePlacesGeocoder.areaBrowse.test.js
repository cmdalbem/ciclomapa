import { isAreaBrowsePlaceResult } from './GooglePlacesGeocoder.js';

describe('isAreaBrowsePlaceResult', () => {
  it('treats bare cities as area browse', () => {
    expect(isAreaBrowsePlaceResult(['locality', 'political'])).toBe(true);
    expect(isAreaBrowsePlaceResult(['administrative_area_level_3', 'political'])).toBe(true);
  });

  it('treats states as area browse but not neighborhoods', () => {
    expect(isAreaBrowsePlaceResult(['neighborhood', 'political'])).toBe(false);
    expect(isAreaBrowsePlaceResult(['sublocality', 'political'])).toBe(false);
    expect(isAreaBrowsePlaceResult(['postal_code', 'political'])).toBe(false);
    expect(isAreaBrowsePlaceResult(['administrative_area_level_1', 'political'])).toBe(true);
  });

  it('treats POIs and addresses as not area browse', () => {
    expect(isAreaBrowsePlaceResult(['establishment', 'point_of_interest'])).toBe(false);
    expect(isAreaBrowsePlaceResult(['street_address', 'political'])).toBe(false);
    expect(isAreaBrowsePlaceResult(['premise', 'street_address'])).toBe(false);
  });

  it('defaults to POI behavior when types are unknown', () => {
    expect(isAreaBrowsePlaceResult([])).toBe(false);
    expect(isAreaBrowsePlaceResult(['geocode'])).toBe(false);
  });
});
