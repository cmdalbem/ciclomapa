# Notes for coding agents

Short list of things that are easy to get wrong in this codebase. Read the linked docs before touching the related code.

## Cities are open-ended

CicloMapa works for any city. `src/config/citySlugCatalog.js` is a pre-seeded sample of big cities used for SEO slugs, static boot locations and the top-cities grid. It is **not** a list of supported or "known" cities, and must never be used to gate features or bias runtime guesses (viewport city detection, geocoder ranking, etc.). Details: [docs/cities.md](docs/cities.md).

## Other docs

- Source layout and module-size guidance: [docs/structure.md](docs/structure.md) (don't create tiny single-use util files)
- Styling and design tokens: [docs/styling.md](docs/styling.md)
- Tests: [docs/testing.md](docs/testing.md)
- PMTiles data pipeline: [README.md](README.md#pmtiles-data-pipeline)
