# Cities, areas and the slug catalog

This one keeps getting misread, so here it is spelled out.

## The mental model

CicloMapa works for **any city in the world**. There is no list of supported cities.

- The "area" (`App.state.area`) is a free-form place label, e.g. `Pelotas, Rio Grande do Sul, Brasil`.
- It comes from wherever the user points us: the URL slug, the city picker, the browser's geolocation, or the map viewport.
- Data for that area is fetched live: Nominatim resolves the label to an OSM area, Overpass returns the bike infrastructure. PMTiles cover whatever the build includes, and the GeoJSON path (routing, analytics) is loaded on demand for the current area.

## What `citySlugCatalog.js` is

`src/config/citySlugCatalog.js` is a hand-picked **sample** of larger cities. Being in it buys a city a few conveniences:

| Perk                                                         | Why it needs a static entry                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| Stable SEO slug (`/sao-paulo`) plus aliases                  | Slugs derived from geocoder output vary by language/format   |
| Static center + area label (`staticLocation`)                | The page can boot on that URL without a geocoding round-trip |
| Top-cities grid in the city switcher (`topCitiesCatalog.js`) | Curated list, must reference catalog slugs                   |
| Locale-independent storage key and display label             | Same city, same key regardless of geocoder language          |

Everything else is an **open slug**: derived on the fly from the area label, resolved via Nominatim, fully functional. Not in the catalog means "no pre-seeded metadata", never "unsupported" or "not a real city".

## Rules for code (humans and agents)

1. Never gate a feature on catalog membership. If something only works for catalog cities, that's a bug unless the feature is literally about the pre-seeded metadata (SEO canonicals, static boot).
2. Never use the catalog as a signal in runtime heuristics (viewport city guess, geocoder result ranking, "is this a city?" checks). A geocoder returning a lake is a geocoder/data problem; solve it with better sampling or feature types, not by checking a list of ~90 cities.
3. Helpers that consult the catalog should say so in their name (`getCatalogCanonicalSlugFromArea`, `getPredefinedCity...`). A `null` from them is the normal case for most of the planet.
4. Adding a city to the catalog is fine and cheap, but it should be because it's a big city we want indexed/fast, not because someone needed it to "work".

## Where this shows up

- `src/App.js`: `getCatalogCanonicalSlugFromArea`, `getCanonicalCityIdentity`, `getStorageKeyForArea`, `normalizeAreaLabelForDisplay`, `getCitySlugFromArea` (works for any area).
- `src/features/map/mapboxGeocoding.js`: `guessPlaceFromViewport` (multi-sample reverse geocode, catalog-free on purpose).
- `docs/SEO_PLAN.md`: the SEO reasoning behind having a catalog at all.
