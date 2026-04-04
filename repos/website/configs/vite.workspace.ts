import '../scripts/registerPaths'

import path from 'node:path'
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import react from '@vitejs/plugin-react-swc'
import { loadConfig } from './website.config'
import viteTsconfigPaths from 'vite-tsconfig-paths'
import { svgrComponent } from 'vite-plugin-svgr-component'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import { remarkDocsLinks } from './remarkDocsLinks'
import { vitePluginDocsAssets } from './vitePluginDocsAssets'

const rootDir = path.join(__dirname, '..')
const { aliases, envs, port, environment } = loadConfig()
const docsRoot = aliases['@DOCS']
if (!docsRoot || typeof docsRoot !== 'string') {
  throw new Error(
    `Missing @DOCS alias. Ensure tsconfig.json has "@DOCS": ["../../docs"] in compilerOptions.paths`
  )
}

/**
 * Load from the local process.env
 * Then from deploy/values.yaml
 * Or default to `/`
 */
export const basePath =
  process.env.TDSK_WEB_BASE_PATH || envs[`process.env.TDSK_WEB_BASE_PATH`] || `/`

export const config = {
  root: rootDir,
  base: basePath,
  server: {
    port,
    fs: {
      allow: [rootDir, docsRoot],
    },
  },
  preview: {
    port,
  },
  optimizeDeps: {
    esbuildOptions: {
      target: `esnext`,
      jsx: `automatic` as const,
      jsxDev: environment !== `production`,
    },
    entries: [`hoist-non-react-statics`],
  },
  resolve: {
    alias: aliases,
  },
  plugins: [
    {
      name: `resolve-docs-imports`,
      enforce: `pre` as const,
      async resolveId(source, importer, options) {
        if (
          importer &&
          importer.replace(/\?.*$/, ``).startsWith(docsRoot) &&
          !source.startsWith(`.`) &&
          !source.startsWith(`/`)
        ) {
          const resolved = await this.resolve(source, path.join(rootDir, `index.html`), {
            ...options,
            skipSelf: true,
          })
          return resolved
        }
        return null
      },
    },
    mdx({
      remarkPlugins: [remarkGfm, [remarkDocsLinks, { docsRoot }]],
      providerImportSource: `@mdx-js/react`,
      rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, { behavior: `wrap` }]],
    }),
    react(),
    viteTsconfigPaths({
      root: rootDir,
      projects: [
        rootDir,
        path.join(rootDir, `../domain`),
        path.join(rootDir, `../database`),
        path.join(rootDir, `../components`),
      ],
    }),
    svgrComponent({
      svgrOptions: {
        ref: true,
        icon: true,
        expandProps: true,
        dimensions: false,
      },
    }),
    vitePluginDocsAssets({ docsRoot }),
  ],
  build: {
    outDir: `dist`,
    minify: false,
    emptyOutDir: true,
  },
  define: envs,
  clearScreen: false,
  test: {
    watch: false,
    environment: `jsdom`,
    setupFiles: `./scripts/setupTests.ts`,
    alias: aliases,
    server: {
      deps: {
        inline: [`mui-image-alter`],
      },
    },
  },
}
