# AGENTS.md

## Cursor Cloud specific instructions

CicloMapa is a single-page frontend web app (Create React App + CRACO, React 19, TypeScript, yarn). There is **no backend server in this repo** — all "backends" are third-party HTTP APIs called directly from the browser (Firebase config is hardcoded in `src/Storage.js`; Overpass/Nominatim/Valhalla are public and keyless).

### Running / services

- Dev server: `yarn start` (CRACO, serves on port 3000). Use `BROWSER=none yarn start` in headless environments so it does not try to open a browser.
- Standard scripts live in `package.json`: `yarn lint`, `yarn typecheck`, `yarn format:check`, `yarn test --watchAll=false`, `yarn build`, `yarn e2e`, `yarn e2e:apis`.
- CI reference: `.github/workflows/ci.yml` (Node 22, `yarn install --frozen-lockfile`, then format:check → lint → typecheck → unit tests → `yarn playwright install --with-deps chromium` → `yarn e2e:apis`).

### Required environment variable (non-obvious, hard blocker)

- **`REACT_APP_MAPBOX_ACCESS_TOKEN` is required for the app to render at all.** `src/features/map/mapboxGeocoding.js` constructs a Mapbox client at module-load time, so with no token the whole app throws `Cannot create a client without an access token` and shows a black error screen — this happens even with `?e2e=1`. Set this env var (e.g. a `.env` file at repo root or a Cloud secret) before doing any browser-based work or running the browser e2e smoke tests.
- Optional keys degrade gracefully when absent: `REACT_APP_OPENROUTESERVICE_API_KEY`, `REACT_APP_GRAPHHOPPER_API_KEY`, `REACT_APP_GOOGLE_PLACES_API_KEY`, `REACT_APP_AIRTABLE_API_KEY` / `REACT_APP_AIRTABLE_BASE_ID`, `REACT_APP_PMTILES_URL` / `REACT_APP_PMTILES_FILENAME`.

### Testing notes

- `yarn e2e:apis` uses Playwright's HTTP `request` context only (no browser, no dev server needed) and checks public OSM/routing endpoints; provider tests that need keys skip when the key is unset. This is the e2e suite CI runs.
- `yarn e2e` (browser smoke, `e2e/smoke.spec.ts`) navigates with `?e2e=1` to skip Mapbox GL map init, but still requires `REACT_APP_MAPBOX_ACCESS_TOKEN` to be set (module-load reason above) and a running dev server. It needs browsers: `yarn playwright install chromium` first. It is not run in CI.
- `yarn lint` currently emits many `react/prop-types` warnings but exits 0 (warnings only, no errors).
