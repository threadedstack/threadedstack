import path from 'node:path'
import fs from 'node:fs'
import type { Plugin, ResolvedConfig, ViteDevServer } from 'vite'

type DocsAssetsOptions = { docsRoot: string }

const SkipDirs = [
  'superpowers',
  'node_modules',
  'plans',
  'meta',
  'payments',
  'tech',
  'endpoints',
]

export function vitePluginDocsAssets(options: DocsAssetsOptions): Plugin {
  const { docsRoot } = options
  let resolvedOutDir: string

  return {
    name: 'vite-plugin-docs-assets',

    configResolved(config: ResolvedConfig) {
      if (config.command === 'build') {
        resolvedOutDir = path.resolve(config.root, config.build.outDir)
      }
    },

    configureServer(server: ViteDevServer) {
      server.middlewares.use('/docs-assets', (req, res, next) => {
        const filePath = path.resolve(path.join(docsRoot, req.url || ''))
        if (!filePath.startsWith(docsRoot)) {
          res.statusCode = 403
          res.end('Forbidden')
          return
        }
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
          const stream = fs.createReadStream(filePath)
          stream.on('error', (err) => {
            console.error(`[docs-assets] Failed to read ${filePath}:`, err.message)
            if (!res.headersSent) {
              res.statusCode = 500
              res.end('Internal Server Error')
            }
          })
          stream.pipe(res)
        } else {
          next()
        }
      })
    },

    closeBundle() {
      if (!resolvedOutDir) return
      const assetDir = path.join(resolvedOutDir, 'docs-assets')
      copyImages(docsRoot, docsRoot, assetDir)
    },
  }
}

function copyImages(dir: string, docsRoot: string, outDir: string) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SkipDirs.includes(entry.name)) continue
      copyImages(fullPath, docsRoot, outDir)
    } else if (/\.(png|jpe?g|gif|svg|webp)$/i.test(entry.name)) {
      const relPath = path.relative(docsRoot, fullPath)
      const destPath = path.join(outDir, relPath)
      try {
        fs.mkdirSync(path.dirname(destPath), { recursive: true })
        fs.copyFileSync(fullPath, destPath)
      } catch (err: any) {
        console.error(`[docs-assets] Failed to copy ${relPath}: ${err.message}`)
        throw err
      }
    }
  }
}
