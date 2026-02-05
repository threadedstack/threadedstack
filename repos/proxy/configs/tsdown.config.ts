import type { UserConfig } from 'tsdown'

import path from 'node:path'
import { fileURLToPath } from 'url'
import packcfg from '../package.json'
import { defineConfig } from 'tsdown'
import { promises as fs } from 'node:fs'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, `..`)
const outdir = path.join(rootDir, `dist`)

const fileIO = [`index`, `proxy`]

const cleanup = async () => {
  return Promise.all(
    fileIO.map(async (name) => {
      const outfile = path.join(rootDir, `dist/${name}.js`)
      await fs.rm(outfile, { recursive: true, force: true })
      await fs.rm(`${outfile}.map`, { recursive: true, force: true })
    })
  )
}

export default defineConfig(async () => {
  await cleanup()

  return {
    clean: true,
    name: `proxy`,
    outDir: outdir,
    format: [`cjs`],
    sourcemap: true,
    splitting: false,
    entry: fileIO.map((name) => path.join(rootDir, `src/${name}.ts`)),
    //external: [
    //  ...Object.keys(packcfg.dependencies || {}),
    //  ...Object.keys(packcfg.devDependencies || {}),
    //].filter((name) => !name.startsWith(`@tdsk`) && !name.startsWith(`@keg-hub`)),
  } as UserConfig
})
