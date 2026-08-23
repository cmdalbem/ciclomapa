import GooglePlacesGeocoder from './GooglePlacesGeocoder.js';

function mockGooglePlaces({ predictions = [], placeDetails = null } = {}) {
  const sessionTokens = [];
  class AutocompleteSessionToken {
    constructor() {
      this.id = `token-${sessionTokens.length + 1}`;
      sessionTokens.push(this);
    }
  }

  const AutocompleteService = jest.fn().mockImplementation(() => ({
    getPlacePredictions: jest.fn((request, callback) => {
      callback(predictions, window.google.maps.places.PlacesServiceStatus.OK);
    }),
  }));

  const PlacesService = jest.fn().mockImplementation(() => ({
    getDetails: jest.fn((request, callback) => {
      callback(
        placeDetails || {
          geometry: { location: { lng: () => -46.6, lat: () => -23.5 } },
          formatted_address: 'Test Address',
          name: 'Test Place',
          types: ['establishment'],
          address_components: [],
        },
        window.google.maps.places.PlacesServiceStatus.OK
      );
    }),
  }));

  window.google = {
    maps: {
      Geocoder: jest.fn(),
      LatLng: jest.fn((lat, lng) => ({ lat, lng })),
      places: {
        AutocompleteSessionToken,
        AutocompleteService,
        PlacesService,
        PlacesServiceStatus: { OK: 'OK', ZERO_RESULTS: 'ZERO_RESULTS' },
      },
    },
  };

  return { sessionTokens, AutocompleteService, PlacesService };
}

describe('GooglePlacesGeocoder autocomplete sessions', () => {
  afterEach(() => {
    delete window.google;
  });

  it('reuses one session token across prediction requests until place details', async () => {
    mockGooglePlaces({
      predictions: [{ place_id: 'abc', description: 'Test', types: ['establishment'] }],
    });

    const geocoder = new GooglePlacesGeocoder({ apiKey: 'test-key' });
    await geocoder.loadGoogleMapsAPI();

    await geocoder.search('cafe');
    await geocoder.search('cafe sp');

    const autocomplete = geocoder.autocompleteService;
    const firstRequest = autocomplete.getPlacePredictions.mock.calls[0][0];
    const secondRequest = autocomplete.getPlacePredictions.mock.calls[1][0];

    expect(firstRequest.sessionToken).toBeDefined();
    expect(secondRequest.sessionToken).toBe(firstRequest.sessionToken);

    await geocoder.getPlaceDetails('abc');

    const placesService = geocoder.placesService;
    const detailsRequest = placesService.getDetails.mock.calls[0][0];
    expect(detailsRequest.sessionToken).toBe(firstRequest.sessionToken);

    await geocoder.search('new query');
    const thirdRequest = autocomplete.getPlacePredictions.mock.calls[2][0];
    expect(thirdRequest.sessionToken).toBeDefined();
    expect(thirdRequest.sessionToken).not.toBe(firstRequest.sessionToken);
  });

  it('resetAutocompleteSession drops the token so the next search starts fresh', async () => {
    mockGooglePlaces();

    const geocoder = new GooglePlacesGeocoder({ apiKey: 'test-key' });
    await geocoder.loadGoogleMapsAPI();

    await geocoder.search('abc');
    const autocomplete = geocoder.autocompleteService;
    const firstToken = autocomplete.getPlacePredictions.mock.calls[0][0].sessionToken;

    geocoder.resetAutocompleteSession();

    await geocoder.search('abc');
    const secondToken = autocomplete.getPlacePredictions.mock.calls[1][0].sessionToken;
    expect(secondToken).toBeDefined();
    expect(secondToken).not.toBe(firstToken);
  });
});
