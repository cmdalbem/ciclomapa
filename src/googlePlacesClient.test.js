import {
  applyDirectionsInputLabelToResult,
  getDirectionsInputLabelFromResultLike,
  getShortAddressFromResultLike,
} from './googlePlacesClient.js';

const saoPauloComponents = [
  {
    long_name: 'Sesc Pompeia',
    short_name: 'Sesc Pompeia',
    types: ['establishment', 'point_of_interest'],
  },
  { long_name: 'Rua Clélia', short_name: 'Rua Clélia', types: ['route'] },
  { long_name: 'Água Branca', short_name: 'Água Branca', types: ['sublocality', 'political'] },
  { long_name: 'São Paulo', short_name: 'São Paulo', types: ['locality', 'political'] },
  { long_name: 'São Paulo', short_name: 'SP', types: ['administrative_area_level_1', 'political'] },
  { long_name: 'Brasil', short_name: 'BR', types: ['country', 'political'] },
];

describe('getDirectionsInputLabelFromResultLike', () => {
  it('strips city and state from autocomplete structured formatting', () => {
    const label = getDirectionsInputLabelFromResultLike({
      place_name: 'Sesc Pompeia - Rua Clélia - Água Branca, São Paulo - SP',
      properties: {
        structured_formatting: {
          main_text: 'Sesc Pompeia',
          secondary_text: 'Rua Clélia - Água Branca, São Paulo - SP',
        },
        address_components: saoPauloComponents,
        name: 'Sesc Pompeia',
      },
    });

    expect(label).toBe('Sesc Pompeia - Rua Clélia - Água Branca');
  });

  it('strips city and state from place_name when structured formatting is missing', () => {
    const label = getDirectionsInputLabelFromResultLike({
      place_name: 'Rua Pais Leme, 100 - Pinheiros, São Paulo - SP, Brasil',
      properties: {
        address_components: [
          { long_name: '100', short_name: '100', types: ['street_number'] },
          { long_name: 'Rua Pais Leme', short_name: 'Rua Pais Leme', types: ['route'] },
          { long_name: 'Pinheiros', short_name: 'Pinheiros', types: ['sublocality', 'political'] },
          { long_name: 'São Paulo', short_name: 'São Paulo', types: ['locality', 'political'] },
          {
            long_name: 'São Paulo',
            short_name: 'SP',
            types: ['administrative_area_level_1', 'political'],
          },
        ],
      },
    });

    expect(label).toBe('Rua Pais Leme, 100 - Pinheiros');
  });

  it('falls back to stripping city/state from place_name using the map area hint', () => {
    const label = getDirectionsInputLabelFromResultLike(
      {
        place_name: 'Parque Ibirapuera - Vila Mariana, São Paulo - SP',
      },
      { area: 'São Paulo, SP, Brasil' }
    );

    expect(label).toBe('Parque Ibirapuera - Vila Mariana');
  });
});

describe('applyDirectionsInputLabelToResult', () => {
  it('writes the short label onto favorite-shaped results', () => {
    const normalized = applyDirectionsInputLabelToResult(
      {
        place_name: 'Sesc Pompeia - Rua Clélia - Água Branca, São Paulo - SP',
        properties: {
          structured_formatting: {
            main_text: 'Sesc Pompeia',
            secondary_text: 'Rua Clélia - Água Branca, São Paulo - SP',
          },
          address_components: [
            { long_name: 'São Paulo', short_name: 'São Paulo', types: ['locality', 'political'] },
          ],
        },
      },
      { area: 'São Paulo, SP, Brasil' }
    );

    expect(normalized.place_name).toBe('Sesc Pompeia - Rua Clélia - Água Branca');
    expect(normalized.properties.structured_formatting).toEqual({
      main_text: 'Sesc Pompeia - Rua Clélia - Água Branca',
      secondary_text: '',
    });
  });
});

describe('getShortAddressFromResultLike', () => {
  it('keeps street-only labels for geolocation', () => {
    const label = getShortAddressFromResultLike({
      place_name: 'Rua das Flores, 123 - Pinheiros, São Paulo - SP, Brasil',
      properties: {
        address_components: [
          { long_name: '123', short_name: '123', types: ['street_number'] },
          { long_name: 'Rua das Flores', short_name: 'Rua das Flores', types: ['route'] },
          { long_name: 'Pinheiros', short_name: 'Pinheiros', types: ['sublocality', 'political'] },
          { long_name: 'São Paulo', short_name: 'São Paulo', types: ['locality', 'political'] },
        ],
      },
    });

    expect(label).toBe('Rua das Flores, 123');
  });
});
