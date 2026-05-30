# Website Docs Improvements

**Date:** 2026-04-27

---

## Problem

The website documentation portal has three issues:

1. **ASCII art renders poorly on the web.** Multiple architecture and feature docs use box-drawing characters and tree diagrams in plain code blocks. These look acceptable in a markdown editor but break visually on the rendered website — misaligned characters, wrong fonts, no semantic meaning.

2. **No visual references.** The user-guide docs for the Admin Dashboard, Threads App, and TSA CLI are text-only. Screenshots and workflow diagrams would significantly improve comprehension, especially for first-time users.

3. **Internal business docs are publicly visible.** The `docs/business/` directory (value-proposition, pricing strategy, go-to-market) is included in the website sidebar and accessible via URL. This content is internal-only and should not be exposed.

---

## Solution Overview

Three independent changes:

| Change | Approach |
|--------|----------|
| Mermaid chart integration | Client-side rendering via the already-installed `mermaid` npm package. Detect `` ```mermaid `` code blocks in the MDX component layer and render as SVG. |
| ASCII art replacement | Convert all ASCII art in website-visible docs to Mermaid diagrams. Add new workflow diagrams where they improve clarity. |
| Screenshots | Playwright script captures key Admin and Threads UI views. Images co-located in docs directories. TSA CLI uses Mermaid workflow diagrams and styled code blocks instead of screenshots. |
| Exclude business docs | Add `business` to the existing exclusion lists in `docsContent.ts` and `vitePluginDocsAssets.ts`. |

---

## 1. Mermaid Client-Side Rendering

### Component: `MermaidBlock`

New React component at `repos/website/src/components/Docs/MermaidBlock.tsx`.

**Behavior:**
- Receives raw mermaid syntax as a `code` string prop
- Calls `mermaid.initialize()` with theme configuration derived from the current MUI theme (dark/light)
- Calls `mermaid.render()` to produce SVG output
- Renders the SVG into a container (mermaid.render returns sanitized SVG — the library handles sanitization internally since it generates the SVG from its own parser, not from arbitrary HTML)
- Re-renders when the theme changes (subscribe to `themeTypeAtom` via Jotai)
- Each instance uses a unique ID to avoid mermaid render collisions (`mermaid-${useId()}`)

**Theme mapping:**
- Light mode → mermaid `default` theme
- Dark mode → mermaid `dark` theme

### MDX Integration

Edit `repos/website/src/components/Docs/MDXComponents.tsx`:

In the `code` component handler, when `className === 'language-mermaid'`, render `<MermaidBlock code={children} />` instead of `<CodeBlock>`.

```
code: ({ className, children }) => {
  const language = className?.replace('language-', '') || 'text'
  if (language === 'mermaid')
    return <MermaidBlock code={String(children).trim()} />
  // ... existing CodeBlock logic
}
```

### Files Changed
- New: `repos/website/src/components/Docs/MermaidBlock.tsx`
- Edit: `repos/website/src/components/Docs/MDXComponents.tsx`

---

## 2. ASCII Art → Mermaid Conversion

### Files to Convert

Seven docs files currently shown on the website contain ASCII art:

| File | Diagrams | Mermaid Types |
|------|----------|---------------|
| `docs/architecture/platform-overview.md` | System topology, shared entity model, dev environment | `flowchart LR`, `flowchart TD` |
| `docs/architecture/request-flow.md` | 3-tier pipeline, auth flow decision tree, proxy/FaaS/agent sequence diagrams, middleware chains | `flowchart TD`, `sequenceDiagram` |
| `docs/architecture/sandbox-architecture.md` | Provider hierarchy, local provider breakdown, K8s architecture, MITM pod internal diagram, container lifecycle | `flowchart TD`, `flowchart LR` |
| `docs/architecture/data-model.md` | Entity relationship diagram | `erDiagram` |
| `docs/features/organizations.md` | Shared entity model tree | `flowchart TD` |
| `docs/features/proxy-endpoints.md` | Architecture flow diagram | `flowchart LR` |
| `docs/features/secrets.md` | Key derivation flow | `flowchart TD` |

### New Diagrams to Add

Add Mermaid workflow diagrams where they improve clarity beyond the existing text:

| File | New Diagram | Type |
|------|------------|------|
| `docs/user-guide/tsa-cli.md` | `tsa run` flow (login → select sandbox → start pod → sync → launch runtime) | `flowchart TD` |
| `docs/user-guide/tsa-cli.md` | `tsa chat` session lifecycle (login → select agent → open thread → send/receive) | `sequenceDiagram` |
| `docs/user-guide/getting-started.md` | Onboarding flow (sign up → create org → configure provider → launch sandbox) | `flowchart LR` |
| `docs/features/sandbox-connect.md` | SSH tunnel chain (tsa → WebSocket → Caddy → proxy → backend → pod:2222) | `flowchart LR` |

### Conversion Rules

- Replace each ASCII art code block (`` ``` ... ``` ``) with `` ```mermaid ... ``` ``
- Preserve all surrounding text descriptions unchanged
- Use consistent Mermaid styling: meaningful node IDs, descriptive edge labels
- Keep diagrams readable at default zoom — avoid overcrowding nodes
- Sequence diagrams use participant aliases for readability

---

## 3. Screenshots

### Capture Script

New Playwright script at `repos/website/scripts/capture-screenshots.ts`.

**Auth approach:** Follows the same patterns as `repos/integration/` — uses `loadEnvs()` for environment variables (`TDSK_IT_API_KEY`, `TDSK_IT_ORG_ID`, etc.) and reuses the same auth flow as the tier-2 Playwright UI tests.

**Configuration:**
- Viewport: 1280x800
- Format: PNG
- Timeout: 30s per screenshot
- Script is manually invoked (not part of the build pipeline)

Add `pnpm screenshots` script to `repos/website/package.json`.

### Screenshots to Capture

| App | View | Output Path |
|-----|------|-------------|
| Admin | Login/sign-in page | `docs/user-guide/images/admin-login.png` |
| Admin | Org dashboard (sidebar + resource list) | `docs/user-guide/images/admin-org-dashboard.png` |
| Admin | Agent config page | `docs/user-guide/images/admin-agent-config.png` |
| Admin | Provider config page | `docs/user-guide/images/admin-provider-config.png` |
| Admin | Project settings | `docs/user-guide/images/admin-project-settings.png` |
| Admin | Sandbox list | `docs/user-guide/images/admin-sandbox-list.png` |
| Admin | Sandbox config page | `docs/user-guide/images/admin-sandbox-config.png` |
| Threads | Login page | `docs/user-guide/images/threads-login.png` |
| Threads | Home/chat view | `docs/user-guide/images/threads-home.png` |

### Image References

Add to existing MDX docs using standard markdown syntax:

- `docs/user-guide/admin-ui.md` — Add screenshots inline where the relevant feature is described
- `docs/user-guide/threads-app.md` — Add screenshots for the authentication flow and home page

Format: `![Description](./images/filename.png)`

The existing `remarkDocsLinks` plugin automatically rewrites these to `/docs-assets/user-guide/images/filename.png`, and `vitePluginDocsAssets` serves them in dev and copies them at build time. No infrastructure changes needed.

### TSA CLI: Diagrams, Not Screenshots

The TSA CLI docs use Mermaid workflow diagrams and Shiki-highlighted code blocks instead of terminal screenshots. This avoids maintenance burden from terminal rendering differences and keeps CLI docs in sync with the actual command output.

---

## 4. Exclude Business Docs

### Changes

Two files, one line each, following the established exclusion pattern:

**`repos/website/src/utils/docsContent.ts`** — Add to the glob exclusion list:
```
'!@DOCS/business/**'
```

**`repos/website/configs/vitePluginDocsAssets.ts`** — Add to `SkipDirs`:
```
'business'
```

### Effect

- Business docs removed from sidebar navigation
- Business doc URLs return the ComingSoon/404 component
- Business doc images excluded from build output
- Source files in `docs/business/` remain untouched for internal reference
- The `docs/business/_meta.json` ordering is irrelevant once excluded

---

## Dependencies and Ordering

- The MermaidBlock component must be built first since ASCII art conversion and new diagrams depend on it
- Business docs exclusion is fully independent (2-line change)
- Screenshot script is independent of Mermaid work
- Adding image references to MDX depends on screenshots being captured

---

## Files Summary

### New Files
- `repos/website/src/components/Docs/MermaidBlock.tsx` — Mermaid rendering component
- `repos/website/scripts/capture-screenshots.ts` — Playwright screenshot script
- `docs/user-guide/images/*.png` — Captured screenshots (7 files)

### Modified Files
- `repos/website/src/components/Docs/MDXComponents.tsx` — Route mermaid to MermaidBlock
- `repos/website/src/utils/docsContent.ts` — Exclude business docs
- `repos/website/configs/vitePluginDocsAssets.ts` — Exclude business docs from asset copy
- `repos/website/package.json` — Add `screenshots` script
- `docs/architecture/platform-overview.md` — Convert ASCII art to Mermaid
- `docs/architecture/request-flow.md` — Convert ASCII art to Mermaid
- `docs/architecture/sandbox-architecture.md` — Convert ASCII art to Mermaid
- `docs/architecture/data-model.md` — Convert ASCII art to Mermaid
- `docs/features/organizations.md` — Convert ASCII art to Mermaid
- `docs/features/proxy-endpoints.md` — Convert ASCII art to Mermaid
- `docs/features/secrets.md` — Convert ASCII art to Mermaid
- `docs/user-guide/tsa-cli.md` — Add workflow diagrams
- `docs/user-guide/getting-started.md` — Add onboarding flow diagram
- `docs/user-guide/admin-ui.md` — Add screenshot references
- `docs/user-guide/threads-app.md` — Add screenshot references
- `docs/features/sandbox-connect.md` — Add SSH tunnel chain diagram
