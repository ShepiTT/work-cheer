# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Reference and supported editions
- The user supplied https://github.com/WizzenH/xindong as a reference on 2026-11-03. Borrow its monthly salary/workday calendar, optional color palettes, and desktop tray/opacity ideas while preserving the original screenshot card as the default appearance.
- Keep existing saved records compatible and maintain both the hosted website and offline Windows desktop edition.
- Retain xindong MIT attribution for adapted theme tokens and reference implementation concepts.
- User confirmed on 2026-11-03: follow official China mainland holiday and makeup workday arrangements automatically, with per-date manual company overrides taking priority. Keep year coverage explicit; never infer unpublished annual schedules. This remains a work-progress estimate, not payroll settlement.

## Visual design (user decisions of 2026-11-05)
- The user asked for a redesign in the designer's own taste, then clarified: a 主题 must be a different *style* (layout, shape, material), each with its own colours, following Apple's design language. Colour-only themes are not enough.
- Look = 主题 × 颜色 × 外观. 主题: 玻璃 (default; frosted glass sheet over a wallpaper painted from the colour), 小组件 (iOS home-screen widgets grid with Activity-style rings), 纸墨 (warm paper and ink, the 1.5 design). 颜色: Apple's eight accents (蓝 紫 粉 红 橙 黄 绿 石墨); 纸墨 renders them as mineral pigments. 外观: 浅色 / 深色 / 自动. Default 玻璃 · 蓝 · 自动.
- Settings fields `theme` (style id), `themeColor`, `appearance`. `normalizeLook` upgrades every older value (1.x palettes and 1.5 palettes become 纸墨 in the nearest colour; untouched defaults become the new default); never drop that map.
- One markup for all 主题; layout differences are CSS under `[data-style=…]`. Tokens are attribute-scoped in `src/themes.css` so previews can carry their own `data-style/data-color/data-scheme`. Keep button labels and text ≥ 4.5:1 (see `--accent-button`, `--accent-text`, `--on-accent`).
- Rules: one hero figure (today's income); accent marks only what is live (status dot, hour cells, rings, goal track); labels and values use text tokens.
- Keep these hooks for the desktop floating widget: `.income-value` (plain number text), `.countdown > span` ×3, `.status.<state>`, the first `[role="progressbar"]` with `aria-valuenow`, `.settings-button`.
- The embedded font is a subset; after adding UI text run `python scripts/subset-font.py` (uses the OFL Noto Sans SC that Windows ships).
- QA: `qa.html?theme=<style>&color=<id>&appearance=<light|dark>&at=<ISO>&settings=<json>` (frozen clock, in-memory storage) and `qa-themes.html?color=<id>` (every 主题, light and dark).
- Deliveries: keep only the newest version's files in the user's folder; old versions go to the Recycle Bin, not kept side by side.
- `window.workCheerWindow` exists only in the Windows app (frameless window): `App.jsx` then draws `WindowBar` and makes the empty page background a window drag region. The website and offline page never show it; `qa.html?desktop=1` stubs it for checks.
