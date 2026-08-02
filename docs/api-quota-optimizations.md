# API Quota Optimizations

Investigation notes and proposed changes to reduce free-tier API usage.

Nothing below has been implemented yet — this is a review doc.

## Context

The app tracks external API calls via `src/dev/apiTracker.js` / `ApiDebugOverlay`. The highest-volume paid or free-tier-limited services in normal usage are:

- **Mapbox** — reverse geocoding on map move, directions
- **Firebase / Firestore** — city GeoJSON cache reads
- **Overpass** — OSM data fetches (public mirrors)
- **Nominatim** — area ID resolution before Overpass
- **GraphHopper / Valhalla** — hybrid routing
- **Google Places** — search autocomplete / place details (user-driven)

---

## Investigation results

### Hybrid directions (`selectedProvider: 'hybrid'`)

Default in `DirectionsPanel.js` (line 58). Deliberate product feature, not an oversight:

- First option in the settings dropdown, labeled **Combinado**
- Merges/scores/ranks alternatives from Mapbox + GraphHopper + Valhalla (`DirectionsManager.calculateHybridDirections` / `getRouteScore`)
- OpenRouteService was already removed from the hybrid list (commented out) — likely for quota (ORS free tier is tight: ~2000 req/day)
- Of the remaining three: GraphHopper free tier is the most metered; Mapbox Directions is generous; Valhalla hits a shared public OSM instance

**Recommendation:** leave hybrid default as-is. If GraphHopper specifically becomes a problem, drop it from the hybrid list (same pattern as ORS), don't kill hybrid UX.

### `DISABLE_LOCAL_STORAGE = true`

In `src/config/constants.js`. Been `true` since early commit `07947d7`, with no comment or later toggle explaining why.

Important detail: the **write** path is not gated — `Storage.save()` always writes `{ geoJson, updatedAt }` to IndexedDB. Only the **read** path in `Storage.load()` skips IndexedDB and goes straight to Firestore.

So the cache is wired and kept warm; something long ago just stopped using it on load.

Freshness (`App.isDataFresh()`, 30-day max age) runs the same whether data came from IndexedDB or Firestore. Locally cached entries lack `lengths`, but `App.updateData()` already recomputes lengths client-side when missing (CPU only, no extra network).

**Recommendation:** likely safe to re-enable (`false`). Ship to preview first and watch for regressions. Most probable original reason was “always freshest data while iterating,” not a known bug — but a forgotten reason can’t be fully ruled out.

---

## Proposed changes

| #   | Change                                                                                                                                                          | File(s)                                              | Risk                                                              | Impact                                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Overpass: try servers sequentially (fallback on failure/timeout) instead of racing all 3 in parallel every time                                                 | `OSMController.getData`                              | Low — slightly slower on primary-server failure, same reliability | High — cuts Overpass calls ~3×→1× on the common path                                                   |
| 2   | Cache resolved Nominatim area IDs (per area name, in-memory + localStorage, no TTL — relation IDs don’t change)                                                 | `OSMController.getAreaId`                            | Low                                                               | Medium — removes a Nominatim call on every background refresh / force-update for non-overridden cities |
| 3   | Mapbox reverse-geocode on pan: **disable entirely on mobile**, keep as-is on desktop                                                                            | `Map.js` `onMapMoveEnded`                            | Low                                                               | High on mobile — see "Round 2" section below; mobile got zero value from it                            |
| 4   | Re-enable local GeoJSON cache: set `DISABLE_LOCAL_STORAGE = false`                                                                                              | `config/constants.js`                                | Low–medium — recommend preview first                              | Very high — avoids full Firestore multi-doc read on every repeat city visit/switch                     |
| 5   | Directions hybrid mode                                                                                                                                          | `DirectionsPanel.js` / `DirectionsManager.js`        | N/A — leave as-is                                                 | If GraphHopper quotas bite later: drop GraphHopper from hybrid list only                               |
| 6   | Cache Airtable `Comments` table in-memory across Map remounts (theme toggle currently re-fetches it every time); invalidate only after a new comment is created | `AirtableDatabase.js` / `Map.js` `initCommentsLayer` | Low                                                               | Medium-high — removes a full (possibly paginated) Airtable table read on every light/dark theme toggle |

### Recommended scope

Implement **1–4 and 6**. Leave hybrid default unchanged; note GraphHopper as the specific quota-risk provider inside hybrid if that ever becomes a problem.

---

## Details for items 1–3 (safe / low-risk)

### 1. Overpass sequential fallback

Today `OSMController.getData()` fires the same query to all entries in `OVERPASS_SERVERS` at once and aborts losers when one wins. That is 3× traffic against free public mirrors on every city load/refresh.

Preferred behavior: try the first server; only fall back to the next on failure, empty result, or timeout.

### 2. Nominatim area-ID cache

`getAreaId()` hits Nominatim `/search` for any city not in `AREA_ID_OVERRIDES`, including silent background refreshes and force-updates. OSM relation IDs for a city essentially never change.

Cache key: normalized area name. Storage: in-memory Map + `localStorage` (or reuse IndexedDB if preferred). No TTL needed; optional manual invalidation later if needed.

### 3. Mapbox reverse-geocode — mobile skip only

`Map.onMapMoveEnded` (600ms debounce) reverse-geocodes when zoom is above `MAP_AUTOCHANGE_AREA_ZOOM_THRESHOLD`. Implemented: return early when `IS_MOBILE`, before ever calling `reverseGeocode()`. Desktop behavior unchanged.

A distance-threshold guard on desktop (skip if center hasn't moved far enough since the last geocode) was considered and briefly implemented, then reverted as unnecessary — the debounce already limits this to once per pan/zoom pause, and the real volume driver turned out to be the geolocate control fix below, not ordinary panning.

### 6. Airtable Comments cache

See "Round 2" section below.

---

## Round 2 investigation (per feedback)

### Mapbox reverse-geocode-on-pan: who actually needs it?

Traced every consumer of `state.area` (the thing this geocode call feeds):

- **Desktop top bar** (`TopBar.js`): shows the live `{city}, {state}` label in the "city-picker" button. This is the real reason continuous live geocoding exists, and it's visible regardless of whether the analytics sidebar is open.
- **Mobile top bar**: shows a static "Buscar cidade ou endereço" placeholder instead (`TopBar.js:183-189`). `city`/`state` are only used inside an `aria-label`, never rendered.
- **`AnalyticsSidebar`**: desktop-only — never rendered on mobile (`AppLayout.js:111`, `{!IS_MOBILE && ...}`). Uses `location` purely as a display label + download filename; doesn't drive any fetch itself.
- **Routing coverage stat**: uses `state.area` only for the optional "% covered by cycling infra" overlay via `ensureCityDataLoaded()` — not for the route geometry itself (that comes straight from the directions API response).

**Conclusion:** on mobile, the continuous `moveend` → Mapbox reverse-geocode call has no visible payoff today — nothing on mobile displays the live-tracked area. On desktop it's real (the always-visible city label), so gating it behind "sidebar open" would make that label go stale most of the time (sidebar defaults closed).

**Done:** skip the geocode call path entirely when `IS_MOBILE`; desktop behavior left unchanged (see note in item 3 above about the distance-guard being tried and reverted).

### Airtable: why 2 calls on every init, and worse

- Call 1: `App.componentDidMount` → `loadAirtableMetadata()` → `Metadata` table. Fires once per app lifetime — fine as-is.
- Call 2: `Map.initLayers()` → `initCommentsLayer()` (gated by `ENABLE_COMMENTS`, currently `true`) → `Comments` table.

Found a worse pattern while digging into call 2: it **re-fires on every Map remount**, and the only thing that triggers a full remount is `toggleTheme()` (`App.js:348` → `forceMapReinitialization()` bumps `mapKey`). So **every light/dark toggle re-fetches the entire Comments table from Airtable**, with no caching — `fetchTable()` paginates in ~100-row pages, so a Comments table over 100 rows means multiple raw HTTP calls per single fetch, times however many theme toggles happen in a session.

Bonus inefficiency: comment pins only render once zoom passes `COMMENTS_ZOOM_THRESHOLD` (13), while default zoom is 12 — so the very first load fetches data nobody can see yet. Not proposing to fix this one now (adds complexity for less payoff than the caching fix), flagging for awareness.

**Plan:** cache `getComments()` result in-memory (module-level, keyed by nothing — it's a single global table), reuse it across Map remounts, invalidate only via the existing explicit re-fetch in `afterCommentCreate()`.

### Geolocate control: reverse-geocode fired on every GPS fix (found + fixed)

Separate from `onMapMoveEnded`, `Map.initMapControls()` wires a Mapbox `GeolocateControl` with `geolocate.on('geolocate', ...)`. With `trackUserLocation: true` (mobile only) + `followUserLocation: true` + `enableHighAccuracy: true`, this event fires on **every GPS position update** from `watchPosition` — potentially multiple times per second while moving — and the handler called `reverseGeocode()` unconditionally on every single one, completely bypassing the mobile-skip/distance-guard logic above (different call site entirely).

Worse: the geocode result was already dead code — `syncMapState(geocodeResult.place_name)` was commented out, and both `syncMapState()` (called with no args) and `setRealisticLighting()` (uses `this.props.lat/lng`, not the geocode result) don't need it. So the call was 100% wasted network traffic with no functional purpose.

**Fixed:** removed the `reverseGeocode()` wrapper entirely in `Map.js`'s `geolocate` handler; `syncMapState()` and `setRealisticLighting()` now run synchronously without any network call. This eliminates what was likely the single largest source of Mapbox Geocoding quota burn — a user leaving live location tracking on during a walk/ride could have generated hundreds of calls in one session for a result nobody used.

### Mobile-first note

Given mobile traffic share is trending up, items 3 (mobile geocode removal) and 6 (Airtable comments caching, benefits both platforms) are the two highest-leverage mobile-specific wins found so far.

---

## Out of scope / not recommended right now

- Changing hybrid default away from Combinado
- Disabling Google Places warm-up / autocomplete (user-driven; already necessary for search UX)
- Changing Airtable metadata load-on-mount (one read per session; low impact)
- Re-adding OpenRouteService to hybrid
