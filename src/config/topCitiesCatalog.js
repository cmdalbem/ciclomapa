// Curated “top cities” list to help users quickly find the most popular supported areas.
// Slugs must match entries in `citySlugCatalog.js` (canonical where applicable).
// Exported `TOP_CITY_SLUGS` is filtered to countries in `SUPPORTED_COUNTRIES` (`constants.js`).

import { SUPPORTED_COUNTRY_CODES } from './constants.js';
import { getCanonicalCitySlug, getPredefinedCitySlugDefinition } from './citySlugCatalog.js';

const SUPPORTED_COUNTRY_SET = new Set(SUPPORTED_COUNTRY_CODES);

/** @param {string} slug */
function catalogEntryForTopCitySlug(slug) {
  if (!slug) return null;
  const canonical = getCanonicalCitySlug(slug);
  return (
    getPredefinedCitySlugDefinition(slug) ||
    (canonical ? getPredefinedCitySlugDefinition(canonical) : null)
  );
}

/** @param {string} slug */
function isTopCitySlugInSupportedCountries(slug) {
  const def = catalogEntryForTopCitySlug(slug);
  const code = def?.countrycodes?.[0];
  return Boolean(code && SUPPORTED_COUNTRY_SET.has(code));
}

const TOP_CITY_SLUGS_CANDIDATES = [
  // Region capitals (first-level administrative capitals) limited to what exists
  // in our `citySlugCatalog.js`.
  //
  // Note: some expected capitals may be missing if we don't have a slug entry
  // for them in `citySlugCatalog.js`.

  // Brazil (state capitals + DF)
  'brasilia',
  'sao-paulo',
  'rio-de-janeiro',
  'belo-horizonte',
  'salvador',
  'fortaleza',
  'recife',
  'porto-alegre',
  'curitiba',
  'manaus',
  'belem',
  'goiania',
  'sao-luis',
  'cuiaba',
  'maceio',
  'natal',
  'teresina',
  'aracaju',
  'joao-pessoa',
  'florianopolis',
  'rio-branco',
  'macapa',
  'porto-velho',
  'boa-vista',
  'palmas',
  'vitoria',
  'campo-grande',

  // Argentina (province capitals present in our catalog)
  'buenos-aires',
  'cordoba',
  'rosario',
  'mendoza',

  // Colombia (department capitals)
  'bogota',
  'medellin',
  'cali',
  'barranquilla',
  'cartagena',

  // Peru (region capitals)
  'lima',
  'arequipa',
  'trujillo',

  // Chile (region capitals)
  'santiago',
  'valparaiso',
  'concepcion',

  // Bolivia (department capitals)
  'la-paz',
  'santa-cruz-de-la-sierra',

  // Ecuador (main region capitals)
  'quito',
  'guayaquil',

  // Uruguay
  'montevideo',

  // Paraguay
  'assuncao',

  // Venezuela
  'caracas',

  // Portugal (regional/district capitals present in our catalog)
  'lisboa',
  'porto',
  'braga',
  'coimbra',
  'funchal',

  // Spain (autonomous community capitals present in our catalog)
  'madrid',
  'barcelona',
  'valencia',
  'sevilla',
  'malaga',
  'bilbao',
  'zaragoza',
  'murcia',
  'palma-de-mallorca',
  'las-palmas-de-gran-canaria',
];

export const TOP_CITY_SLUGS = TOP_CITY_SLUGS_CANDIDATES.filter(isTopCitySlugInSupportedCountries);
