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
      .filter(
        (p) =>
          p.startsWith(dirPrefix) && !p.includes('/images/') && !p.endsWith('/_meta.json')
      )
      .map((p) => {
        const slug = p.replace(dirPrefix, '').replace(/\.(md|mdx)$/, '')
        return {
          slug,
          label: toTitleCase(slug),
          path: `/docs/${dir}/${slug}`,
        }
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
          const file = dirFiles.find((f) => f.slug === slug)
          if (!file) return null
          return { ...file, label: customLabels[slug] || file.label }
        })
        .filter((item): item is DocNavItem => item !== null)

      const remaining = dirFiles
        .filter((f) => !pageOrder.includes(f.slug))
        .sort((a, b) => a.slug.localeCompare(b.slug))

      orderedItems = [...ordered, ...remaining]
    } else {
      orderedItems = [...dirFiles].sort((a, b) => a.slug.localeCompare(b.slug))
    }

    sections.push({
      label: meta.label,
      slug: dir,
      order: meta.order,
      items: orderedItems,
    })
  }

  sections.sort((a, b) => a.order - b.order)
  return { sections, allPages: sections.flatMap((s) => s.items) }
}

export function findContentModule(
  slug: string,
  contentModules: Record<string, () => Promise<{ default: React.ComponentType }>>,
  docsPrefix: string
) {
  const paths = [
    `${docsPrefix}${slug}.mdx`,
    `${docsPrefix}${slug}.md`,
    `${docsPrefix}${slug}/index.mdx`,
    `${docsPrefix}${slug}/index.md`,
  ]
  const match = paths.find((p) => contentModules[p])
  return match ? contentModules[match] : null
}
