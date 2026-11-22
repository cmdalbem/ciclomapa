# Notes for coding agents

Short list of things that are easy to get wrong in this codebase. Read the linked docs before touching the related code.

## Cities are open-ended

CicloMapa works for any city. `src/config/citySlugCatalog.js` is a pre-seeded sample of big cities used for SEO slugs, static boot locations and the top-cities grid. It is **not** a list of supported or "known" cities, and must never be used to gate features or bias runtime guesses (viewport city detection, geocoder ranking, etc.). Details: [docs/cities.md](docs/cities.md).

## Don't add CSS by default

Layout, spacing, type, skeletons, buttons, menus: Tailwind utilities and Ant Design components. A new `cm-*` class or a new `.css` file next to a component is a last resort (antd overrides, map/popup HTML, theme tokens). Existing BEM files are not a template for new UI. Details: [docs/styling.md](docs/styling.md).

## Tailwind is 3.4, not 4

`tailwindcss` is pinned to **3.4.17**. Current Tailwind docs are v4 and will give you the wrong APIs (`@theme`, `bg-linear-to-*`, slash opacity). Copy class names from nearby files. Details: [docs/styling.md](docs/styling.md).

## Other docs

- Source layout and module-size guidance: [docs/structure.md](docs/structure.md) (don't create tiny single-use util files)
- Styling and design tokens: [docs/styling.md](docs/styling.md)
- Tests: [docs/testing.md](docs/testing.md)
- PMTiles data pipeline: [README.md](README.md#pmtiles-data-pipeline)
