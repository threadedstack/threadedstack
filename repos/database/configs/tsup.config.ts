import packcfg from '../package.json' assert { type: 'json' }
import path from 'node:path'
import { defineConfig } from 'tsup'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, `..`)
const logOutdir = path.join(rootDir, `dist/log`)
const logIn = path.join(rootDir, `src/index.ts`)

export default defineConfig(async () => {
  await fs.rm(logOutdir, { recursive: true, force: true })
  
  return {
    name: `database`,
    clean: true,
    entry: [logIn],
    sourcemap: true,
    splitting: false,
    format: [`cjs`],
    outDir: logOutdir,
    esbuildOptions:(options, context) => {
      options.external = [
        ...(options?.external ?? []),
        ...(Object.keys(packcfg.dependencies) ?? []),
        ...(Object.keys(packcfg.devDependencies) ?? []),
      ]
    },
    async onSuccess() {
      console.log(`Module "@tdsk/database" built successfully`)
    },
  }
})