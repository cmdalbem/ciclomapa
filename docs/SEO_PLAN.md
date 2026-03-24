# CicloMapa — SEO & URL strategy plan

**Purpose:** Single reference for humans and AI agents working on discoverability, URLs, and meta tags. Update this file when phases ship or decisions change.

**Production domain (current convention in repo):** `https://ciclomapa.app`

---

## Visual snapshot

**Legend:** `✅ done` · `🟡 in progress` · `⚪ not started` · `🧭 decision needed`

| Phase                           | Progress          | Status |
| ------------------------------- | ----------------- | ------ |
| Phase 1 — Static baseline       | `██████████` 100% | ✅     |
| Phase 2 — Dynamic meta          | `██████████` 100% | ✅     |
| Phase 3 — URLs + crawlability   | `██████░░░░` ~60% | 🟡     |
| Phase 4 — Prerender/SSR         | `░░░░░░░░░░` 0%   | ⚪     |
| Phase 5 — Measurement/authority | `███░░░░░░░` ~30% | 🟡     |
| Phase 6 — Perf/CWV              | `░░░░░░░░░░` 0%   | ⚪     |

### Now / Next / Later

| Now (active)                                                     | Next (queued)                                                   | Later                                           |
| ---------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| Finalize unknown-slug indexing policy (`404` vs `200 + noindex`) | Add visible city SEO section (H1 + paragraph + bullets + links) | Prerender/SSR for `/` + top city pages          |
| Keep canonical consistent for known slug routes                  | Generate sitemap from slug catalog as single source of truth    | CWV work (bundled CSS/fonts/third-party defers) |
| Verify canonical behavior in GSC URL Inspection                  | Add internal related-city links                                 | JSON-LD + backlink campaign                     |

---

## Current implementation status (high level)

| Area                                                                      | Status         | Notes                                                                                     |
| ------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------- |
| `/:city` and `/:city/routes` entry URLs + Nominatim resolution            | Shipped        | `src/index.js` routes, `src/App.js`                                                       |
| Slug route normalization + map-state params (`lat,lng,z`) kept in URL     | Shipped        | `normalizeCitySlugRouteIfNeeded`, `syncRouteSlugWithArea`, `updateURL`                    |
| Phase 1 — static head, `robots.txt`, minimal sitemap, manifest            | Shipped        | `public/index.html`, `public/robots.txt`, `public/sitemap.xml`                            |
| Phase 2 — dynamic `document.title` + `meta name=description`              | Shipped        | `src/utils/documentMeta.js`, called from `App.js`                                         |
| CI — `yarn format:check`, `CI=true` in workflow                           | Shipped        | `.github/workflows/ci.yml`                                                                |
| Phase 3 — governed slugs, stable canonicals, crawlable copy, rich sitemap | In progress    | Catalog + sitemap + canonical updates shipped; crawlable city copy/internal links pending |
| Phase 4 — prerender/SSR for key URLs                                      | Not started    |                                                                                           |
| Phase 5 — Search Console, backlinks, JSON-LD                              | Mostly process |                                                                                           |
| Phase 6 — perf (CWV): bundle Tailwind, fonts, etc.                        | Not started    |                                                                                           |

---

## Phase 1 — Static baseline (done)

- Absolute URLs for `canonical`, Open Graph, and Twitter Card (`https://ciclomapa.app/…`).
- `meta name="description"` (lowercase), aligned with product copy.
- `og:type`, `og:site_name`.
- `public/robots.txt` with `Allow: /` and sitemap URL.
- `public/sitemap.xml` — expanded beyond homepage (city URLs now included).
- `public/manifest.json` description aligned with meta.

**If the live site uses a different host:** update hardcoded URLs or generate them at build time.

---

## Phase 2 — Dynamic head without misleading social previews (done)

- `updateDocumentMeta(area)` sets:
  - **Title:** `{first segment of area} — CicloMapa` or default.
  - **Meta description:** city-specific template, truncated ≤ ~160 chars.
- **Open Graph / Twitter tags are updated in JS** together with title/description/canonical URL via `updateDocumentMeta`.

**Optional later:** per-city OG when canonical city URLs + prerender exist.

---

## Phase 3 — Stable URLs, catalog, crawlable content (detailed plan)

### Problem

The app now keeps slug URLs (`/:city` and `/:city/routes`) and appends `?lat=&lng=&z=` for shareable map state. Canonical is set dynamically to the slug URL when the route slug is in the governed catalog. Remaining SEO gap: limited crawlable city-specific HTML content (map is still canvas-heavy) and no explicit noindex/404 policy for unknown slugs.

### Goals

1. **Governed slug list** — known cities (or allowed slugs) with optional Nominatim query / display name overrides. **Current behavior:** known slugs are canonicalized; unknown slugs still resolve as open slugs for UX/shareability.
2. **One canonical policy** — either:
   - **Slug-only canonical** per city (e.g. `https://ciclomapa.app/sao-paulo-sp`), and optionally drop or narrow post-load replacement with `?lat=`; **or**
   - **Dedicated paths** e.g. `/cidade/:slug` with redirects from legacy `/:city`.
3. **Visible (or prerendered) copy** for supported cities: heading + short paragraph + bullets + OSM/contribute links — not only `sr-only` text.
4. **Dynamic `<link rel="canonical">`** in JS (e.g. extend `documentMeta.js`) when a governed city is active; default `https://ciclomapa.app/` when no city.
5. **`sitemap.xml`** generated or maintained from the **same catalog** as slugs (keep in sync with code).
6. **Parameter URL control** — keep `?lat=&lng=&z=` for shareability while preventing index bloat; internal links should prefer canonical slug URLs.
7. **Internal linking** — city pages should link to related/popular nearby cities and hub entry points with descriptive anchors.
8. **City page uniqueness standard** — avoid thin near-duplicate pages by requiring city-specific visible copy.

### Phase 3 checklist

- ✅ Known/alias slug normalization in routes
- ✅ Shareable map-state params preserved (`lat/lng/z`)
- ✅ Dynamic canonical for known catalog slugs
- ✅ Expanded city sitemap present
- 🟡 Unknown-slug indexing policy is still open (`404` vs `200 + noindex`)
- ⚪ Visible, crawlable city-specific copy block
- ⚪ Internal related-city linking module

### Indexing & canonical policy matrix

| URL pattern                         | Status | Indexing         | Canonical target                       | In sitemap |
| ----------------------------------- | ------ | ---------------- | -------------------------------------- | ---------- |
| `/`                                 | `200`  | `index,follow`   | self                                   | Yes        |
| `/:city` (known slug)               | `200`  | `index,follow`   | canonical known slug                   | Yes        |
| `/:city/routes` (if intended index) | `200`  | `index,follow`   | canonical known slug or self           | Optional   |
| `/:city?lat=&lng=&z=`               | `200`  | `index,follow`\* | canonical known slug (parameterless)   | No         |
| Unknown city slug                   | `200`  | `TBD`\*\*        | homepage (current JS fallback) or none | No         |
| Legacy city URL after migration     | `301`  | n/a              | destination URL                        | No         |

\* Until explicit `noindex` is implemented for parameterized states, enforce canonical consistently and avoid linking to parameterized URLs internally.

\*\* Decide and implement one policy: real `404` route state, or `200` + explicit `noindex`.

### Decision gate (required)

> **Choose one and enforce everywhere (router + head tags + sitemap + internal links):**
>
> - **Option A — strict SEO:** unknown slug -> real `404` route state
> - **Option B — UX-first:** unknown slug -> `200` with explicit `noindex`

**Current behavior:** open unknown slugs for UX/shareability.  
**Risk if left unresolved:** mixed crawl signals and soft-404 ambiguity.

### City page content standard

- Each indexable city page must have visible, crawlable text (not only `sr-only`).
- Minimum baseline:
  - H1 with city name
  - One city-specific paragraph (not generic boilerplate)
  - 3+ meaningful bullet points (network context, usage tips, known limits)
  - Source/contribution links (e.g. OSM mapping and local contribution path)
- Prefer including a "last updated" indicator to support freshness and editorial trust.

### Unknown slug handling policy

- **Status today:** unknown slugs may still resolve via Nominatim/open-slug behavior for UX and sharing.
- Target state: unknown slug should return a real `404` route state (not soft-404 content with `200`) **or** `200` with explicit `noindex` (choose one and enforce consistently).
- Do not set known-city canonical on unknown slug pages.
- If there are renamed slugs, use `301` from old slug to new slug with one-hop redirects only.

### Implementation touchpoints

| Concern                         | Likely files                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routes                          | `src/index.js`                                                                                                                                    |
| Slug validation / catalog       | `src/config/citySlugCatalog.js` (or equivalent)                                                                                                   |
| Resolution / URL writes         | `src/App.js` (`getCitySlugFromRoute`, `normalizeCitySlugRouteIfNeeded`, `syncRouteSlugWithArea`, `resolveCitySlugToAreaAndViewport`, `updateURL`) |
| Title / description / canonical | `src/utils/documentMeta.js`                                                                                                                       |
| On-page SEO block               | `src/AppLayout.js` or new `CitySeoSection`                                                                                                        |
| Sitemap                         | `public/sitemap.xml` or build script                                                                                                              |
| Server                          | SPA fallback for all app routes; optional HTTP redirects                                                                                          |

### Suggested order of work

1. Introduce catalog + validate `:city` param.
2. Decide unknown-slug indexing policy (`404` vs `200 + noindex`) and implement consistently.
3. Add visible SEO section + `documentMeta` canonical updates.
4. Expand sitemap from catalog.
5. Add internal links (related/popular cities) from city pages and homepage/hub areas.
6. Verify in Google Search Console (URL inspection on 2–3 city URLs).

### Internal linking policy

- Homepage should link to top-priority city pages with descriptive anchors.
- City pages should include a small related-cities module.
- Avoid repetitive exact-match anchor spam; vary naturally while staying descriptive.
- All internal links should point to canonical URLs, not parameter map states.

---

## Phase 4 — Prerender / SSR (optional)

- For `/` and city routes only, serve HTML that already contains title, description, and main text.
- Options: static export, edge prerender, or small SSR service — choose what fits hosting budget.

---

## Phase 5 — Measurement & authority

- Google Search Console + Bing Webmaster on canonical domain; submit sitemap.
- `WebApplication` / `Organization` JSON-LD on home if copy matches visible content.
- Backlinks: partners (e.g. UCB, NGOs), OSM community, municipalities, research.

### Monitoring cadence

- **Weekly (first 4–6 weeks after major URL changes):**
  - Coverage issues (soft 404, duplicate without user-selected canonical, blocked crawls)
  - Indexing status for a sample of top city URLs
  - Redirect and canonical validation for migrated slugs
- **Monthly (steady state):**
  - Clicks/impressions trend by city landing pages
  - Index count vs sitemap count
  - Query clusters for non-branded local intent
  - Top losing pages/queries and remediation actions

### KPI suggestions

- Indexed supported city URLs / total supported city URLs
- Non-branded organic clicks to city pages
- CTR on city landing pages
- Share of parameterized URLs receiving impressions (should trend toward zero)
- Count of coverage warnings (soft 404 + duplicate canonical conflicts)

---

## Phase 6 — Performance (indirect SEO)

- Replace production Tailwind from CDN with bundled CSS where possible.
- Font subsetting / self-host.
- Lazy-load non-critical third parties.
- Set measurable CWV targets for `/` and top city URLs (mobile-first).

---

## Commands (for agents)

```bash
yarn format:check   # must pass in CI
yarn lint
yarn typecheck
CI=true yarn test --watchAll=false
```

---

## Changelog

| Date       | Change                                                                                                                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-03-24 | Updated plan to match shipped slug/canonical behavior (slug paths retained with shareable `lat/lng/z`, dynamic OG/Twitter updates, canonical normalization of known aliases, and open unknown-slug behavior marked as pending policy decision). |

---

## Trade-offs (keep in mind)

- **Slug catch-all** vs **catalog**: open slugs are flexible but bad for SEO and abuse; catalog requires maintenance.
- **Coordinate URLs** vs **slug canonical**: without a single rule, duplicate URLs dilute signals.
- **Client-only meta**: better than nothing; **prerender** still helps competitive city queries.
- **Per-city OG**: easy to get wrong; defer until URLs and copy are stable.
- **Strict 404 policy**: cleaner index but may reduce tolerance for typos unless UX provides clear recovery links.
- **Uniqueness requirements**: improves quality signals but increases editorial/content operations workload.
