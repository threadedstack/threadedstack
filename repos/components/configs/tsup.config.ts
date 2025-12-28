import path from 'node:path'
import { defineConfig } from 'tsup'
import packcfg from '../package.json'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'
import { getEntries } from '../scripts/getEntries'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, `..`)
const outdir = path.join(rootDir, `dist`)

export default defineConfig(async () => {
  await fs.rm(outdir, { recursive: true, force: true })

  const entries = await getEntries({
    ignore: [`**/__tests__/**`, `**/__mocks__/**`],
  })

  return {
    dts: true,
    clean: true,
    //minify: true,
    entry: entries,
    treeshake: true,
    sourcemap: true,
    splitting: true,
    outDir: outdir,
    legacyOutput: true,
    format: [`cjs`, `esm`],
    name: `@tdsk/components`,
    esbuildOptions: (options, context) => {
      options.external = [
        ...Object.keys(packcfg.dependencies || {}),
        ...Object.keys(packcfg.devDependencies || {}),
        // @ts-ignore
        ...Object.keys(packcfg.peerDependencies || {}),
      ]
    },
  }
})
