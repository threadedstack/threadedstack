# Docs Single Source of Truth — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the root `docs/` folder the single source of truth for all website documentation, with dynamic navigation derived from folder structure and `_meta.json` config files.

**Architecture:** The website's `import.meta.glob` loads `.md`/`.mdx` files directly from the root `docs/` folder via a `@DOCS` path alias (defined in `tsconfig.json` paths, resolved by `alias-hq` into Vite's `resolve.alias`). A `_meta.json` file in each public docs subdirectory controls label, ordering, and page sequence. A remark plugin rewrites relative markdown links and image paths for the web context. A Vite plugin serves and copies doc images during dev and build.

**Tech Stack:** Vite `import.meta.glob`, `@mdx-js/rollup` (processes both `.md` and `.mdx`), custom remark plugin (link/image rewriting), custom Vite plugin (image serving/copying), React (DocsSidebar, DocsPrevNext, DocsPage)

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `docs/architecture/_meta.json` | Nav config: label "Architecture", order 1, page ordering |
| `docs/features/_meta.json` | Nav config: label "Features", order 2, page ordering |
| `docs/user-guide/_meta.json` | Nav config: label "User Guide", order 3, page ordering |
| `docs/business/_meta.json` | Nav config: label "Business", order 4, page ordering |
| `repos/website/src/utils/docsLoader.ts` | Centralized glob imports + `buildNavigation()` pure function |
| `repos/website/src/utils/docsLoader.test.ts` | Unit tests for nav builder logic |
| `repos/website/configs/remarkDocsLinks.ts` | Remark plugin: rewrites `.md` links → routes, relative images → absolute served paths |
| `repos/website/configs/remarkDocsLinks.test.ts` | Unit tests for remark plugin transforms |
| `repos/website/configs/vitePluginDocsAssets.ts` | Vite plugin: serves doc images in dev, copies to `dist/` on build |

### Modified Files

| File | Changes |
|------|---------|
| `repos/website/tsconfig.json` | Add `@DOCS` and `@DOCS/*` path aliases pointing to `../../docs` |
| `repos/website/configs/vite.workspace.ts` | Add `server.fs.allow` for docs dir (derived from `@DOCS` alias), register remark + vite plugins, configure MDX to include `.md` |
| `repos/website/src/pages/docs/DocsPage.tsx` | Replace local glob with `docsLoader` imports, new slug resolution |
| `repos/website/src/components/Docs/DocsSidebar.tsx` | Replace hardcoded `sections` array with import from `docsLoader` |
| `repos/website/src/components/Docs/DocsPrevNext.tsx` | Replace hardcoded `allPages` array with import from `docsLoader` |
| `repos/website/src/components/Docs/DocsTableOfContents.tsx` | Add `pathname` to useEffect dependency array for re-extraction on navigation |
| `repos/website/src/hooks/useActiveHeading.ts` | Accept `pathname` parameter, re-observe headings on navigation |
| `repos/website/src/router.tsx` | Change `/docs` index from redirect to render `docs/index.md` |
| `repos/website/src/external.d.ts` | Add `declare module '*.md'` for TypeScript |
| `repos/website/src/components/Footer/MarketingFooter.tsx` | Update hardcoded `/docs/*` links to match new URL structure |
| `repos/website/src/pages/UseCases.tsx` | Update hardcoded `/docs/*` links to match new URL structure |
| `repos/website/src/pages/Features.tsx` | Update hardcoded `/docs/*` links to match new URL structure |

### Deleted Files

| File | Reason |
|------|--------|
| `repos/website/src/content/docs/getting-started/introduction.mdx` | Replaced by `docs/user-guide/getting-started.md` |
| `repos/website/src/content/docs/getting-started/quick-start.mdx` | Content merged into docs/ |
| `repos/website/src/content/docs/concepts/agents.mdx` | Replaced by `docs/features/agent-endpoints.md` |
| `repos/website/src/content/docs/concepts/threads.mdx` | Replaced by `docs/features/threads.md` |
| `repos/website/src/content/docs/concepts/organizations.mdx` | Replaced by `docs/features/organizations.md` |
| `repos/website/src/content/docs/api-reference/authentication.mdx` | Replaced by `docs/user-guide/api-reference.md` |

---

## Chunk 1: Foundation — _meta.json Convention + Docs Loader Utility

### Task 1: Create `_meta.json` files in docs/ directories

These files control which directories appear in the website nav, their display labels, ordering, and page sequence within each section.

**Convention:**
- Directories WITH `_meta.json` → included in website navigation
- Directories WITHOUT `_meta.json` → excluded (superpowers/, payments/, meta/, tech/, endpoints/)
- `pages` array is optional — if present, defines order; unlisted files appended alphabetically
- Page entries can be strings (slug only, label derived from titleCase) or objects (`{ slug, label }`)

**Files:**
- Create: `docs/architecture/_meta.json`
- Create: `docs/features/_meta.json`
- Create: `docs/user-guide/_meta.json`
- Create: `docs/business/_meta.json`

- [ ] **Step 1: Create `docs/architecture/_meta.json`**

```json
{
  "label": "Architecture",
  "order": 1,
  "pages": [
    "platform-overview",
    "request-flow",
    "data-model",
    "security-model",
    "sandbox-architecture"
  ]
}
```

- [ ] **Step 2: Create `docs/features/_meta.json`**

```json
{
  "label": "Features",
  "order": 2,
  "pages": [
    "organizations",
    "agent-endpoints",
    "proxy-endpoints",
    "faas-endpoints",
    "threads",
    "secrets",
    "sandbox-connect",
    "billing"
  ]
}
```

- [ ] **Step 3: Create `docs/user-guide/_meta.json`**

```json
{
  "label": "User Guide",
  "order": 3,
  "pages": [
    "getting-started",
    { "slug": "admin-ui", "label": "Admin Dashboard" },
    "api-reference",
    { "slug": "repl-cli", "label": "REPL CLI" },
    { "slug": "threads-app", "label": "Threads App" },
    "sandbox-usage"
  ]
}
```

- [ ] **Step 4: Create `docs/business/_meta.json`**

```json
{
  "label": "Business",
  "order": 4,
  "pages": [
    "value-proposition",
    "pricing",
    "go-to-market"
  ]
}
```

---

### Task 2: Write failing tests for the docs loader utility

**Files:**
- Create: `repos/website/src/utils/docsLoader.test.ts`

- [ ] **Step 1: Write tests for `toTitleCase` helper**

```ts
import { describe, it, expect } from 'vitest'
import { toTitleCase, buildNavigation } from './docsLoader'

describe('toTitleCase', () => {
  it('converts kebab-case to Title Case', () => {
    expect(toTitleCase('platform-overview')).toBe('Platform Overview')
  })

  it('handles single word', () => {
    expect(toTitleCase('billing')).toBe('Billing')
  })

  it('handles multiple hyphens', () => {
    expect(toTitleCase('go-to-market')).toBe('Go To Market')
  })
})
```

- [ ] **Step 2: Write tests for `buildNavigation`**

```ts
describe('buildNavigation', () => {
  const DOCS_PREFIX = '@DOCS/'

  const mockMeta = {
    [`${DOCS_PREFIX}architecture/_meta.json`]: {
      label: 'Architecture',
      order: 1,
      pages: ['platform-overview', 'data-model'],
    },
    [`${DOCS_PREFIX}features/_meta.json`]: {
      label: 'Features',
      order: 2,
    },
  }

  const mockContentKeys = [
    `${DOCS_PREFIX}architecture/platform-overview.md`,
    `${DOCS_PREFIX}architecture/data-model.md`,
    `${DOCS_PREFIX}architecture/extra-doc.md`,
    `${DOCS_PREFIX}features/billing.md`,
    `${DOCS_PREFIX}features/agents.mdx`,
    `${DOCS_PREFIX}index.md`,
  ]

  it('builds sections from _meta.json files sorted by order', () => {
    const { sections } = buildNavigation(mockMeta, mockContentKeys, DOCS_PREFIX)
    expect(sections).toHaveLength(2)
    expect(sections[0].label).toBe('Architecture')
    expect(sections[1].label).toBe('Features')
  })

  it('orders pages according to _meta.json pages array', () => {
    const { sections } = buildNavigation(mockMeta, mockContentKeys, DOCS_PREFIX)
    const arch = sections[0]
    expect(arch.items[0].slug).toBe('platform-overview')
    expect(arch.items[1].slug).toBe('data-model')
  })

  it('appends unlisted files alphabetically after ordered pages', () => {
    const { sections } = buildNavigation(mockMeta, mockContentKeys, DOCS_PREFIX)
    const arch = sections[0]
    expect(arch.items[2].slug).toBe('extra-doc')
    expect(arch.items[2].label).toBe('Extra Doc')
  })

  it('auto-discovers and sorts all pages when no pages array', () => {
    const { sections } = buildNavigation(mockMeta, mockContentKeys, DOCS_PREFIX)
    const feat = sections[1]
    expect(feat.items[0].slug).toBe('agents')
    expect(feat.items[1].slug).toBe('billing')
  })

  it('strips .md and .mdx extensions from slugs', () => {
    const { sections } = buildNavigation(mockMeta, mockContentKeys, DOCS_PREFIX)
    const feat = sections[1]
    expect(feat.items.every((i: any) => !i.slug.includes('.'))).toBe(true)
  })

  it('builds correct route paths', () => {
    const { sections } = buildNavigation(mockMeta, mockContentKeys, DOCS_PREFIX)
    expect(sections[0].items[0].path).toBe('/docs/architecture/platform-overview')
    expect(sections[1].items[1].path).toBe('/docs/features/billing')
  })

  it('produces flattened allPages in section order', () => {
    const { allPages } = buildNavigation(mockMeta, mockContentKeys, DOCS_PREFIX)
    expect(allPages[0].path).toBe('/docs/architecture/platform-overview')
    expect(allPages[allPages.length - 1].path).toContain('/docs/features/')
  })

  it('supports object entries in pages array for custom labels', () => {
    const metaWithLabels = {
      [`${DOCS_PREFIX}guides/_meta.json`]: {
        label: 'Guides',
        order: 1,
        pages: [{ slug: 'admin-ui', label: 'Admin Dashboard' }],
      },
    }
    const keys = [`${DOCS_PREFIX}guides/admin-ui.md`]
    const { sections } = buildNavigation(metaWithLabels, keys, DOCS_PREFIX)
    expect(sections[0].items[0].label).toBe('Admin Dashboard')
  })

  it('ignores files in directories without _meta.json', () => {
    const { sections } = buildNavigation(mockMeta, mockContentKeys, DOCS_PREFIX)
    const allSlugs = sections.flatMap((s: any) => s.items.map((i: any) => i.slug))
    expect(allSlugs).not.toContain('index')
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd repos/website && npx vitest run --config configs/vite.config.ts src/utils/docsLoader.test.ts`
Expected: FAIL — `docsLoader` module does not exist yet

- [ ] **Step 4: Commit**
```
test(website): add failing tests for docsLoader nav builder
```

---

### Task 3: Implement the docs loader utility

**Files:**
- Create: `repos/website/src/utils/docsLoader.ts`

- [ ] **Step 1: Implement `toTitleCase` and `buildNavigation`**

```ts
type MetaPage = string | { slug: string; label: string }
type MetaConfig = { label: string; order: number; pages?: MetaPage[] }

export type DocNavItem = { slug: string; label: string; path: string }
export type DocNavSection = {
  label: string
  slug: string
  order: number
  items: DocNavItem[]
}

export function toTitleCase(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function buildNavigation(
  metaModules: Record<string, MetaConfig>,
  contentKeys: string[],
  docsPrefix: string
): { sections: DocNavSection[]; allPages: DocNavItem[] } {
  const sections: DocNavSection[] = []

  for (const [metaPath, meta] of Object.entries(metaModules)) {
    const dir = metaPath.replace(docsPrefix, '').replace('/_meta.json', '')
    const dirPrefix = `${docsPrefix}${dir}/`

    const dirFiles = contentKeys
      .filter((p) => p.startsWith(dirPrefix) && !p.includes('/images/') && !p.endsWith('/_meta.json'))
      .map((p) => {
        const slug = p.replace(dirPrefix, '').replace(/\.(md|mdx)$/, '')
        return { slug, label: toTitleCase(slug), path: `/docs/${dir}/${slug}` }
      })

    let orderedItems: DocNavItem[]

    if (meta.pages && meta.pages.length > 0) {
      const customLabels: Record<string, string> = {}
      const pageOrder = meta.pages.map((p) => {
        if (typeof p === 'object') {
          customLabels[p.slug] = p.label
          return p.slug
        }
        return p
      })

      const ordered = pageOrder
        .filter((slug) => dirFiles.some((f) => f.slug === slug))
        .map((slug) => {
          const file = dirFiles.find((f) => f.slug === slug)!
          return { ...file, label: customLabels[slug] || file.label }
        })

      const remaining = dirFiles
        .filter((f) => !pageOrder.includes(f.slug))
        .sort((a, b) => a.slug.localeCompare(b.slug))

      orderedItems = [...ordered, ...remaining]
    } else {
      orderedItems = [...dirFiles].sort((a, b) => a.slug.localeCompare(b.slug))
    }

    sections.push({ label: meta.label, slug: dir, order: meta.order, items: orderedItems })
  }

  sections.sort((a, b) => a.order - b.order)
  return { sections, allPages: sections.flatMap((s) => s.items) }
}
```

- [ ] **Step 2: Add the glob imports and exported nav/content**

Append to the same file:

```ts
const DOCS_PREFIX = '@DOCS/'

const metaModules = import.meta.glob('@DOCS/**/_meta.json', {
  eager: true,
  import: 'default',
}) as Record<string, MetaConfig>

export const contentModules = import.meta.glob(
  [
    '@DOCS/**/*.md',
    '@DOCS/**/*.mdx',
    '!@DOCS/superpowers/**',
    '!@DOCS/meta/**',
    '!@DOCS/payments/**',
    '!@DOCS/tech/**',
    '!@DOCS/endpoints/**',
  ]
) as Record<string, () => Promise<{ default: React.ComponentType }>>

const { sections, allPages } = buildNavigation(
  metaModules,
  Object.keys(contentModules),
  DOCS_PREFIX
)

export { sections, allPages, DOCS_PREFIX }

export function findContentModule(slug: string) {
  const paths = [
    `${DOCS_PREFIX}${slug}.mdx`,
    `${DOCS_PREFIX}${slug}.md`,
    `${DOCS_PREFIX}${slug}/index.mdx`,
    `${DOCS_PREFIX}${slug}/index.md`,
  ]
  const match = paths.find((p) => contentModules[p])
  return match ? contentModules[match] : null
}
```

- [ ] **Step 3: Run tests to verify they pass**

Run: `cd repos/website && npx vitest run --config configs/vite.config.ts src/utils/docsLoader.test.ts`
Expected: PASS — all tests green

- [ ] **Step 4: Commit**
```
feat(website): implement docsLoader with nav builder and content resolution
```

---

## Chunk 2: Vite Configuration + Remark/Vite Plugins

### Task 4: Install required dependencies

pnpm strict mode requires all imports to be declared as direct dependencies. Install these before writing tests or implementations that use them.

**Files:**
- Modify: `repos/website/package.json`

- [ ] **Step 1: Install remark pipeline dependencies**

```bash
pnpm add -F @tdsk/website unist-util-visit
pnpm add -F @tdsk/website -D remark @types/mdast
```

- `unist-util-visit` — AST visitor used by the remark plugin
- `remark` — standalone remark processor, used in tests
- `@types/mdast` — TypeScript types for markdown AST nodes

- [ ] **Step 2: Verify imports resolve**

```bash
cd repos/website && node -e "require.resolve('unist-util-visit'); require.resolve('remark'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**
```
chore(website): add remark dependencies for docs link plugin
```

---

### Task 5: Write failing tests for the remark link/image rewriting plugin

**Files:**
- Create: `repos/website/configs/remarkDocsLinks.test.ts`

The remark plugin transforms:
1. `[text](../features/billing.md)` → `[text](/docs/features/billing)` (relative .md links → routes)
2. `![alt](images/foo.png)` → `![alt](/docs-assets/features/images/foo.png)` (relative images → served path)

- [ ] **Step 1: Write tests for the remark plugin**

```ts
import { describe, it, expect } from 'vitest'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import { remarkDocsLinks } from './remarkDocsLinks'
import path from 'node:path'

// Resolve the same way alias-hq does: tsconfig paths are relative to tsconfig location (repos/website/)
const docsRoot = path.resolve(__dirname, '..', '..', '..', 'docs')

function process(markdown: string, filePath: string) {
  const file = remark()
    .use(remarkGfm)
    .use(remarkDocsLinks, { docsRoot })
    .processSync({ value: markdown, path: filePath })
  return String(file)
}

describe('remarkDocsLinks', () => {
  it('rewrites relative .md links to /docs/ routes', () => {
    const input = '[Billing](../features/billing.md)'
    const result = process(input, path.join(docsRoot, 'architecture/platform-overview.md'))
    expect(result).toContain('[Billing](/docs/features/billing)')
  })

  it('rewrites relative .mdx links to /docs/ routes', () => {
    const input = '[Agents](agents.mdx)'
    const result = process(input, path.join(docsRoot, 'features/agents.md'))
    expect(result).toContain('[Agents](/docs/features/agents)')
  })

  it('does not rewrite absolute http links', () => {
    const input = '[External](https://example.com/docs/foo.md)'
    const result = process(input, path.join(docsRoot, 'features/billing.md'))
    expect(result).toContain('https://example.com/docs/foo.md')
  })

  it('does not rewrite anchor-only links', () => {
    const input = '[Section](#overview)'
    const result = process(input, path.join(docsRoot, 'features/billing.md'))
    expect(result).toContain('[Section](#overview)')
  })

  it('rewrites relative image paths to /docs-assets/ absolute paths', () => {
    const input = '![Screenshot](images/01-home.png)'
    const result = process(input, path.join(docsRoot, 'features/proxy-endpoints.md'))
    expect(result).toContain('![Screenshot](/docs-assets/features/images/01-home.png)')
  })

  it('does not rewrite absolute image URLs', () => {
    const input = '![Logo](https://example.com/logo.png)'
    const result = process(input, path.join(docsRoot, 'features/billing.md'))
    expect(result).toContain('https://example.com/logo.png')
  })

  it('handles links from index.md at docs root', () => {
    const input = '[Overview](architecture/platform-overview.md)'
    const result = process(input, path.join(docsRoot, 'index.md'))
    expect(result).toContain('[Overview](/docs/architecture/platform-overview)')
  })

  it('preserves anchor fragments on .md links', () => {
    const input = '[Pricing](../features/billing.md#pricing-tiers)'
    const result = process(input, path.join(docsRoot, 'architecture/platform-overview.md'))
    expect(result).toContain('/docs/features/billing#pricing-tiers')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd repos/website && npx vitest run --config configs/vite.config.ts configs/remarkDocsLinks.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Commit**
```
test(website): add failing tests for remarkDocsLinks remark plugin
```

---

### Task 5: Implement the remark plugin

**Files:**
- Create: `repos/website/configs/remarkDocsLinks.ts`

- [ ] **Step 1: Implement `remarkDocsLinks`**

```ts
import path from 'node:path'
import { visit } from 'unist-util-visit'
import type { Root, Link, Image } from 'mdast'
import type { VFile } from 'vfile'

type RemarkDocsLinksOptions = { docsRoot: string }

export function remarkDocsLinks(options: RemarkDocsLinksOptions) {
  const { docsRoot } = options

  return (tree: Root, file: VFile) => {
    if (!file.path) return

    const fileDir = path.dirname(path.relative(docsRoot, file.path))

    visit(tree, 'link', (node: Link) => {
      const { url } = node
      if (!url || url.startsWith('http') || url.startsWith('#') || url.startsWith('/')) return

      const [urlPath, hash] = url.split('#')
      if (urlPath.endsWith('.md') || urlPath.endsWith('.mdx')) {
        const resolved = path.posix.normalize(
          path.posix.join(fileDir === '.' ? '' : fileDir, urlPath)
        )
        const route = resolved.replace(/\.(md|mdx)$/, '')
        node.url = `/docs/${route}${hash ? `#${hash}` : ''}`
      }
    })

    visit(tree, 'image', (node: Image) => {
      const { url } = node
      if (!url || url.startsWith('http') || url.startsWith('/')) return

      const resolved = path.posix.normalize(
        path.posix.join(fileDir === '.' ? '' : fileDir, url)
      )
      node.url = `/docs-assets/${resolved}`
    })
  }
}
```

**Note:** `unist-util-visit`, `remark`, and `@types/mdast` were installed in Task 4.

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd repos/website && npx vitest run --config configs/vite.config.ts configs/remarkDocsLinks.test.ts`
Expected: PASS — all tests green

- [ ] **Step 3: Commit**
```
feat(website): implement remarkDocsLinks remark plugin for link/image rewriting
```

---

### Task 6: Create the Vite plugin for docs image serving

**Files:**
- Create: `repos/website/configs/vitePluginDocsAssets.ts`

This plugin:
- **Dev:** Adds middleware to serve files from `docs/` under the `/docs-assets/` URL prefix
- **Build:** Copies all image files from `docs/**/images/**` into `dist/docs-assets/`

- [ ] **Step 1: Implement `vitePluginDocsAssets`**

```ts
import path from 'node:path'
import fs from 'node:fs'
import type { Plugin, ViteDevServer } from 'vite'

type DocsAssetsOptions = { docsRoot: string }

export function vitePluginDocsAssets(options: DocsAssetsOptions): Plugin {
  const { docsRoot } = options

  return {
    name: 'vite-plugin-docs-assets',

    configureServer(server: ViteDevServer) {
      server.middlewares.use('/docs-assets', (req, res, next) => {
        const filePath = path.join(docsRoot, req.url || '')
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.setHeader('Cache-Control', 'no-cache')
          const ext = path.extname(filePath).toLowerCase()
          const mimeTypes: Record<string, string> = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.webp': 'image/webp',
          }
          if (mimeTypes[ext]) res.setHeader('Content-Type', mimeTypes[ext])
          fs.createReadStream(filePath).pipe(res)
        } else {
          next()
        }
      })
    },

    closeBundle() {
      const outDir = path.resolve(docsRoot, '..', 'repos', 'website', 'dist', 'docs-assets')
      copyImages(docsRoot, docsRoot, outDir)
    },
  }
}

function copyImages(dir: string, docsRoot: string, outDir: string) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'superpowers' || entry.name === 'plans' || entry.name === 'node_modules') continue
      copyImages(fullPath, docsRoot, outDir)
    } else if (/\.(png|jpe?g|gif|svg|webp)$/i.test(entry.name)) {
      const relPath = path.relative(docsRoot, fullPath)
      const destPath = path.join(outDir, relPath)
      fs.mkdirSync(path.dirname(destPath), { recursive: true })
      fs.copyFileSync(fullPath, destPath)
    }
  }
}
```

- [ ] **Step 2: Commit**
```
feat(website): add vitePluginDocsAssets for serving doc images in dev and build
```

---

### Task 7: Update Vite configuration

**Files:**
- Modify: `repos/website/configs/vite.workspace.ts`
- Modify: `repos/website/src/external.d.ts`

- [ ] **Step 1: Add `.md` module type declaration**

In `repos/website/src/external.d.ts`, append:

```ts
declare module '*.md' {
  const Component: React.ComponentType
  export default Component
}
```

- [ ] **Step 2: Add `@DOCS` alias to `tsconfig.json`**

In `repos/website/tsconfig.json`, add to `compilerOptions.paths`:

```json
"@DOCS": ["../../docs"],
"@DOCS/*": ["../../docs/*"]
```

This follows the existing pattern (`@ROOT` → `../../`, `@TAF/*` → `./src/*`). The `alias-hq` library reads these paths and `hq.get('webpack')` will include the resolved `@DOCS` alias automatically — no changes to `website.config.ts` needed.

- [ ] **Step 3: Update `vite.workspace.ts`**

Changes needed:
1. Import the remark plugin and Vite plugin
2. Derive `docsRoot` from the `@DOCS` alias (already resolved by `alias-hq`)
3. Configure MDX plugin to process `.md` files via the `include` option
4. Add the remark plugin to the MDX remarkPlugins list
5. Register the docs assets Vite plugin
6. Add `server.fs.allow` for the docs directory

```ts
// Add these imports at the top
import { remarkDocsLinks } from './remarkDocsLinks'
import { vitePluginDocsAssets } from './vitePluginDocsAssets'

// Derive docs root from the @DOCS alias (already an absolute path from alias-hq)
const docsRoot = aliases['@DOCS'] as string
```

Update the `mdx()` plugin call:

```ts
mdx({
  remarkPlugins: [remarkGfm, [remarkDocsLinks, { docsRoot }]],
  providerImportSource: `@mdx-js/react`,
  rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: `wrap` }]],
  include: /\.(md|mdx)$/,
}),
```

Add the docs assets plugin to the plugins array (after the existing plugins):

```ts
vitePluginDocsAssets({ docsRoot }),
```

Add `server` config:

```ts
server: {
  port,
  fs: {
    allow: [rootDir, docsRoot],
  },
},
```

**Note:** The existing `server: { port }` config is inside the returned object — merge the `fs.allow` into it. `docsRoot` is the absolute path derived from the `@DOCS` alias, not a hand-built relative path.

- [ ] **Step 3: Run type check**

Run: `cd repos/website && pnpm types`
Expected: PASS (no type errors related to `.md` imports)

- [ ] **Step 4: Commit**
```
feat(website): configure Vite to process docs/ .md files with MDX pipeline
```

---

## Chunk 3: Dynamic Navigation Components

### Task 8: Rewrite DocsSidebar to use dynamic navigation

**Files:**
- Modify: `repos/website/src/components/Docs/DocsSidebar.tsx`

- [ ] **Step 1: Replace hardcoded sections with docsLoader import**

Remove the hardcoded `sections` array (lines 15-65) and import from docsLoader:

```ts
import { sections } from '@TAF/utils/docsLoader'
```

Remove the local `NavItem` and `NavSection` types, import from docsLoader:

```ts
import { sections, type DocNavSection, type DocNavItem } from '@TAF/utils/docsLoader'
```

Update ALL occurrences of `section.title` → `section.label` throughout the component (7 occurrences):
- State initialization: `initial[section.title]` → `initial[section.label]`
- Toggle handler call: `toggle(section.title)` → `toggle(section.label)`
- React key: `key={section.title}` → `key={section.label}`
- Display text: `{section.title}` → `{section.label}`
- Collapse state reads: `openSections[section.title]` → `openSections[section.label]` (2 places)
- Optionally rename the `toggle` parameter: `(title: string)` → `(label: string)` for consistency

`item.label` and `item.path` stay the same — they already match the docsLoader types.

- [ ] **Step 2: Verify the component compiles**

Run: `cd repos/website && pnpm types`
Expected: PASS

- [ ] **Step 3: Commit**
```
refactor(website): DocsSidebar reads navigation from docsLoader
```

---

### Task 9: Rewrite DocsPrevNext to use dynamic navigation

**Files:**
- Modify: `repos/website/src/components/Docs/DocsPrevNext.tsx`

- [ ] **Step 1: Replace hardcoded allPages with docsLoader import**

Remove the hardcoded `allPages` array (lines 7-29) and import:

```ts
import { allPages } from '@TAF/utils/docsLoader'
```

The rest of the component stays exactly the same — it already uses `allPages` by name.

- [ ] **Step 2: Verify the component compiles**

Run: `cd repos/website && pnpm types`
Expected: PASS

- [ ] **Step 3: Commit**
```
refactor(website): DocsPrevNext reads page list from docsLoader
```

---

### Task 10: Rewrite DocsPage to load from docs/ folder

**Files:**
- Modify: `repos/website/src/pages/docs/DocsPage.tsx`

- [ ] **Step 1: Replace the entire component**

```tsx
import { useLocation } from 'react-router'
import { useState, useEffect } from 'react'
import { MDXProvider } from '@mdx-js/react'
import ComingSoon from '@TAF/components/Docs/ComingSoon'
import DocsPrevNext from '@TAF/components/Docs/DocsPrevNext'
import { mdxComponents } from '@TAF/components/Docs/MDXComponents'
import { findContentModule } from '@TAF/utils/docsLoader'

const DocsPage = () => {
  const { pathname } = useLocation()
  const slug = pathname.replace(/^\/docs\/?/, '') || 'index'
  const [Content, setContent] = useState<React.ComponentType | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setContent(null)
    setNotFound(false)

    const loader = findContentModule(slug)
    if (loader) {
      loader().then((mod: any) => setContent(() => mod.default))
    } else {
      setNotFound(true)
    }
  }, [slug])

  if (notFound)
    return (
      <>
        <ComingSoon />
        <DocsPrevNext />
      </>
    )
  if (!Content) return null

  return (
    <MDXProvider components={mdxComponents}>
      <Content />
      <DocsPrevNext />
    </MDXProvider>
  )
}

export default DocsPage
```

Key changes:
- Removed local `import.meta.glob` — uses `findContentModule` from docsLoader
- Default slug is `'index'` instead of `'getting-started'`
- `findContentModule` tries `.mdx` then `.md`, then `index.mdx` then `index.md`

- [ ] **Step 2: Commit**
```
refactor(website): DocsPage loads content via docsLoader from root docs/
```

---

### Task 11: Update router to render docs/index.md as landing page

**Files:**
- Modify: `repos/website/src/router.tsx`

- [ ] **Step 1: Replace the Navigate redirect with DocsPage**

In the `/docs` route, change the index route from:

```tsx
{
  index: true,
  Component: () => (
    <Navigate replace to='/docs/getting-started' />
  ),
},
```

to:

```tsx
{ index: true, Component: () => <S C={DocsPage} /> },
```

This renders `docs/index.md` at the `/docs` URL (the DocsPage component defaults to slug `'index'` when the path is just `/docs/`).

**Note:** `Navigate` is still used for the catch-all `path: '*'` redirect to `/`. Do NOT remove the import.

- [ ] **Step 2: Commit**
```
feat(website): render docs/index.md as /docs landing page
```

---

### Task 12: Fix DocsTableOfContents heading re-extraction on navigation

**Files:**
- Modify: `repos/website/src/hooks/useActiveHeading.ts`
- Modify: `repos/website/src/components/Docs/DocsTableOfContents.tsx`

Currently `DocsTableOfContents` extracts headings once on mount. When navigating between doc pages, the headings don't update because the `useEffect` dependency array is empty.

- [ ] **Step 1: Update `useActiveHeading` to accept a dependency key**

```ts
import { useState, useEffect } from 'react'

export const useActiveHeading = (deps?: unknown) => {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      { rootMargin: '-64px 0px -80% 0px', threshold: 0 }
    )

    const headings = document.querySelectorAll('h2[id], h3[id]')
    for (const heading of headings) observer.observe(heading)

    return () => observer.disconnect()
  }, [deps])

  return activeId
}
```

- [ ] **Step 2: Update `DocsTableOfContents` to re-extract on pathname change**

```tsx
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import { useActiveHeading } from '@TAF/hooks/useActiveHeading'

type Heading = { id: string; text: string; level: number }

const DocsTableOfContents = () => {
  const { pathname } = useLocation()
  const [headings, setHeadings] = useState<Heading[]>([])
  const activeId = useActiveHeading(pathname)

  useEffect(() => {
    // Small delay to let MDX content render before scanning headings
    const timer = setTimeout(() => {
      const elements = document.querySelectorAll('main h2[id], main h3[id]')
      const items: Heading[] = []
      for (const el of elements) {
        items.push({
          id: el.id,
          text: el.textContent || '',
          level: el.tagName === 'H2' ? 2 : 3,
        })
      }
      setHeadings(items)
    }, 100)

    return () => clearTimeout(timer)
  }, [pathname])

  // ... rest of the component stays the same (the JSX return)
```

The `setTimeout` is needed because the MDX content is loaded asynchronously — headings won't exist in the DOM immediately when the pathname changes.

- [ ] **Step 3: Commit**
```
fix(website): re-extract TOC headings on doc page navigation
```

---

## Chunk 4: Cleanup + Validation

### Task 13: Delete the old content directory

**Files:**
- Delete: `repos/website/src/content/docs/` (entire directory — 6 MDX files)

Before deleting, verify that no other code imports from this directory.

- [ ] **Step 1: Search for references to the old content path**

Run: `grep -r "content/docs" repos/website/src/ --include="*.ts" --include="*.tsx"`
Expected: Only the old DocsPage.tsx glob (which we already replaced in Task 10). If other files reference it, update them first.

- [ ] **Step 2: Delete the directory**

```bash
rm -rf repos/website/src/content/docs/
```

- [ ] **Step 3: Verify build still works**

Run: `cd repos/website && pnpm build`
Expected: PASS — no broken imports

- [ ] **Step 4: Commit**
```
chore(website): remove old content/docs/ directory (replaced by root docs/)
```

---

### Task 14: Update hardcoded `/docs/*` links in marketing pages

Several marketing pages have hardcoded doc links that won't match the new URL structure. These must be updated to point to valid docs/ routes.

**Files:**
- Modify: `repos/website/src/components/Footer/MarketingFooter.tsx`
- Modify: `repos/website/src/pages/UseCases.tsx`
- Modify: `repos/website/src/pages/Features.tsx`

- [ ] **Step 1: Update `MarketingFooter.tsx`**

```
Old → New:
'/docs/getting-started' → '/docs/user-guide/getting-started'
'/docs/api-reference'   → '/docs/user-guide/api-reference'
'/docs/guides'          → '/docs/user-guide/admin-ui'
```

- [ ] **Step 2: Update `UseCases.tsx`**

```
Old → New:
'/docs/agents'        → '/docs/features/agent-endpoints'
'/docs/proxy'         → '/docs/features/proxy-endpoints'
'/docs/compute'       → '/docs/features/faas-endpoints'
'/docs/multi-tenancy' → '/docs/features/organizations'
```

- [ ] **Step 3: Update `Features.tsx`**

```
Old → New:
'/docs/auth-proxy'    → '/docs/architecture/request-flow'
'/docs/agents'        → '/docs/features/agent-endpoints'
'/docs/compute'       → '/docs/features/faas-endpoints'
'/docs/secrets'       → '/docs/features/secrets'
'/docs/threads'       → '/docs/features/threads'
'/docs/multi-tenancy' → '/docs/features/organizations'
```

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `cd repos/website && pnpm test`
Expected: All existing tests pass (the test assertions check for `not.toHaveAttribute('href', '/docs/getting-started')` so they remain valid).

- [ ] **Step 5: Commit**
```
fix(website): update hardcoded doc links to match new docs/ URL structure
```

---

### Task 15: Full build + manual validation

- [ ] **Step 1: Run all website unit tests**

Run: `cd repos/website && pnpm test`
Expected: All tests pass (including new docsLoader and remarkDocsLinks tests)

- [ ] **Step 2: Run type check**

Run: `cd repos/website && pnpm types`
Expected: No type errors

- [ ] **Step 3: Run dev server and verify**

Run: `cd repos/website && pnpm start`

Manual checks:
1. Navigate to `http://localhost:5884/docs` — should render `docs/index.md` content
2. Sidebar should show 4 sections: Architecture, Features, User Guide, Business
3. Click "Platform Overview" — should render `docs/architecture/platform-overview.md`
4. Click through several pages — prev/next navigation should work
5. TOC (right side) should update on each page
6. Pages with images (e.g., Features > Proxy Endpoints) should display images
7. Links within docs (e.g., from index.md) should navigate correctly
8. Pages in excluded directories (superpowers, payments) should NOT appear in nav

- [ ] **Step 4: Run production build**

Run: `cd repos/website && pnpm build`
Expected: Build succeeds. Check `dist/docs-assets/` contains copied images.

- [ ] **Step 5: Preview production build**

Run: `cd repos/website && pnpm preview`
Verify: Same checks as Step 3 but against the production build.

---

## Key Design Decisions (Reference)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Glob path style | `@DOCS` alias (tsconfig paths → alias-hq → Vite resolve.alias) | Consistent with existing `@ROOT`, `@TAF`, `@TDM` patterns; not brittle relative paths |
| docs/index.md | Rendered as /docs landing page | Natural entry point, replaces redirect |
| Image strategy | Remark rewrite + Vite plugin (auto-copy) | Images stay next to docs in source; served automatically |
| Public images | Also supported via `public/images/docs/` | Fallback for manually referenced absolute paths |
| .md/.mdx support | Both loaded; .mdx preferred when both exist | All markdown treated as MDX by the pipeline |
| Business docs | Included (order 4) | Public-facing content per user decision |
| endpoints/, payments/ dirs | Excluded via no `_meta.json` | Not public-facing; content overlap with features/ |
| Navigation auto-discovery | _meta.json per dir; files without meta not in nav | New dirs with _meta.json auto-appear; internal dirs stay hidden |
