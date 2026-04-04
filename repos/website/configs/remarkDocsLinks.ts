import path from 'node:path'
import { visit } from 'unist-util-visit'
import type { Root, Link, Image } from 'mdast'

type VFile = { path?: string }
type RemarkDocsLinksOptions = { docsRoot: string }

export function remarkDocsLinks(options: RemarkDocsLinksOptions) {
  const { docsRoot } = options

  return (tree: Root, file: VFile) => {
    if (!file.path) {
      console.warn(
        '[remarkDocsLinks] Skipping file with no path — links will not be rewritten'
      )
      return
    }

    const fileDir = path.dirname(path.relative(docsRoot, file.path))

    visit(tree, 'link', (node: Link) => {
      const { url } = node
      if (!url || url.startsWith('http') || url.startsWith('#') || url.startsWith('/'))
        return

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
