import path from 'node:path'
import { defineConfig } from 'tsup'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, `..`)
const outdir = path.join(rootDir, `dist`)
const entry = path.join(rootDir, `src/index.ts`)

/**
 * The resident runtime ships as ONE self-contained CommonJS file: the resident
 * pod launcher runs `node repos/resident/dist/index.js` straight off the
 * monorepo clone (see repos/sandbox/src/kube/podManifest.ts), so the bundle
 * must carry every dependency (workspace source included) — no install step,
 * no node_modules resolution at runtime.
 */
export default defineConfig(async () => {
  await fs.rm(outdir, { recursive: true, force: true })

  return {
    clean: true,
    shims: true,
    name: `resident`,
    sourcemap: true,
    splitting: false,
    outDir: outdir,
    format: [`cjs`],
    entry: [entry],
    noExternal: [/(.*)/],
    async onSuccess() {
      console.log(`Module "@tdsk/resident" built successfully`)
    },
  }
})
