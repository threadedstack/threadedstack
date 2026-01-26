import path from 'node:path'
import { defineConfig } from 'tsup'
import { fileURLToPath } from 'node:url'
import { promises as fs } from 'node:fs'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(dirname, `..`)

type TWasmModule = `agent` | `sandbox`
const WasmModules = [`agent`, `sandbox`]

const locations = (name: `agent` | `sandbox`) => {
  return {
    root: rootDir,
    outdir: `dist/wasm`,
    tsout: path.join(rootDir, `dist/${name}`),
    tsin: path.join(rootDir, `src/wasm/${name}.ts`),
  }
}

export default defineConfig(async () => {
  const mod = process.env.WASM_MODULE_NAME as TWasmModule
  if (!WasmModules.includes(mod))
    throw new Error(`ENV "WASM_MODULE_NAME" must be set to 'agent' or 'sandbox'`)

  const paths = locations(mod)

  await fs.rm(paths.outdir, { recursive: true, force: true })

  return {
    clean: true,
    shims: true,
    name: `agent`,
    format: [`esm`],
    target: `esnext`,
    outDir: paths.tsout,
    entry: [paths.tsin],
    external: [`wasi:cli/environment@0.2.0`],
    async onSuccess() {
      console.log(`Module "@tdsk/agent" built successfully`)
    },
  }
})
