import { favoriteToDirectionsSuggestion } from './placesAutocomplete.js';

describe('favoriteToDirectionsSuggestion', () => {
  it('maps a favorite to a geocoder-ready suggestion with coordinates', () => {
    const suggestion = favoriteToDirectionsSuggestion(
      {
        id: 'fav-1',
        title: 'Sesc Pompeia',
        subtitle: 'Rua Clélia - Água Branca, São Paulo - SP',
        lng: -46.68,
        lat: -23.53,
        areaContext: 'São Paulo, SP, Brasil',
        placeId: 'abc123',
        placeTypes: ['point_of_interest'],
        addedAt: 1,
      },
      { area: 'São Paulo, SP, Brasil' }
    );

    expect(suggestion.isFavorite).toBe(true);
    expect(suggestion.center).toEqual([-46.68, -23.53]);
    expect(suggestion.properties.place_id).toBe('abc123');
    expect(suggestion.properties.address_components).toEqual([
      { long_name: 'São Paulo', short_name: 'São Paulo', types: ['locality', 'political'] },
    ]);
    expect(suggestion.place_name).toBe('Sesc Pompeia');
    expect(suggestion.properties.name).toBe('Sesc Pompeia');
    expect(suggestion.properties.formatted_address).toBe(
      'Rua Clélia - Água Branca, São Paulo - SP'
    );
    expect(suggestion.properties.structured_formatting).toEqual({
      main_text: 'Sesc Pompeia',
      secondary_text: 'Rua Clélia - Água Branca, São Paulo - SP',
    });
    expect(suggestion.commitLabel).toBe('Sesc Pompeia - Rua Clélia - Água Branca');
  });

  it('simplifies favorite labels when resolving for commit', async () => {
    const { geocodePlacesSuggestionToResult } = require('./placesAutocomplete.js');
    const suggestion = favoriteToDirectionsSuggestion(
      {
        id: 'fav-1',
        title: 'Sesc Pompeia',
        subtitle: 'Rua Clélia - Água Branca, São Paulo - SP',
        lng: -46.68,
        lat: -23.53,
        areaContext: 'São Paulo, SP, Brasil',
        placeId: 'abc123',
        addedAt: 1,
      },
      { area: 'São Paulo, SP, Brasil' }
    );

    const { result } = await geocodePlacesSuggestionToResult(suggestion, {
      area: 'São Paulo, SP, Brasil',
    });

    expect(result.place_name).toBe('Sesc Pompeia - Rua Clélia - Água Branca');
  });

  it('keeps a short input label after place details are merged onto a favorite', () => {
    const { applyDirectionsInputLabelToResult } = require('./googlePlacesClient.js');
    const suggestion = favoriteToDirectionsSuggestion(
      {
        id: 'fav-1',
        title: 'Sesc Pompeia',
        subtitle: 'Rua Clélia - Água Branca, São Paulo - SP',
        lng: -46.68,
        lat: -23.53,
        areaContext: 'São Paulo, SP, Brasil',
        placeId: 'abc123',
        addedAt: 1,
      },
      { area: 'São Paulo, SP, Brasil' }
    );

    const withDetails = {
      ...suggestion,
      place_name: 'Sesc Pompeia - Rua Clélia - Água Branca, São Paulo - SP, Brasil',
      properties: {
        ...suggestion.properties,
        formatted_address: 'Sesc Pompeia - Rua Clélia - Água Branca, São Paulo - SP, Brasil',
        address_components: [
          { long_name: 'Sesc Pompeia', short_name: 'Sesc Pompeia', types: ['establishment'] },
          { long_name: 'Rua Clélia', short_name: 'Rua Clélia', types: ['route'] },
          { long_name: 'Água Branca', short_name: 'Água Branca', types: ['sublocality'] },
          { long_name: 'São Paulo', short_name: 'São Paulo', types: ['locality'] },
          { long_name: 'São Paulo', short_name: 'SP', types: ['administrative_area_level_1'] },
        ],
      },
    };

    expect(
      applyDirectionsInputLabelToResult(withDetails, { area: 'São Paulo, SP, Brasil' }).place_name
    ).toBe('Sesc Pompeia - Rua Clélia - Água Branca');
  });
});
