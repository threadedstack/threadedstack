import path from 'node:path'
import { defineConfig } from 'tsup'
import packcfg from '../package.json'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, `..`)
const outdir = path.join(rootDir, `dist`)
const entry = path.join(rootDir, `src/index.ts`)

const getExternal = () => {
  return [
    ...Object.keys(packcfg.dependencies || {}),
    ...Object.keys(packcfg.devDependencies || {}),
  ].filter((name) => !name.startsWith(`@tdsk`) && !name.startsWith(`@keg-hub`))
}

export default defineConfig(async () => {
  await fs.rm(outdir, { recursive: true, force: true })

  return {
    clean: true,
    shims: true,
    name: `proxy`,
    sourcemap: true,
    splitting: false,
    outDir: outdir,
    format: [`cjs`],
    entry: [entry],
    noExternal: [/(.*)/],
    esbuildOptions: (options, context) => {
      options && (options.external = getExternal())
    },
    async onSuccess() {
      console.log(`Module "@tdsk/proxy" built successfully`)
    },
  }
})
