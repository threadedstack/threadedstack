# ThreadedStack Website Design Document

Date: 2026-03-06
Status: Approved

## Overview

Public-facing landing page and documentation website for ThreadedStack. Separate repo (`repos/website/`) and deployment from admin and chat apps. React + Vite SPA consuming `@tdsk/components` for theme consistency.

## Key Decisions

| Decision | Choice |
|----------|--------|
| Visual tone | Dual-mode: elevated dark (default) + light-first with dark accents |
| Page structure | Hybrid: single-scroll landing + dedicated deep-dive pages |
| Docs approach | Custom MUI layout + MDX + shiki + pagefind |
| Navigation | Transparent-to-solid on landing hero, solid everywhere else |
| Content scope | Landing + docs shell with key pages (Getting Started, Concepts, API Reference) |
| Hero visual | Animated architecture diagram + code snippet |
| CTA flow | Direct redirect to admin sign-in + secondary "Request Demo" |
| Mobile | Desktop-first, mobile-functional |
| Default theme | Dark mode (persisted to localStorage, user toggleable) |

## Route Map

```
/                       -> Landing page (single-scroll, all sections)
/features               -> Features deep-dive
/pricing                -> Pricing deep-dive with plan comparison
/use-cases              -> Use cases deep-dive
/docs                   -> Docs index (redirects to /docs/getting-started)
/docs/getting-started   -> Getting started guide
/docs/concepts          -> Concepts overview
/docs/api-reference     -> API reference (REST endpoints)
/docs/api-reference/:section -> Individual API section
/docs/websocket         -> WebSocket protocol reference
/docs/guides            -> Guides index
/docs/guides/:slug      -> Individual guide
/docs/changelog         -> Changelog / release notes
```

## Layouts

### MarketingLayout (/, /features, /pricing, /use-cases)

```
Header (transparent-to-solid on /, solid elsewhere)
<Outlet />
Footer (full multi-column)
```

### DocsLayout (/docs/*)

```
Header (always solid)
DocsSidebar (240px, left) | DocsContent (flex, max 800px) | TOC (200px, right)
Footer (simplified)
```

Responsive: sidebar hidden behind hamburger on tablet/mobile, TOC hidden below 1280px.

## Landing Page Sections

### 1. Hero (full viewport)

Two-column: text+CTAs left, animated architecture diagram right.

- Overline: "THE DEVELOPER PLATFORM FOR AI AGENTS" (primary color, letter-spaced)
- Headline: "Build Autonomous AI Agents Without the Infrastructure Headaches" (h1, gradient text)
- Subheadline: Platform value proposition (body1, muted)
- Primary CTA: "Get Started Free ->" (contained, primary, large)
- Secondary CTA: "Request a Demo" (outlined, large)
- Below CTAs: "Free tier. No credit card required."

Animated Architecture Diagram (right):
- SVG node graph: Client -> Caddy -> Auth Proxy -> Backend -> [AI Agents, FaaS, Secrets, Sandbox]
- Rounded rect nodes with icons, animated dashed connection lines
- Glowing data dots flowing along lines
- CSS animations (no canvas/WebGL)
- Mobile: simplified static vertical diagram

Background (dark): #1A1D21 + soft blue radial glow (primary at ~5%) + floating blobs
Background (light): #FAFBFC + subtle grey gradients + faint grid overlay at ~3%

### 2. Features Overview

Section header centered. 3-column grid of 6 feature cards (2-col tablet, 1-col mobile).

Cards: Auth Proxy, AI Agent Runtime, Serverless Compute, Secrets Management, Threads & Memory, Multi-Tenant Design.

Each card: colored icon (primary tint), title (h6), description (body2). MUI Card with theme hover lift.

### 3. How It Works

Horizontal stepper: 4 steps connected by animated line.

1. Create an Organization
2. Configure an Agent
3. Connect a Provider
4. Start Building

Line animates left-to-right on scroll into view (IntersectionObserver + CSS keyframes). Each step: numbered circle, title, description.

### 4. Code Preview

Two-column: descriptive text left, styled code block right.

Code example showing API usage (curl or TypeScript SDK). Code block always uses dark background (#141414), shiki highlighting, JetBrains Mono font, 12px border radius, copy button.

### 5. Pricing

4 pricing cards: Free, Basic, Developer, Pro. Developer card highlighted as "Popular" (elevated, primary border, badge).

Each card: tier name, price, description, feature checklist (12 quota types), CTA button.

"See full comparison" link -> /pricing.

### 6. Use Cases

2x2 grid of use case cards:

1. Autonomous AI Agents
2. Secure API Orchestration
3. Serverless Functions
4. Multi-Tenant SaaS Platform

Larger cards: icon, title, 2-3 sentence description, "Learn more ->" link.

### 7. Testimonials / Social Proof

Placeholder section. Either quote-style testimonial cards (to be populated later) or a "Join developers building..." stat row.

### 8. CTA Banner

Full-width gradient banner. "Ready to build?" + "Get Started Free" + "Read the Docs" CTAs.

### 9. Footer

Multi-column: Brand (logo+tagline+theme toggle), Product, Docs, Company, Legal.
Bottom bar: copyright + GitHub icon.

## Inner Pages

### /features

Hero mini (smaller, no diagram) + 6 feature sections with alternating left/right layout. Each: title, detailed description (2-3 paragraphs), visual (code snippet or subsystem diagram), "Read the docs" link.

### /pricing

Hero mini + plan cards row + full comparison table (MUI Table, 12 quota rows x 4 tier columns) + FAQ accordion (MUI Accordion) + CTA banner.

### /use-cases

Hero mini + 4 expanded use case sections. Each: title, extended description, scenario walkthrough, relevant feature callouts, code snippet.

## Docs Layout

### Sidebar (240px, left)

Search input at top (pagefind). Collapsible section groups. Active page: primary color + left border accent.

Sections: Getting Started, Concepts, API Reference, WebSocket, Guides, Changelog.

Style: MuiListItemButton from theme. Section headers: overline (11px, uppercase). Items: body2 (13px).

### Content (center, max 800px)

MDX rendered with MUI-mapped components:
- # -> h3 (24px, page title)
- ## -> h4 (20px, sections)
- ### -> h5 (18px, subsections)
- p -> body1 (14px)
- code blocks -> shiki, always dark bg (#141414), copy button, language label
- tables -> MuiTable
- blockquote -> left border 3px primary, muted bg
- Callout components: Note, Warning, Tip -> MuiAlert variants

Prev/Next navigation at bottom of every page.

### Table of Contents (200px, right)

Auto-generated from h2/h3 headings. Sticky. IntersectionObserver highlights active heading. caption typography (12px). Hidden below 1280px.

### Search

pagefind: build-time index, zero runtime cost. Modal UI (MuiDialog) triggered by sidebar input or "/" hotkey.

### Coming Soon State

Centered: icon + "Coming Soon" (h5) + explanation (body2) + GitHub link.

## Header

Height: 64px. Sticky. z-index: 1300.

Left: Logo SVG (24px) + "ThreadedStack" (subtitle1, gradient text in dark mode).
Center-right: Features, Pricing, Docs, GitHub icon.
Right: Theme toggle (sun/moon) + "Get Started" CTA button (hidden on mobile).

Landing hero: starts transparent, solid on scroll >80px (backdrop-filter: blur(12px), 0.3s transition).
All other pages: always solid.

Mobile: hamburger -> drawer with nav links + CTA + theme toggle.

## Footer

Marketing pages: full multi-column (Brand, Product, Docs, Company, Legal) + bottom copyright bar.
Background dark: #1E2228. Light: #f2f2f2. Top border.

Docs pages: simplified bottom bar only.

## Technical Architecture

### Dependencies to Add

```
@mdx-js/rollup           # Vite MDX plugin
@mdx-js/react            # MDX React runtime
shiki                    # Syntax highlighting
rehype-pretty-code       # Shiki + MDX integration
rehype-slug              # Heading ID slugs
rehype-autolink-headings # Heading anchor links
github-slugger           # Slug generation
pagefind                 # Build-time search (dev dep)
react-helmet-async       # Per-page meta tags
```

### Vite Config

Replace basic markdown-loader plugin with @mdx-js/rollup pipeline (remark-gfm, rehype-slug, rehype-autolink-headings, rehype-pretty-code).

### Theme Integration

Same pattern as admin:
- makeTheme() from @tdsk/components
- Jotai atom for theme type (default: 'dark', persisted to localStorage)
- ThemeProvider + CssBaseline wrapping entire app

### SEO

- react-helmet-async for per-page title, meta description, OpenGraph tags
- robots.txt + sitemap.xml in public/
- og-image.png for social previews
- JSON-LD structured data on landing + pricing pages

### Analytics

PostHog (already in deps) for page view tracking.

## File Structure

```
repos/website/src/
  index.tsx                        # Entry point (exists)
  App.tsx                          # Router + ThemeProvider
  router.tsx                       # Route definitions
  state/
    theme.ts                       # Jotai theme atom
  hooks/
    useScrollPosition.ts           # Header transparency
    useActiveHeading.ts            # TOC highlight
    useMakeTheme.ts                # Theme builder
  layouts/
    MarketingLayout.tsx
    DocsLayout.tsx
  components/
    Header/
      Header.tsx
      MobileMenu.tsx
      ThemeToggle.tsx
    Footer/
      MarketingFooter.tsx
      DocsFooter.tsx
    Landing/
      Hero.tsx
      ArchitectureDiagram.tsx
      Features.tsx
      HowItWorks.tsx
      CodePreview.tsx
      Pricing.tsx
      UseCases.tsx
      Testimonials.tsx
      CTABanner.tsx
    Docs/
      DocsSidebar.tsx
      DocsTableOfContents.tsx
      DocsSearch.tsx
      DocsPrevNext.tsx
      MDXComponents.tsx
      ComingSoon.tsx
    Shared/
      SectionContainer.tsx
      SectionHeader.tsx
      FeatureCard.tsx
      PricingCard.tsx
      StepItem.tsx
      CodeBlock.tsx
      CalloutBox.tsx
  pages/
    Landing.tsx
    Features.tsx
    Pricing.tsx
    UseCases.tsx
    docs/
      [...slug].tsx                # Dynamic MDX page renderer
  content/
    docs/
      getting-started/
        introduction.mdx
        quick-start.mdx
        installation.mdx
      concepts/
        organizations.mdx
        projects.mdx
        agents.mdx
        threads.mdx
        providers.mdx
        endpoints.mdx
        secrets.mdx
      api-reference/
        authentication.mdx
        organizations.mdx
        agents.mdx
        threads.mdx
        ...
      websocket/
        connection.mdx
        client-events.mdx
        server-events.mdx
      guides/
        admin-dashboard.mdx
        repl-cli.mdx
        self-hosting.mdx
      changelog/
        release-notes.mdx
```

## Design Tokens Reference

From @tdsk/components theme:

- Primary: #3370DE (variants: 50 #EBF2FE to 900 #10254A)
- Dark bg: #1A1D21, paper: #21252B, header: #1E2228, input: #181B1F
- Light bg: #FAFBFC, paper: #FFFFFF, header: #F4F5F6
- Font: Ubuntu, sans-serif
- Code font: JetBrains Mono, Fira Code, SF Mono, Consolas
- Border radius: xs 4px, sm 6px, md 8px, lg 12px, xl 16px
- Gutter base: 16px (q=4, s=6, h=8, c=10, t=12, size=16, r=20, m=24, d=32)
- Breakpoints: xs 0, sm 375, md 720, lg 1280, xl 1536
- Borders dark: #2D3139, light: #E5E7EB
- Gradient text: linear-gradient(135deg, primary.main -> primary[300]) dark, primary.main -> primary[700] light
