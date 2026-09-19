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

  it('loads Places via importLibrary on search, and Geocoder only on reverse geocode', async () => {
    const Geocoder = jest.fn().mockImplementation(() => ({
      geocode: jest.fn((request, callback) => {
        callback(
          [
            {
              place_id: 'rev',
              formatted_address: 'Rua Teste',
              geometry: { location: { lng: () => -46.6, lat: () => -23.5 } },
              address_components: [],
              types: ['route'],
            },
          ],
          'OK'
        );
      }),
    }));
    class AutocompleteSessionToken {}
    const AutocompleteService = jest.fn().mockImplementation(() => ({
      getPlacePredictions: jest.fn((request, callback) => {
        callback([], window.google.maps.places.PlacesServiceStatus.OK);
      }),
    }));
    const PlacesService = jest.fn().mockImplementation(() => ({
      getDetails: jest.fn(),
    }));

    window.google = {
      maps: {
        GeocoderStatus: { OK: 'OK' },
        importLibrary: jest.fn(async (name) => {
          if (name === 'geocoding') {
            return { Geocoder };
          }
          if (name === 'places') {
            return {
              AutocompleteSessionToken,
              AutocompleteService,
              PlacesService,
              PlacesServiceStatus: { OK: 'OK', ZERO_RESULTS: 'ZERO_RESULTS' },
            };
          }
          return {};
        }),
      },
    };

    const geocoder = new GooglePlacesGeocoder({ apiKey: 'test-key' });
    await geocoder.loadGoogleMapsAPI();
    expect(window.google.maps.importLibrary).not.toHaveBeenCalled();

    await geocoder.search('cafe');
    expect(window.google.maps.importLibrary).toHaveBeenCalledWith('places');
    expect(window.google.maps.importLibrary).not.toHaveBeenCalledWith('geocoding');
    expect(AutocompleteService).toHaveBeenCalled();
    expect(Geocoder).not.toHaveBeenCalled();

    await geocoder.reverseGeocode([-46.6, -23.5]);
    expect(window.google.maps.importLibrary).toHaveBeenCalledWith('geocoding');
    expect(Geocoder).toHaveBeenCalled();
  });

  it('includes the Google status when place details fail', async () => {
    mockGooglePlaces();
    window.google.maps.places.PlacesService = jest.fn().mockImplementation(() => ({
      getDetails: jest.fn((request, callback) => {
        callback(null, 'NOT_FOUND');
      }),
    }));

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const geocoder = new GooglePlacesGeocoder({ apiKey: 'test-key' });
    await expect(
      geocoder.getPlaceDetails('missing', { label: 'Padaria do Centro' })
    ).rejects.toMatchObject({
      message: 'Failed to get place details (NOT_FOUND)',
      code: 'NOT_FOUND',
    });
    expect(warn).toHaveBeenCalledWith('Google place details error:', {
      status: 'NOT_FOUND',
      placeId: 'missing',
      label: 'Padaria do Centro',
    });
    warn.mockRestore();
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
