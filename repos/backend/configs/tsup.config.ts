import path from 'node:path'
import { defineConfig } from 'tsup'
import packcfg from '../package.json'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, `..`)
const outdir = path.join(rootDir, `dist`)
const entry = path.join(rootDir, `src/index.ts`)
// Standalone MITM egress service — same image, separate process (dist/egress.cjs)
const egressEntry = path.join(rootDir, `src/egress.ts`)

const getExternal = () => {
  return [
    `openai`,
    `isolated-vm`,
    `@google/genai`,
    `@anthropic-ai/sdk`,
    // just-bash transitive deps that can't be bundled (native addons / optional browser deps)
    `@mongodb-js/zstd`,
    `node-liblzma`,
    `@mixmark-io/domino`,
    `sql.js`,
    ...Object.keys(packcfg.dependencies || {}),
    ...Object.keys(packcfg.devDependencies || {}),
  ].filter(
    (name) =>
      !name.startsWith(`@tdsk`) &&
      !name.startsWith(`@keg-hub`) &&
      !name.startsWith(`@earendil-works`)
  )
}

export default defineConfig(async () => {
  await fs.rm(outdir, { recursive: true, force: true })

  return {
    clean: true,
    shims: true,
    name: `backend`,
    sourcemap: true,
    splitting: false,
    outDir: outdir,
    format: [`cjs`],
    entry: [entry, egressEntry],
    noExternal: [/(.*)/],
    esbuildOptions: (options, context) => {
      options && (options.external = getExternal())
    },
    async onSuccess() {
      console.log(`Module "@tdsk/backend" built successfully`)
    },
  }
})
