# Frontend testing

Run the full test suite:

```bash
yarn test
```

Single run (no watch): `yarn test --watchAll=false`

## What the suite covers

1. **Smoke** — Minimal app shell (Router + DirectionsProvider) renders without crashing. See `src/App.test.js`.
2. **Accessibility** — `src/App.a11y.test.js`: jest-axe on minimal layout tree; jest-axe on AboutModal and LayersLegendModal when open; keyboard tests (Escape closes both modals). DirectionsPanel is not included in axe tests (Ant Design AutoComplete can report aria violations in jsdom).
3. **App logic** — `src/App.logic.test.js` mounts `App` with `AppLayout` mocked. Covers city slug helpers, `needsCityGeoJsonContext`, viewport area sync, `initLayers` / PMTiles availability, and the small UI handlers (theme, sidebar, download).
4. **Map helpers** — `src/Map.test.js` uses `/?e2e=1` so Mapbox GL is not constructed. Covers `flyMapToCityFocus`, OSM→Mapbox filters, clean-mode labels, and route-endpoint POI `within` filters.
5. **OSM / geocoding** — `src/OSMController.test.js` (queries, Nominatim, Overpass race/abort) and `src/features/map/mapboxGeocoding.test.js` (sample points + majority vote).
6. **Shell components** — TopBar, LayersBar, LayersPanel, AnalyticsSidebar, AppLayout. See the matching `*.test.js` files.
7. **Older component tests** — Logo, InfrastructureBadge, DirectionsProvider, AboutModal, DirectionsPanel (minimal).
8. **Integration-style** — Key UI present and one user flow (open modal, close modal). See `src/App.integration.test.js`.
9. **Utility unit tests** — Pure functions in `utils.js`, `routeUtils.js`, `geojsonUtils.js`.
10. **Token regression** — `src/config/design-tokens.test.js`.

## Before moving to the next step

Before moving to the next step, run `yarn test --watchAll=false` and ensure all tests pass.

## End-to-end (Playwright)

UI smoke: start the dev server (`yarn start`), then in another terminal run `yarn e2e` (uses `/?e2e=1`, which skips Mapbox GL init — see `src/Map.js`). Optional: `PLAYWRIGHT_BASE_URL` if the app is not on port 3000.

**API smoke** (`e2e/apis.spec.ts`) hits the same backends the product uses (Overpass, Nominatim, Valhalla, and optionally Mapbox / OpenRouteService / GraphHopper / Google when the usual `REACT_APP_*` env vars are set). It uses Playwright’s HTTP client only — **no browser and no local server**. Run:

```bash
yarn e2e:apis
```

Overpass is shared infrastructure and can be slow or return 5xx; the spec retries mirrors and rounds. If a provider is down (connection errors or HTTP 5xx/429 on all Overpass mirrors, etc.), the matching test **skips** so CI is not blocked by third-party outages. Auth/config problems (401, 403, invalid key) still **fail** the test. Skips emit **`[api-smoke] WARNING`** in the log, Playwright **warning** annotations, and **GitHub Actions warnings** on the job — see `e2e/apiSmokeWarnings.ts`. Optional provider tests **skip** if the corresponding API key is not in the environment (so CI can run only public checks unless you add secrets).

## Mocks

- **DirectionsPanel.test.js** — `mapbox-gl` and `GooglePlacesGeocoder` are mocked so the panel can render in jsdom without Map or Google APIs.
- **App.test.js** — Does not render the full `App` component (which loads Map, Firebase, etc.); it only renders Router + DirectionsProvider + a placeholder to avoid heavy dependencies in CI.
- **App.logic.test.js** — Mocks `AppLayout`, Storage, Airtable, and geocoding so the class can mount in jsdom. The real `App` class is a named export for that.
- **Map.test.js** — Mocks `mapbox-gl`; `/?e2e=1` skips `new mapboxgl.Map()`.
- jsdom is missing `matchMedia` / `ResizeObserver`; those are stubbed in `src/setupTests.js` so antd Dropdowns can open.
