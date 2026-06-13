import {
  favoriteMatchesArea,
  filterFavoritesByQuery,
  filterFavoritesForArea,
  getAreaCityLabel,
  type FavoriteItem,
} from './favoritesStore';

const saoPauloFavorite: FavoriteItem = {
  id: 'fav-sp',
  title: 'Sesc Pompeia',
  subtitle: 'Rua Clélia - Água Branca',
  lng: -46.68,
  lat: -23.53,
  areaContext: 'São Paulo, SP, Brasil',
  addedAt: 1,
};

const fortalezaFavorite: FavoriteItem = {
  id: 'fav-for',
  title: 'Praia de Iracema',
  subtitle: 'Iracema',
  lng: -38.51,
  lat: -3.72,
  areaContext: 'Fortaleza, Ceará, Brasil',
  addedAt: 2,
};

describe('getAreaCityLabel', () => {
  it('returns the first segment of an area string', () => {
    expect(getAreaCityLabel('São Paulo, SP, Brasil')).toBe('São Paulo');
  });
});

describe('favoriteMatchesArea', () => {
  it('matches favorites in the current city', () => {
    expect(favoriteMatchesArea(saoPauloFavorite, 'São Paulo, SP, Brasil')).toBe(true);
  });

  it('rejects favorites from another city', () => {
    expect(favoriteMatchesArea(fortalezaFavorite, 'São Paulo, SP, Brasil')).toBe(false);
  });

  it('rejects favorites without areaContext', () => {
    expect(
      favoriteMatchesArea({ ...saoPauloFavorite, areaContext: undefined }, 'São Paulo, SP, Brasil')
    ).toBe(false);
  });
});

describe('filterFavoritesForArea', () => {
  it('keeps only favorites from the current map area', () => {
    const filtered = filterFavoritesForArea(
      [saoPauloFavorite, fortalezaFavorite],
      'São Paulo, SP, Brasil'
    );
    expect(filtered).toEqual([saoPauloFavorite]);
  });
});

describe('filterFavoritesByQuery', () => {
  it('filters favorites by title or subtitle', () => {
    const filtered = filterFavoritesByQuery([saoPauloFavorite, fortalezaFavorite], 'sesc');
    expect(filtered).toEqual([saoPauloFavorite]);
  });

  it('returns all favorites when query is empty', () => {
    expect(filterFavoritesByQuery([saoPauloFavorite], '')).toEqual([saoPauloFavorite]);
  });
});
