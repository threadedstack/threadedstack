---
name: "tdsk-website"
description: "Knowledge base for the marketing site and documentation portal"
tags: ["react", "vite", "mui", "mdx", "docs", "marketing", "shiki", "mermaid", "landing-page"]
---
# Website Repo Skill

## Overview

The **Website** repo (`repos/website`, `@tdsk/website`) is the public-facing marketing site and documentation portal for Threaded Stack. It provides:

- **Marketing Pages** — Landing, Features, Pricing, Use Cases with animated visuals and CTAs
- **Documentation Portal** — MDX-based docs loaded from the root `/docs` directory with sidebar navigation, table of contents, and code highlighting
- **Theming** — Dark/light mode via MUI + Emotion with Jotai persistence
- **SEO** — Page-level meta tags via react-helmet-async

**Key Characteristics:**
- **Type**: Public marketing site + docs portal
- **Package**: `@tdsk/website` v0.1.0 (private)
- **Runtime**: Vite 5 dev server on port 5884 (`TDSK_WEB_PORT`)
- **Path Aliases**: Uses `@TAF/*` prefix via `alias-hq` for internal imports
- **Styling**: MUI 6 + Emotion CSS-in-JS
- **Docs Source**: Root `/docs` directory (monorepo level, not in this repo)

## Directory Structure

```
repos/website/
├── configs/
│   ├── vite.config.ts            # Vite config entry (imports vite.workspace.ts)
│   ├── vite.workspace.ts         # Full Vite config: MDX, SWC, tsconfig-paths, SVGR, docs plugins
│   ├── website.config.ts         # Env loader (TDSK_* vars), port, aliases
│   ├── biome.json                # Biome linter/formatter
│   ├── remarkDocsLinks.ts        # Remark plugin: rewrites .md links to /docs/slug routes
│   └── vitePluginDocsAssets.ts   # Vite plugin: serves/copies doc images (dev middleware + build copy)
├── scripts/
│   ├── loadEnvs.ts               # Environment variable loader
│   ├── setupTests.ts             # Vitest setup (mocks for MUI, Neon Auth, API)
│   ├── registerPaths.ts          # TypeScript path alias registration
│   └── testUtils.tsx             # Test helper utilities
├── public/                       # Static assets
├── src/
│   ├── index.tsx                 # React bootstrap: StrictMode → App
│   ├── App.tsx                   # Root: HelmetProvider → ThemeProvider → GlobalStyles → RouterProvider
│   ├── router.tsx                # React Router v7: MarketingLayout + DocsLayout routes
│   ├── components/
│   │   ├── Docs/                 # DocsSidebar, DocsTableOfContents, DocsPrevNext, MDXComponents, ComingSoon, CodeBlock
│   │   ├── Header/               # Header (AppBar + nav), MobileMenu, ThemeToggle
│   │   ├── Footer/               # MarketingFooter, DocsFooter
│   │   ├── Landing/              # Hero, ArchitectureDiagram, Features, HowItWorks, CodePreview, Pricing, UseCases, CTABanner
│   │   └── Shared/               # PricingCard, PricingTierGrid, CalloutBox, SectionContainer, SectionHeader, FeatureCard, StepItem, PageMeta
│   ├── pages/
│   │   ├── Landing.tsx           # Composes all landing sections
│   │   ├── Features.tsx          # Feature showcase
│   │   ├── Pricing.tsx           # Pricing tiers grid
│   │   ├── UseCases.tsx          # Use case examples
│   │   └── docs/
│   │       └── DocsPage.tsx      # Dynamic MDX page renderer (slug-based)
│   ├── layouts/
│   │   ├── MarketingLayout.tsx   # Header + Outlet + MarketingFooter
│   │   └── DocsLayout.tsx        # Header + DocsSidebar + Outlet + DocsFooter
│   ├── hooks/                    # useMakeTheme (shared theme factory)
│   ├── state/                    # Jotai: themeTypeAtom (localStorage-persisted)
│   ├── theme/                    # GlobalStyles (Ubuntu + JetBrains Mono, scrollbar, gradients)
│   ├── constants/                # envs.ts (TDSK_AD_APP_URL, TDSK_WEB_APP_VERSION)
│   └── utils/
│       ├── docsContent.ts        # import.meta.glob() loader for /docs .md/.mdx + _meta.json
│       └── docsLoader.ts         # buildNavigation(), findContentModule() for slug → MDX mapping
├── index.html
├── package.json
└── tsconfig.json
```

## Key Files

### Entry Point Flow

1. **index.html** loads `/src/index.tsx` via Vite
2. **src/index.tsx** renders `<StrictMode>` → `<App />`
3. **src/App.tsx** sets up: `HelmetProvider` → `ThemeProvider` (MUI) → `GlobalStyles` → `RouterProvider`
4. **src/router.tsx** defines all routes with lazy loading

### Configuration

- **`configs/vite.workspace.ts`** — Full Vite config with MDX rollup plugin, React SWC, tsconfig-paths, SVGR, and custom docs plugins
- **`configs/website.config.ts`** — Loads `TDSK_*` env vars from deploy/values files, exports port (5884), aliases, and filtered env vars for Vite `define`
- **`configs/remarkDocsLinks.ts`** — Remark AST plugin: rewrites relative `.md` links in docs to `/docs/<slug>` routes
- **`configs/vitePluginDocsAssets.ts`** — Dev: middleware serves `/docs-assets/*` from docs root. Build: copies images (png, jpg, gif, svg, webp) to `dist/docs-assets/`

## Routing

**React Router v7** (`createBrowserRouter`):

```
/ (MarketingLayout: Header + Outlet + MarketingFooter)
├── /              → Landing (hero, features, how-it-works, code preview, pricing, use cases, CTA)
├── /features      → Features page
├── /pricing       → Pricing page
└── /use-cases     → UseCases page

/docs (DocsLayout: Header + DocsSidebar + Outlet + DocsFooter)
├── /docs          → DocsPage (index)
└── /docs/*        → DocsPage (catch-all, slug from pathname)

* → Redirect to /
```

All page components are lazy-loaded with `React.lazy()` + `<Suspense>` fallback.

## Documentation System

### Content Source

Docs are loaded from the root `/docs` directory (monorepo level, NOT inside `repos/website/`). The `docsContent.ts` file uses Vite's `import.meta.glob()` to discover:

- `../../docs/**/_meta.json` — Section metadata (label, order, pages array)
- `../../docs/**/*.{md,mdx}` — Markdown/MDX content files

**Excluded directories**: `superpowers`, `plans`, `meta`, `payments`, `tech`, `endpoints`

### Metadata Format (`_meta.json`)

```json
{
  "label": "Getting Started",
  "order": 1,
  "pages": [
    "introduction",
    { "slug": "quickstart", "label": "Quick Start Guide" }
  ]
}
```

### Loading Flow

1. `docsContent.ts` — `import.meta.glob()` discovers all docs files at build time
2. `docsLoader.ts` — `buildNavigation()` converts meta + file keys into structured sidebar nav
3. `docsLoader.ts` — `findContentModule(slug)` maps URL slug to lazy MDX import function
4. `DocsPage.tsx` — Reads slug from `useParams()`, calls `findContentModule()`, dynamically imports + renders with `<MDXProvider>`

### MDX Component Overrides (`MDXComponents.tsx`)

All markdown elements are wrapped with MUI components:
- **Headings** (h1-h6): MUI Typography with auto-generated anchor IDs via `github-slugger`
- **Code blocks**: `CodeBlock` component with Shiki syntax highlighting + copy button
- **Tables**: MUI Table components with dark/light theme support
- **Links**: MUI Link with external link detection
- **Blockquotes**: Styled callout boxes
- **Images**: `<img>` with max-width and border-radius

### Docs Navigation Components

| Component | Purpose |
|-----------|---------|
| `DocsSidebar` | Collapsible section-based nav, highlights active page, auto-expands active section |
| `DocsTableOfContents` | Auto-generated heading anchors from page content |
| `DocsPrevNext` | Previous/next page navigation links |
| `ComingSoon` | 404/placeholder for missing docs pages |
| `CodeBlock` | Shiki-based syntax highlighting with theme-aware colors and copy-to-clipboard |

### Remark/Rehype Plugins

- `remarkGfm` — GitHub-flavored markdown (tables, strikethrough, task lists)
- `remarkDocsLinks` — Custom: rewrites relative `.md` links to `/docs/<slug>` routes
- `rehypeSlug` — Adds IDs to headings for anchor links
- `rehypeAutolinkHeadings` — Wraps heading content in clickable anchors
- `rehype-pretty-code` + Shiki — Syntax highlighting with theme support

## Key Components

### Landing Page Sections

| Component | Purpose |
|-----------|---------|
| `Hero` | Hero section with animated gradient blobs, headline, CTA buttons |
| `ArchitectureDiagram` | Platform architecture visualization (Mermaid or SVG) |
| `Features` | Feature cards grid |
| `HowItWorks` | Step-by-step numbered process |
| `CodePreview` | Code snippet showcase |
| `Pricing` | Pricing tiers (uses `PlanLimits` from `@tdsk/domain`) |
| `UseCases` | Use case example cards |
| `CTABanner` | Bottom call-to-action with gradient background |

### Shared Components

| Component | Purpose |
|-----------|---------|
| `PricingCard` | Reusable pricing tier card with feature list |
| `PricingTierGrid` | Responsive grid wrapper for pricing cards |
| `SectionContainer` | Max-width centered container |
| `SectionHeader` | Section title + subtitle |
| `FeatureCard` | Feature showcase card with icon |
| `CalloutBox` | Alert/note/warning box |
| `StepItem` | Numbered step indicator |
| `PageMeta` | SEO meta tags via react-helmet-async |

### Header & Footer

- `Header` — MUI AppBar with nav links, ThemeToggle, GitHub link, CTA button
- `MobileMenu` — Drawer-based mobile navigation
- `ThemeToggle` — Dark/light mode icon button
- `MarketingFooter` — Links grid + copyright
- `DocsFooter` — Docs-specific footer

## State Management

Minimal — single Jotai atom:

```typescript
// src/state/theme.ts
export const themeTypeAtom = atomWithStorage('tdsk-web-theme', 'dark')
```

Used by `useMakeTheme()` hook to create a MUI theme via `makeTheme()` from `@tdsk/components`.

## Styling

- **MUI v6** + **Emotion** for components and CSS-in-JS
- **`makeTheme()`** from `@tdsk/components` — shared theme factory (dark/light)
- **Global Styles** (`theme/GlobalStyles.tsx`):
  - Fonts: Ubuntu (body), JetBrains Mono / Fira Code (code)
  - Custom webkit scrollbar styling
  - Gradient text classes (`.gradient-text-dark`, `.gradient-text-light`)
  - Gradient CTA background with animated glow
  - Focus visible outlines (2px blue, 2px offset)
- **Colors**: Primary blue (#3370DE), dark bg (#1A1D21), light bg (#FAFBFC)

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `TDSK_WEB_PORT` | `5884` | Dev server port |
| `TDSK_WEB_BASE_PATH` | `/` | URL base path |
| `TDSK_WEB_APP_VERSION` | from package.json | App version |
| `TDSK_AD_APP_URL` | `http://localhost:5887` | Admin dashboard URL (for CTA links) |
| `TDSK_POSTHOG_KEY` / `TDSK_POSTHOG_HOST` | — | PostHog analytics |

## Commands

```bash
pnpm start          # Dev server (port 5884)
pnpm build          # Production build to /dist
pnpm preview        # Preview production build
pnpm test           # Vitest tests
pnpm types          # TypeScript type checking
```

## Tests

6 co-located test files:
- `src/components/Landing/Hero.test.tsx`
- `src/components/Landing/CTABanner.test.tsx`
- `src/components/Shared/PricingCard.test.tsx`
- `src/components/Header/Header.test.tsx`
- `src/components/Header/MobileMenu.test.tsx`
- `src/utils/docsLoader.test.ts`

Test setup: `scripts/setupTests.ts` mocks MUI, Neon Auth, and API service. Environment: jsdom.

## Integration Points

| Consumer | Import | Key Usage |
|----------|--------|-----------|
| **@tdsk/components** | `makeTheme`, `overlayScrollBody`, `useWindowResize` | Theme factory, scroll styling, responsive hook |
| **@tdsk/domain** | `web.ts` exports | `PlanLimits` object for pricing page tier limits |
| **Root `/docs`** | MDX content | All documentation pages loaded via `import.meta.glob()` |

### Path Aliases

```typescript
import { Something } from '@TAF/components/Shared'  // → ./src/components/Shared
import { PlanLimits } from '@TDM/constants'          // → ../domain/src/constants
import { makeTheme } from '@TSC/theme'               // → ../components/src/theme
```

## Key Patterns

### 1. Lazy-Loaded Pages

All pages use `React.lazy()` with a shared `SuspensePage` pattern:
```typescript
const Landing = lazy(() => import('@TAF/pages/Landing'))
// In router: element: <Suspense fallback={<Loading />}><Landing /></Suspense>
```

### 2. Dynamic MDX Loading

Docs content is discovered at build time via `import.meta.glob()` but loaded lazily at runtime. The slug-to-module mapping avoids bundling all docs into the main chunk.

### 3. Dual Layout System

Marketing pages use `MarketingLayout` (full-width, no sidebar), while docs use `DocsLayout` (sidebar + table of contents). Both share the same `Header` component.

### 4. Docs Asset Handling

Images in docs markdown are served via a custom Vite plugin:
- **Dev**: Express middleware intercepts `/docs-assets/*` requests and serves from the docs root directory
- **Build**: Plugin copies all image files to `dist/docs-assets/` during build

## Development Notes

### Adding a New Marketing Page

1. Create page component in `src/pages/` with default export
2. Add lazy route in `src/router.tsx` under `MarketingLayout` children
3. Add nav link in `Header` component

### Adding Documentation

1. Create `.md` or `.mdx` file in root `/docs/<section>/` directory
2. Add the slug to the section's `_meta.json` `pages` array
3. The docs system auto-discovers and renders it — no website code changes needed

### Adding a Docs Section

1. Create a new directory under `/docs/`
2. Add `_meta.json` with `label`, `order`, and `pages` array
3. Add `.md`/`.mdx` files matching the slugs in `pages`
