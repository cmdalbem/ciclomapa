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
| Phase 3 — URLs + crawlability   | `█████░░░░░` ~55% | 🟡     |
| Phase 4 — Prerender/SSR         | `░░░░░░░░░░` 0%   | ⚪     |
| Phase 5 — Measurement/authority | `██░░░░░░░░` ~20% | 🟡     |
| Phase 6 — Perf/CWV              | `░░░░░░░░░░` 0%   | ⚪     |

### Now / Next / Later

| Now (active)                                                     | Next (queued)                                                      | Later                                           |
| ---------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| Finalize unknown-slug indexing policy (`404` vs `200 + noindex`) | Generate `sitemap.xml` from slug catalog (single source of truth)  | Prerender/SSR for `/` + top city pages          |
| Keep canonical consistent for known slug routes                  | More internal links (e.g. homepage hub with `<a href>` top cities) | CWV work (bundled CSS/fonts/third-party defers) |
| Verify canonical behavior in GSC URL Inspection                  | —                                                                  | JSON-LD + backlink campaign                     |

---

## Current implementation status (high level)

| Area                                                                       | Status         | Notes                                                                                                                                    |
| -------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `/:city` and `/:city/routes` entry URLs + slug fast-path for mapped cities | Shipped        | Static catalog metadata skips runtime Nominatim for mapped slugs in `src/App.js`                                                         |
| Slug route normalization + map-state params (`lat,lng,z`) kept in URL      | Shipped        | `normalizeCitySlugRouteIfNeeded`, `syncRouteSlugWithArea`, `updateURL`                                                                   |
| Phase 1 — static head, `robots.txt`, minimal sitemap, manifest             | Shipped        | `public/index.html`, `public/robots.txt`, `public/sitemap.xml`                                                                           |
| Phase 2 — dynamic `document.title` + `meta name=description`               | Shipped        | `src/utils/documentMeta.js`, called from `App.js`                                                                                        |
| CI — `yarn format:check`, `CI=true` in workflow                            | Shipped        | `.github/workflows/ci.yml`                                                                                                               |
| Phase 3 — governed slugs, stable canonicals, crawlable copy, rich sitemap  | In progress    | Canonical is stable for catalog slugs; unknown slugs still resolve for UX; no explicit `noindex`/404 yet; sitemap can drift from catalog |
| Phase 4 — prerender/SSR for key URLs                                       | Not started    |                                                                                                                                          |
| Phase 5 — Search Console, backlinks, JSON-LD                               | Mostly process |                                                                                                                                          |
| Phase 6 — perf (CWV): bundle Tailwind, fonts, etc.                         | Not started    |                                                                                                                                          |

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

Note: this is now equally important for “AI search”/LLM discovery. Many AI agents ingest raw HTML (or a simplified “reader” view) and extract short snippets; they benefit from stable canonicals, fewer duplicate URL variants, and visible, quotable text blocks with clear sources.

### Goals

1. **Governed slug list** — known cities (or allowed slugs) with optional Nominatim query / display name overrides. **Current behavior:** known slugs are canonicalized; unknown slugs still resolve as open slugs for UX/shareability.
2. **One canonical policy** — either:

- **Slug-only canonical** per city (e.g. `https://ciclomapa.app/sao-paulo-sp`), and optionally drop or narrow post-load replacement with `?lat=`; **or**
- **Dedicated paths** e.g. `/cidade/:slug` with redirects from legacy `/:city`.

3. **Visible (or prerendered) copy** for supported cities: heading + short paragraph + bullets + OSM/contribute links — not only `sr-only` text.
   - This also powers LLM answers: add a small “TL;DR” paragraph and 3–6 bullet points that can be quoted without the map UI.
4. **Dynamic `<link rel="canonical">`** in JS (e.g. extend `documentMeta.js`) when a governed city is active; default `https://ciclomapa.app/` when no city.
   - Canonical stability helps both classic indexing and LLM citation consistency (fewer URL variants for the same “city page”).
5. `**sitemap.xml**` generated or maintained from the **same catalog** as slugs (keep in sync with code).
   - Helps crawlers and AI agents discover the right entry URLs without guessing.
6. **Parameter URL control** — keep `?lat=&lng=&z=` for shareability while preventing index bloat; internal links should prefer canonical slug URLs.
7. **Internal linking** — city pages should link to related/popular nearby cities and hub entry points with descriptive anchors.
   - Internal links also serve as “navigation hints” for AI agents crawling the site.
8. **City page uniqueness standard** — avoid thin near-duplicate pages by requiring city-specific visible copy.
   - For LLMs, uniqueness reduces hallucinated “same-page” summaries across different cities.

### Phase 3 checklist

- ✅ Known/alias slug normalization in routes
- ✅ Shareable map-state params preserved (`lat/lng/z`)
- ✅ Dynamic canonical for known catalog slugs
- ✅ Expanded city sitemap present
- 🟡 Unknown-slug indexing policy is still open (`404` vs `200 + noindex`) and **not implemented yet** (no `noindex` tag or 404 route state in code)
- 🟡 `sitemap.xml` is still hand-maintained and **can drift** from the governed catalog (URLs in sitemap may not exist in `citySlugCatalog.js`)
- 🟡 Visible city-specific copy in **Sobre** drawer (`AboutModal` + `cityAboutContext.js`) for catalog slug URLs; modal auto-opens once per city for most users (better for humans), but it’s still JS-driven and may not be seen by crawlers/AI fetchers that don’t execute the app (consider prerender or an always-on city “SEO block”)
- ⚪ Add a small, consistent “quotable” block per city (TL;DR + bullets + “Sources” links) rendered as plain HTML on the city route
- ⚪ Add at least one compact Q&A/FAQ-style snippet per city page (even 2–3 Q&As) for extractability
- 🟡 Internal related-city links (on-page `<Link>` strip + city picker; homepage hub links still optional)

### Indexing & canonical policy matrix

| URL pattern                         | Status | Indexing       | Canonical target                     | In sitemap |
| ----------------------------------- | ------ | -------------- | ------------------------------------ | ---------- |
| `/`                                 | `200`  | `index,follow` | self                                 | Yes        |
| `/:city` (known slug)               | `200`  | `index,follow` | canonical known slug                 | Yes        |
| `/:city/routes` (if intended index) | `200`  | `index,follow` | canonical known slug or self         | Optional   |
| `/:city?lat=&lng=&z=`               | `200`  | `index,follow` | canonical known slug (parameterless) | No         |
| Unknown city slug                   | `200`  | `TBD`          | homepage (current JS fallback)       | No         |
| Legacy city URL after migration     | `301`  | n/a            | destination URL                      | No         |

Until explicit `noindex` is implemented for parameterized states, enforce canonical consistently and avoid linking to parameterized URLs internally.

Decide and implement one policy: real `404` route state, or `200` + explicit `noindex`.

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
| On-page SEO block               | `src/AboutModal.js` (city block) · `src/cityAboutContext.js`                                                                                      |
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
  - This is also the biggest “AI discovery” unlock: many LLM tools don’t execute complex client-side apps and will only see what’s present in initial HTML.

---

## Phase 5 — Measurement & authority

- ✅ Google Search Console is verified on the canonical domain; submit sitemap and monitor coverage.
- `WebApplication` / `Organization` JSON-LD on home if copy matches visible content.
- Backlinks: partners (e.g. UCB, NGOs), OSM community, municipalities, research.

Additional discovery channels to consider:

- Track “AI referrals” in analytics where possible (traffic from known AI assistants/browsers) and monitor what URLs they land on (often city slugs).
- Add `public/llms.txt` (lightweight, plain-text) pointing to canonical URLs, sitemap, and data/source pages. Keep it conservative and aligned with visible content.

### SEO testing checklist (summary)

#### During development

- Validate on local city URLs (e.g. `http://localhost:3002/sao-paulo`) and after SPA navigation:
  - `title`, `meta description`, `canonical`, `og:url/title/description`, `twitter:title/description`
- Use Chrome tooling for fast checks:
  - **SEO Meta in 1 Click** or **Meta SEO Inspector** for quick tag validation
  - **Detailed SEO Extension** for broader audits
  - **OpenLink Structured Data Sniffer** if JSON-LD/schema is present
  - **Lighthouse** for baseline SEO/performance checks
- Keep sitemap and catalog consistent whenever slugs change:
  - canonical slugs in sitemap, aliases excluded as canonical entries
  - validate XML with:

```bash
xmllint --noout public/sitemap.xml
```

#### Before release

- Preview metadata/rich results with a public URL (production or tunnel):
  - Google Rich Results Test
  - Schema Markup Validator
  - Facebook Sharing Debugger
  - Twitter Card Validator
- Confirm:
  - home and key city pages have correct canonical + descriptions
  - unknown slug policy is enforced (`404` or `200 + noindex`)
  - internal links point to canonical slug URLs (not parameterized map states)
  - `robots.txt` and `sitemap.xml` are reachable on production host

#### After release (production truth)

- Run Google Search Console URL Inspection on changed city pages:
  - verify rendered page + selected canonical
  - request indexing for important updates
- Track weekly after URL changes, then monthly in steady state:
  - coverage errors (soft 404 / canonical conflicts)
  - indexed URL count vs sitemap
  - impressions/clicks/CTR for city landing pages

#### Common failure modes to watch

- SPA updates tags in browser but Google chooses different canonical
- sitemap and slug catalog drift out of sync
- aliases/parameter URLs creating duplicate URL signals

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

**Repo state note (2026-04-01):** `public/index.html` currently loads Tailwind via CDN and Google Fonts, so Phase 6 work is still pending.

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
| 2026-03-29 | Merged city SEO into About drawer: on `/` the modal stays the classic intro; on catalog `/:city` it opens with a city hero, bullets, related-city chips, then the same global about + partners. Floating `CitySeoSection` removed.              |
| 2026-03-24 | Updated plan to match shipped slug/canonical behavior (slug paths retained with shareable `lat/lng/z`, dynamic OG/Twitter updates, canonical normalization of known aliases, and open unknown-slug behavior marked as pending policy decision). |

---

## Trade-offs (keep in mind)

- **Slug catch-all** vs **catalog**: open slugs are flexible but bad for SEO and abuse; catalog requires maintenance.
- **Coordinate URLs** vs **slug canonical**: without a single rule, duplicate URLs dilute signals.
- **Client-only meta**: better than nothing; **prerender** still helps competitive city queries.
- **Per-city OG**: easy to get wrong; defer until URLs and copy are stable.
- **Strict 404 policy**: cleaner index but may reduce tolerance for typos unless UX provides clear recovery links.
- **Uniqueness requirements**: improves quality signals but increases editorial/content operations workload.
