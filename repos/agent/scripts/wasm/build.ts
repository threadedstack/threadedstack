/**
 * Build script to compile TypeScript -> WASM Component
 *
 * This is a minimal wrapper around @tdsk/wasm's buildWasm function.
 * All build logic, polyfills, and configuration is handled by @tdsk/wasm.
 *
 * Usage:
 *   pnpm build:wasm agent
 *   pnpm build:wasm sandbox
 */

import { buildWasm } from '@tdsk/wasm'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const root = join(__dirname, `../..`)

const args = process.argv.slice(2)
const name = args[0] as `agent` | `sandbox`

if (name !== `agent` && name !== `sandbox`) {
  throw new Error(`First argument must be "agent" or "sandbox"`)
}

await buildWasm({
  root,
  name,
  tsin: `src/wasm/${name}.ts`,
  polyfills: {
    all: true,
  },
})
