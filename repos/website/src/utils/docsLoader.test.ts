import { describe, it, expect } from 'vitest'
import { toTitleCase, buildNavigation, findContentModule } from './docsLoader'

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
    expect(feat.items.every((i) => !i.slug.includes('.'))).toBe(true)
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
    const allSlugs = sections.flatMap((s) => s.items.map((i) => i.slug))
    expect(allSlugs).not.toContain('index')
  })

  it('derives correct section slug from directory name', () => {
    const { sections } = buildNavigation(mockMeta, mockContentKeys, DOCS_PREFIX)
    expect(sections[0].slug).toBe('architecture')
    expect(sections[1].slug).toBe('features')
  })

  it('returns empty sections and allPages when metaModules is empty', () => {
    const { sections, allPages } = buildNavigation({}, mockContentKeys, DOCS_PREFIX)
    expect(sections).toHaveLength(0)
    expect(allPages).toHaveLength(0)
  })

  it('returns section with empty items when no content files match', () => {
    const { sections } = buildNavigation(mockMeta, [], DOCS_PREFIX)
    expect(sections).toHaveLength(2)
    expect(sections[0].items).toHaveLength(0)
    expect(sections[1].items).toHaveLength(0)
  })

  it('excludes image paths from navigation items', () => {
    const keysWithImages = [
      ...mockContentKeys,
      `${DOCS_PREFIX}architecture/images/diagram.png`,
    ]
    const { sections } = buildNavigation(mockMeta, keysWithImages, DOCS_PREFIX)
    const allSlugs = sections.flatMap((s) => s.items.map((i) => i.slug))
    expect(allSlugs).not.toContain('diagram')
  })

  it('silently skips pages entries that reference non-existent files', () => {
    const metaWithGhost = {
      [`${DOCS_PREFIX}guides/_meta.json`]: {
        label: 'Guides',
        order: 1,
        pages: ['exists', 'ghost'],
      },
    }
    const keys = [`${DOCS_PREFIX}guides/exists.md`]
    const { sections } = buildNavigation(metaWithGhost, keys, DOCS_PREFIX)
    expect(sections[0].items).toHaveLength(1)
    expect(sections[0].items[0].slug).toBe('exists')
  })
})

describe('findContentModule', () => {
  const DOCS_PREFIX = '@DOCS/'

  const mockLoader = () =>
    Promise.resolve({ default: (() => null) as React.ComponentType })

  it('returns loader for exact .mdx match', () => {
    const modules = { [`${DOCS_PREFIX}features/agents.mdx`]: mockLoader }
    const result = findContentModule('features/agents', modules, DOCS_PREFIX)
    expect(result).toBe(mockLoader)
  })

  it('returns loader for exact .md match when no .mdx exists', () => {
    const modules = { [`${DOCS_PREFIX}features/billing.md`]: mockLoader }
    const result = findContentModule('features/billing', modules, DOCS_PREFIX)
    expect(result).toBe(mockLoader)
  })

  it('prefers .mdx over .md when both exist', () => {
    const mdxLoader = () =>
      Promise.resolve({ default: (() => 'mdx') as unknown as React.ComponentType })
    const mdLoader = () =>
      Promise.resolve({ default: (() => 'md') as unknown as React.ComponentType })
    const modules = {
      [`${DOCS_PREFIX}features/agents.mdx`]: mdxLoader,
      [`${DOCS_PREFIX}features/agents.md`]: mdLoader,
    }
    const result = findContentModule('features/agents', modules, DOCS_PREFIX)
    expect(result).toBe(mdxLoader)
  })

  it('falls back to index.mdx for directory-style slugs', () => {
    const modules = { [`${DOCS_PREFIX}architecture/index.mdx`]: mockLoader }
    const result = findContentModule('architecture', modules, DOCS_PREFIX)
    expect(result).toBe(mockLoader)
  })

  it('falls back to index.md when no index.mdx exists', () => {
    const modules = { [`${DOCS_PREFIX}architecture/index.md`]: mockLoader }
    const result = findContentModule('architecture', modules, DOCS_PREFIX)
    expect(result).toBe(mockLoader)
  })

  it('returns null when no module matches', () => {
    const result = findContentModule('nonexistent/page', {}, DOCS_PREFIX)
    expect(result).toBeNull()
  })

  it('prefers direct file over index file', () => {
    const directLoader = () =>
      Promise.resolve({ default: (() => 'direct') as unknown as React.ComponentType })
    const indexLoader = () =>
      Promise.resolve({ default: (() => 'index') as unknown as React.ComponentType })
    const modules = {
      [`${DOCS_PREFIX}architecture.mdx`]: directLoader,
      [`${DOCS_PREFIX}architecture/index.mdx`]: indexLoader,
    }
    const result = findContentModule('architecture', modules, DOCS_PREFIX)
    expect(result).toBe(directLoader)
  })
})
