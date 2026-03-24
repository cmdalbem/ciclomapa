# CicloMapa — SEO & URL strategy plan

**Purpose:** Single reference for humans and AI agents working on discoverability, URLs, and meta tags. Update this file when phases ship or decisions change.

**Production domain (current convention in repo):** `https://ciclomapa.app`

---

## Current implementation status (high level)

| Area                                                                      | Status            | Notes                                                                             |
| ------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------- |
| `/:city` and `/:city/routes` entry URLs + Nominatim resolution            | Shipped           | `src/index.js` routes, `src/App.js`                                               |
| Post-load URL canonization (`/` or `/routes/` + `lat,lng,z`)              | Shipped           | `replaceCitySlugUrlWithLatLng`, `updateURL`                                       |
| Phase 1 — static head, `robots.txt`, minimal sitemap, manifest            | Shipped           | `public/index.html`, `public/robots.txt`, `public/sitemap.xml`                    |
| Phase 2 — dynamic `document.title` + `meta name=description`              | Shipped           | `src/utils/documentMeta.js`, called from `App.js`                                 |
| CI — `yarn format:check`, `CI=true` in workflow                           | Shipped           | `.github/workflows/ci.yml`                                                        |
| Phase 3 — governed slugs, stable canonicals, crawlable copy, rich sitemap | Planned / partial | May exist locally as `citySlugCatalog.js` + expanded sitemap; align with this doc |
| Phase 4 — prerender/SSR for key URLs                                      | Not started       |                                                                                   |
| Phase 5 — Search Console, backlinks, JSON-LD                              | Mostly process    |                                                                                   |
| Phase 6 — perf (CWV): bundle Tailwind, fonts, etc.                        | Not started       |                                                                                   |

---

## Phase 1 — Static baseline (done)

- Absolute URLs for `canonical`, Open Graph, and Twitter Card (`https://ciclomapa.app/…`).
- `meta name="description"` (lowercase), aligned with product copy.
- `og:type`, `og:site_name`.
- `public/robots.txt` with `Allow: /` and sitemap URL.
- `public/sitemap.xml` — started with homepage only; **expand in Phase 3** when city URLs are stable.
- `public/manifest.json` description aligned with meta.

**If the live site uses a different host:** update hardcoded URLs or generate them at build time.

---

## Phase 2 — Dynamic head without misleading social previews (done)

- `updateDocumentMeta(area)` sets:
  - **Title:** `{first segment of area} — CicloMapa` or default.
  - **Meta description:** city-specific template, truncated ≤ ~160 chars.
- **Open Graph / Twitter tags are not updated in JS** — they stay the homepage defaults from `index.html` so arbitrary `?lat=` shares do not show wrong city previews.

**Optional later:** per-city OG when canonical city URLs + prerender exist.

---

## Phase 3 — Stable URLs, catalog, crawlable content (detailed plan)

### Problem

The app currently **replaces** pretty `/:city` URLs with **`/?lat=&lng=&z=`** after resolution, while `index.html` declares **canonical `/`**. That is fine for short tabs but **weak for SEO**: no stable per-city URL for indexing, and little HTML text for crawlers (map is canvas-heavy).

### Goals

1. **Governed slug list** — known cities (or allowed slugs) with optional Nominatim query / display name overrides; unknown slugs → 404 or safe fallback (avoid abuse and infinite thin pages).
2. **One canonical policy** — either:
   - **Slug-only canonical** per city (e.g. `https://ciclomapa.app/sao-paulo-sp`), and optionally drop or narrow post-load replacement with `?lat=`; **or**
   - **Dedicated paths** e.g. `/cidade/:slug` with redirects from legacy `/:city`.
3. **Visible (or prerendered) copy** for supported cities: heading + short paragraph + bullets + OSM/contribute links — not only `sr-only` text.
4. **Dynamic `<link rel="canonical">`** in JS (e.g. extend `documentMeta.js`) when a governed city is active; default `https://ciclomapa.app/` when no city.
5. **`sitemap.xml`** generated or maintained from the **same catalog** as slugs (keep in sync with code).

### Implementation touchpoints

| Concern                         | Likely files                                                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Routes                          | `src/index.js`                                                                                                         |
| Slug validation / catalog       | `src/config/citySlugCatalog.js` (or equivalent)                                                                        |
| Resolution / URL writes         | `src/App.js` (`getCitySlugFromRoute`, `resolveCitySlugToAreaAndViewport`, `replaceCitySlugUrlWithLatLng`, `updateURL`) |
| Title / description / canonical | `src/utils/documentMeta.js`                                                                                            |
| On-page SEO block               | `src/AppLayout.js` or new `CitySeoSection`                                                                             |
| Sitemap                         | `public/sitemap.xml` or build script                                                                                   |
| Server                          | SPA fallback for all app routes; optional HTTP redirects                                                               |

### Suggested order of work

1. Introduce catalog + validate `:city` param.
2. Decide canonical URL shape; adjust `replaceCitySlugUrlWithLatLng` and `updateURL` accordingly.
3. Add visible SEO section + `documentMeta` canonical updates.
4. Expand sitemap from catalog.
5. Verify in Google Search Console (URL inspection on 2–3 city URLs).

---

## Phase 4 — Prerender / SSR (optional)

- For `/` and city routes only, serve HTML that already contains title, description, and main text.
- Options: static export, edge prerender, or small SSR service — choose what fits hosting budget.

---

## Phase 5 — Measurement & authority

- Google Search Console + Bing Webmaster on canonical domain; submit sitemap.
- `WebApplication` / `Organization` JSON-LD on home if copy matches visible content.
- Backlinks: partners (e.g. UCB, NGOs), OSM community, municipalities, research.

---

## Phase 6 — Performance (indirect SEO)

- Replace production Tailwind from CDN with bundled CSS where possible.
- Font subsetting / self-host.
- Lazy-load non-critical third parties.

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

| Date                             | Change |
| -------------------------------- | ------ |
| (add rows when merging SEO work) |        |

---

## Trade-offs (keep in mind)

- **Slug catch-all** vs **catalog**: open slugs are flexible but bad for SEO and abuse; catalog requires maintenance.
- **Coordinate URLs** vs **slug canonical**: without a single rule, duplicate URLs dilute signals.
- **Client-only meta**: better than nothing; **prerender** still helps competitive city queries.
- **Per-city OG**: easy to get wrong; defer until URLs and copy are stable.
