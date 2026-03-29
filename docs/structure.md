# Source folder structure

## Module size (maintainer preference)

Prefer a **practical middle ground** when deciding how many files to add for a feature:

- **Avoid** stuffing unrelated concerns into one huge component or module when that hurts readability, testing, or reuse.
- **Do not add a new file** that only holds a few small functions. When unsure, **append** those helpers to an existing general util module instead:
  - Broad, cross-cutting helpers → `utils/utils.js`
  - Anything that clearly belongs with routing / distances → `utils/routeUtils.js` (or the closest existing fit)
  - GeoJSON-specific → `utils/geojsonUtils.js`
  - Same idea for other established buckets (`documentMeta.js`, `themeUtils.ts`, etc.)

  Reserve **new util files** for larger, cohesive topics or when an area has grown enough that a dedicated module is obviously warranted.

**Default:** keep related logic **colocated**—for example a small set of helpers next to the feature (same folder or one `*Utils` / `*helpers` module)—and **extract** to its own file only when size, reuse, or clarity clearly justify it. AI assistants and contributors should follow this unless a task explicitly asks otherwise.

---

The `src/` directory is organized as follows:

- **`contexts/`** — React context providers (e.g. `DirectionsContext.tsx`).
- **`components/`** — Shared, reusable UI (e.g. `Logo.tsx`, `InfrastructureBadge.tsx`). Small pieces used in multiple places.

**TypeScript**: The project uses TypeScript with `allowJs` (see `tsconfig.json`). New components and modules should be written in TypeScript (`.tsx` for React components, `.ts` for non-JSX). Existing `.js` files remain supported during gradual migration.

- **`utils/`** — Pure helpers and shared logic (e.g. `utils.js`, `routeUtils.js`, `geojsonUtils.js`). Prefer extending these (or another existing util in this folder) over adding a new file for a handful of small functions; see **Module size** above.
- **`config/`** — App configuration and design tokens: `constants.js`, `design-tokens.js`, `layers.json`. API keys, feature flags, and theme/layout constants.
- **`styles/`** — Global styles: `App.less`, `theme-tailwind-overrides.css` (Tailwind CDN theme hacks for `body.theme-light` / `theme-dark`). Ant Design tokens: `src/config/antdTheme.js`. Component-specific CSS/LESS stay next to the component (e.g. `DirectionsPanel.css` in `src/`).

Feature-level modules (Map, DirectionsPanel, TopBar, LayersPanel, modals, etc.) currently live in the root of `src/`. They can be moved later into **`features/`** (or **`screens/`**) in batches, each with its own folder (component + styles + tests). Run `yarn test --watchAll=false` and `yarn start` after each move.

Tests stay next to the component or in `src/` (e.g. `App.test.js`, `Logo.test.js`).
