# Styling convention

CicloMapa uses **BEM (Block Element Modifier)** with the prefix **`cm-`** (CicloMapa) to avoid clashes with third-party and utility classes.

## Rules

- **Block**: standalone component (e.g. `cm-panel`, `cm-topbar`). Use a single class per block.
- **Element**: part of a block (e.g. `cm-panel__header`, `cm-panel__input`). Use `block__element`.
- **Modifier**: variant or state (e.g. `cm-panel--collapsed`, `cm-panel--dark`). Use `block--modifier` or `block__element--modifier`.

Use the `cm-` prefix for all BEM classes so they don’t conflict with Tailwind (used via CDN) or Ant Design.

**CSS strategy**: We do **not** use CSS modules. Component styles are global; each component has its own stylesheet (e.g. `DirectionsPanel.css`) or shares `src/styles/`. BEM with the `cm-` prefix avoids clashes. **Style ownership**: classes under a block (e.g. `.cm-panel`, `.cm-panel__header`) belong to that component; don’t reuse another component’s BEM block for new styles. For new components, add a new block (e.g. `cm-myfeature`) and keep styles in a dedicated CSS file next to the component.

## Theming

Theme (light/dark) is applied via a single wrapper: **`body.theme-dark`** / **`body.theme-light`**. Prefer design tokens (CSS custom properties) and theme-scoped selectors (e.g. `.theme-dark .cm-panel { ... }`) instead of repeating `.theme-dark` in many places. Tokens are defined in `src/config/design-tokens.js` and injected on `:root`.

### Tokens derived from `layers.json`

In addition to “pure” UI tokens (surfaces, text, focus, spacing), CicloMapa also keeps **map + UI colors aligned** by deriving/centralizing some values based on layer configuration in `src/config/layers.json` (and related map constants). This is intentional: when a layer’s semantic color changes, the legend/badges/route UI and Mapbox paint can stay consistent.

## Reference implementation

The **DirectionsPanel** is the pilot: `#directionsPanel` uses BEM-style classes under the `cm-panel` block where possible, and theme variables for colors. New components should follow the same pattern.

## Other styles

- **Tailwind**: Used for layout and utilities only (e.g. `flex`, `rounded-full`, `px-1`). Loaded via **CDN** in `public/index.html` (Tailwind v2: `unpkg.com/tailwindcss@^2/dist/tailwind.min.css`). Prefer BEM for component-specific, semantic styles. Note: `package-lock.json` may list Tailwind v3 as a transitive dependency—the app’s styles come from the CDN build (v2). To switch to build-time Tailwind, add PostCSS + a Tailwind config and remove the CDN link.
- **Ant Design**: Theme (`ConfigProvider`) in `src/config/antdTheme.js` via `AntdAppShell`; `antd/dist/reset.css` imported in `App.js` for baseline typography. Component-level CSS where needed.
- **Global/base**: `App.less` (with design tokens for focus, loader, gradient).

## Accessibility

- **Design tokens and colors**: UI colors (backgrounds, text, borders, focus ring) are defined in `src/config/design-tokens.js` and exposed as CSS custom properties. Using tokens for text and background pairs makes it easier to reason about and audit contrast: change a token once and all consumers update.
- **Contrast**: Text/background pairs should meet WCAG contrast requirements (e.g. 4.5:1 for normal text, 3:1 for large text). Contrast is not automatically checked in this repo; validate manually (e.g. browser DevTools or tools like WebAIM Contrast Checker) or add a script/CI check in the future. Theme-scoped tokens (e.g. `.theme-dark`, `.theme-light`) should be checked for both themes.
- **Reduced motion**: Transitions and animations are gated by `@media (prefers-reduced-motion: reduce)` in `App.less` and component CSS (e.g. TopBar, MapPopups, DirectionsPanel) so users who prefer reduced motion see minimal or no motion.
- **Optional: prefers-contrast**: If the team commits to supporting high-contrast users, add overrides under `@media (prefers-contrast: more)` (e.g. stronger borders, higher contrast text/background pairs) using tokens where possible.
