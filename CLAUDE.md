# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# This is NOT the Next.js you know

This version (Next.js 16.2.4, React 19.2.4) has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

## Commands

- `npm run dev` — start dev server (http://localhost:3000)
- `npm run build` — production build
- `npm run start` — serve production build
- `npm run lint` — ESLint (flat config in [eslint.config.mjs](eslint.config.mjs), extends `eslint-config-next/core-web-vitals` + `/typescript`)

No test runner is configured.

## Architecture

Single-page portfolio with **two coexistent UI modes** that animate in/out together — both are always mounted, visibility is driven by `translateX` on wrapper motion divs.

- [src/app/page.tsx](src/app/page.tsx) — the entire UI (~4,100 lines, `"use client"`). Root component `DualPreview` owns:
  - `mode: "paper" | "terminal"` (persisted to `localStorage` under `ouss-portfolio-dual-mode`)
  - A `TransitionOverlay` that runs a scanline/flash between modes
  - A global `keydown` handler implementing vim-style nav (`h`/`l` for workspaces 1–6, `j`/`k` to scroll, `gg`/`G`, `:` or `i` to open the Quake shell, `?` for help, `` ` `` to toggle modes, `Esc` to back out)
  - **Paper mode** — brutalist-mono, photo-led editorial aesthetic; `paper` palette (off-white `#ECEBE4` / near-black ink / one green accent `#1FBF54`); sections rendered by `TopBar`, `Hero` (B&W portrait centerpiece), `Works`, `Exp`, `About`, `Studies`, `Contact`, `Footer`. No scroll-driven motion — one staggered hero load-in + hover micro-interactions only.
  - **Terminal mode** — Catppuccin Mocha + i3-style workspaces, `Terminal*` components per workspace, an in-page `QuakeShell` with a `dispatch()` command router (`cmdHelp`, `cmdLs`, `cmdCd`, `cmdCat`, `cmdWhich`, …)
- [src/lib/portfolio.ts](src/lib/portfolio.ts) — all content data (`profile`, `projects`, `experience`, `testimonials`, `education`, `values`, `sections`). Edit copy here, not in page.tsx.
- [src/app/layout.tsx](src/app/layout.tsx) — root layout, metadata, OG/Twitter tags. Site URL is `https://oussamabenberkane.com`.
- [src/app/globals.css](src/app/globals.css) — Tailwind v4 (`@import "tailwindcss"`) + a global `prefers-reduced-motion` safety net that overrides animations.

## Conventions

- Path alias `@/*` → `./src/*` (see [tsconfig.json](tsconfig.json)). TypeScript `strict: true`.
- Fonts are loaded via `next/font/google` inside [page.tsx](src/app/page.tsx) (Bricolage Grotesque / Inter / JetBrains Mono) and exposed as CSS variables `--p-display` / `--p-body` / `--p-mono`.
- Animations use `framer-motion`; always read `useReducedMotion()` and provide a shorter fallback (existing code uses ~180ms reduced vs ~720ms full).
- Both modes share state lifted to `DualPreview` (workspace, shell, help) so the global keybindings work across modes.
