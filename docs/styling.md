# Styling convention

**Default: Tailwind + Ant Design. Custom CSS is the exception.**

- **Tailwind 3.4** for layout and utilities (`flex`, `gap-2`, `px-5`, `text-xs`, `rounded-full`, `animate-pulse`, …). Built via PostCSS in `src/styles/theme-tailwind-overrides.css` (purged; see `tailwind.config.js`, including `safelist` for MapPopups HTML strings). Extra utilities not in the default theme live in `App.less` (e.g. `text-xxs`, `animate-pulse-2x`).
- **Ant Design** for widgets: `Button`, `Dropdown`, `Skeleton`, `Tag`, `Tooltip`, `Modal`, `Input`, … Theme is `ConfigProvider` in `src/config/antdTheme.js` via `AntdAppShell` (`antd/locale/pt_BR`, `dayjs` `pt-br`). `antd/dist/reset.css` is imported in `App.js`. Production builds use `babel-plugin-import` for `antd/es/*` (disabled under Jest).

Do **not** add a new CSS file or a new `cm-*` BEM block for a row, badge, footer, skeleton, or similar. If AboutModal can pulse a placeholder with Tailwind classes, do that (or use `Skeleton`). Look at nearby JSX `className`s before opening a stylesheet.

## Tailwind 3.4, not 4

Pinned at `tailwindcss@3.4.17`. Setup is the v3 one: `tailwind.config.js`, PostCSS `tailwindcss: {}`, and `@tailwind base/components/utilities` in `theme-tailwind-overrides.css`.

Current Tailwind docs are v4. Do not copy that API into this repo:

- No `@import "tailwindcss"`, `@theme`, `@utility`, or CSS-first config
- No v4-only utilities (`bg-linear-to-*`, `rounded-4xl`, `shadow-xs`, …)
- Opacity is the split utilities this overlay CSS already targets: `bg-white bg-opacity-10`, `border-opacity-25`, not `bg-white/10`
- Flex shorthand in this codebase is usually `flex-shrink-0` / `w-4 h-4`, matching the safelist. `shrink-0` and `size-4` exist in 3.4; prefer the name already used in the file you are editing

If a class is not already used nearby, check the **v3.4** docs or `tailwind.config.js`. If it only exists in v4, don't use it.

jsdom also cannot parse some generated selectors during `getByRole`. Skip arbitrary values (`max-h-[60vh]`) and odd fractions (`-my-1.5`) on elements tests query; use the integer scale or a `style` prop. See [testing.md](testing.md).

## When custom CSS is actually warranted

- Fighting Ant specificity (glass buttons, dropdown item layout) after Tailwind/antd props failed
- Theme tokens or light/dark that utilities cannot express cleanly (`body.theme-dark` / `body.theme-light`)
- Map/popup HTML strings, Mapbox, or other non-React styling
- Global/base in `App.less` (focus, loader, gradient)

We do **not** use CSS modules. If you write CSS, put it in the existing stylesheet next to that component (or `src/styles/`), not a new file for a handful of rules.

## If you must write CSS: BEM with `cm-`

Prefix **`cm-`** (CicloMapa) so classes don’t clash with Tailwind or Ant.

- **Block**: standalone component (e.g. `cm-panel`). One block per component.
- **Element**: `block__element` (e.g. `cm-panel__header`).
- **Modifier**: `block--modifier` or `block__element--modifier`.

**Style ownership**: classes under a block belong to that component; don’t restyle another component’s BEM block. Existing files like `DirectionsPanel.css` are legacy skins, not a pattern to copy for new UI.

## Theming

Theme is **`body.theme-dark`** / **`body.theme-light`**. Prefer design tokens (CSS custom properties) and theme-scoped selectors instead of repeating `.theme-dark` everywhere. Tokens live in `src/config/design-tokens.js` and are injected on `:root`.

### Tokens derived from layer config

Map + UI colors stay aligned by deriving some values from `src/config/layers.v2.json` (and related map constants). When a layer’s semantic color changes, legend/badges/route UI and Mapbox paint can stay consistent.

## Accessibility

- **Design tokens and colors**: UI colors (backgrounds, text, borders, focus ring) are defined in `src/config/design-tokens.js` and exposed as CSS custom properties. Using tokens for text and background pairs makes it easier to reason about and audit contrast: change a token once and all consumers update.
- **Contrast**: Text/background pairs should meet WCAG contrast requirements (e.g. 4.5:1 for normal text, 3:1 for large text). Contrast is not automatically checked in this repo; validate manually (e.g. browser DevTools or tools like WebAIM Contrast Checker) or add a script/CI check in the future. Theme-scoped tokens (e.g. `.theme-dark`, `.theme-light`) should be checked for both themes.
- **Reduced motion**: Transitions and animations are gated by `@media (prefers-reduced-motion: reduce)` in `App.less` and component CSS (e.g. TopBar, MapPopups, DirectionsPanel) so users who prefer reduced motion see minimal or no motion.
- **Optional: prefers-contrast**: If the team commits to supporting high-contrast users, add overrides under `@media (prefers-contrast: more)` (e.g. stronger borders, higher contrast text/background pairs) using tokens where possible.
