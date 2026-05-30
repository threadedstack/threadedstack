import { buildNavigation, findContentModule as _findContentModule } from './docsLoader'

type MetaConfig = {
  label: string
  order: number
  pages?: (string | { slug: string; label: string })[]
}

const metaModules = import.meta.glob(['@DOCS/**/_meta.json', '!@DOCS/internal/**'], {
  eager: true,
  import: 'default',
}) as Record<string, MetaConfig>

export const contentModules = import.meta.glob([
  '@DOCS/*/**/*.md',
  '@DOCS/*/**/*.mdx',
  '@DOCS/index.md',
  '@DOCS/index.mdx',
  '!@DOCS/internal/**',
]) as Record<string, () => Promise<{ default: React.ComponentType }>>

// Vite resolves @DOCS alias in glob patterns but uses the resolved relative path as keys
// (e.g. "../../docs/architecture/platform-overview.md" not "@DOCS/architecture/...")
// Derive the actual prefix from the first meta key so all path math uses the real prefix
const metaKeys = Object.keys(metaModules)
const DOCS_PREFIX =
  metaKeys.length > 0 ? metaKeys[0].replace(/[^/]+\/_meta\.json$/, '') : '@DOCS/'

const { sections, allPages } = buildNavigation(
  metaModules,
  Object.keys(contentModules),
  DOCS_PREFIX
)

export { sections, allPages, DOCS_PREFIX }

export function findContentModule(slug: string) {
  return _findContentModule(slug, contentModules, DOCS_PREFIX)
}
