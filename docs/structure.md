# Source folder structure

The `src/` directory is organized as follows:

- **`contexts/`** — React context providers (e.g. `DirectionsContext.tsx`).
- **`components/`** — Shared, reusable UI (e.g. `Logo.tsx`, `InfrastructureBadge.tsx`). Small pieces used in multiple places.

**TypeScript**: The project uses TypeScript with `allowJs` (see `tsconfig.json`). New components and modules should be written in TypeScript (`.tsx` for React components, `.ts` for non-JSX). Existing `.js` files remain supported during gradual migration.

- **`utils/`** — Pure helpers and shared logic: `utils.js`, `routeUtils.js`, `geojsonUtils.js`.
- **`config/`** — App configuration and design tokens: `constants.js`, `design-tokens.js`, `layers.json`. API keys, feature flags, and theme/layout constants.
- **`styles/`** — Global styles: `App.less`, `theme-tailwind-overrides.css` (Tailwind CDN theme hacks for `body.theme-light` / `theme-dark`). Ant Design tokens: `src/config/antdTheme.js`. Component-specific CSS/LESS stay next to the component (e.g. `DirectionsPanel.css` in `src/`).

Feature-level modules (Map, DirectionsPanel, TopBar, LayersPanel, modals, etc.) currently live in the root of `src/`. They can be moved later into **`features/`** (or **`screens/`**) in batches, each with its own folder (component + styles + tests). Run `yarn test --watchAll=false` and `yarn start` after each move.

Tests stay next to the component or in `src/` (e.g. `App.test.js`, `Logo.test.js`).
