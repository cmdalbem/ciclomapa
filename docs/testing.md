# Frontend testing

Run the full test suite:

```bash
yarn test
```

Single run (no watch): `yarn test --watchAll=false`

## What the suite covers

1. **Smoke** — Minimal app shell (Router + DirectionsProvider) renders without crashing. See `src/App.test.js`.
2. **Accessibility** — `src/App.a11y.test.js`: jest-axe on minimal layout tree; jest-axe on AboutModal and LayersLegendModal when open; keyboard tests (Escape closes both modals). DirectionsPanel is not included in axe tests (Ant Design AutoComplete can report aria violations in jsdom).
3. **Component tests** — Logo, InfrastructureBadge, DirectionsProvider, AboutModal, DirectionsPanel (minimal). See `src/Logo.test.js`, `src/InfrastructureBadge.test.js`, `src/DirectionsContext.test.js`, `src/AboutModal.test.js`, `src/DirectionsPanel.test.js`.
4. **Integration-style** — Key UI present and one user flow (open modal, close modal). See `src/App.integration.test.js`.
5. **Utility unit tests** — Pure functions in `utils.js`, `routeUtils.js`, `geojsonUtils.js`. See `src/utils.test.js`, `src/routeUtils.test.js`, `src/geojsonUtils.test.js`.
6. **Token regression** — Design tokens (CSS custom properties and JS exports) are asserted in `src/config/design-tokens.test.js` so changes to tokens are caught in CI.

## Before moving to the next step

Before moving to the next step, run `yarn test --watchAll=false` and ensure all tests pass.

## End-to-end (Playwright)

UI smoke: start the dev server (`yarn start`), then in another terminal run `yarn e2e` (uses `/?e2e=1`, which skips Mapbox GL init — see `src/Map.js`). Optional: `PLAYWRIGHT_BASE_URL` if the app is not on port 3000.

**API smoke** (`e2e/apis.spec.ts`) hits the same backends the product uses (Overpass, Nominatim, Valhalla, and optionally Mapbox / OpenRouteService / GraphHopper / Google when the usual `REACT_APP_*` env vars are set). It uses Playwright’s HTTP client only — **no browser and no local server**. Run:

```bash
yarn e2e:apis
```

Overpass is shared infrastructure and can be slow or return 5xx; the spec retries mirrors and rounds. Optional provider tests **skip** if the corresponding API key is not in the environment (so CI can run only public checks unless you add secrets).

## Mocks

- **DirectionsPanel.test.js** — `mapbox-gl` and `GooglePlacesGeocoder` are mocked so the panel can render in jsdom without Map or Google APIs.
- **App.test.js** — Does not render the full `App` component (which loads Map, Firebase, etc.); it only renders Router + DirectionsProvider + a placeholder to avoid heavy dependencies in CI.
