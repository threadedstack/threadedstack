import path from 'node:path'
import { defineConfig } from 'tsup'
import packcfg from '../package.json'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(dirname, `..`)
const outdir = path.join(root, `dist`)
const entry = path.join(root, `src/index.ts`)

const getExternal = () => {
  const peerDeps = Object.keys(packcfg.peerDependencies || {})
  const deps = Object.keys(packcfg.dependencies || {})

  return [
    ...peerDeps, // esbuild, @keg-hub/jsutils
    ...deps, // @bytecodealliance/* packages
  ].filter((name) => !name.startsWith(`@tdsk`))
}

export default defineConfig(async () => {
  await fs.rm(outdir, { recursive: true, force: true })

  return {
    clean: true,
    shims: true,
    name: `wasm`,
    sourcemap: true,
    splitting: false,
    dts: false, // Disabled due to preview2-shim type issues
    outDir: outdir,
    format: [`esm`, `cjs`],
    noExternal: [/(.*)/],
    entry: [entry],
    esbuildOptions: (options, context) => {
      options && (options.external = getExternal())
    },
    async onSuccess() {
      // Copy polyfills to dist directory
      const polyfillsSrc = path.join(root, `src/polyfills`)
      const polyfillsDest = path.join(outdir, `polyfills`)
      await fs.cp(polyfillsSrc, polyfillsDest, { recursive: true, force: true })
      console.log(`Module "@tdsk/wasm" built successfully`)
      console.log(`Polyfills copied to dist/polyfills/`)
    },
  }
})
