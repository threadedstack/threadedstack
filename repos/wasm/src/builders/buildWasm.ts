/**
 * Build utilities for TypeScript to WebAssembly compilation
 */

import type { TWasmBuildOpts, TWasmBuildResult } from '@TWA/types'

import { jco } from '@TWA/builders/jco'
import { esb } from '@TWA/builders/esbuild'
import { resolvePaths } from '@TWA/utils/paths'
import { componentizeJs } from '@TWA/builders/componentize'

/**
 * Build a complete WASM module from TypeScript source
 *
 * Orchestrates the four-step build pipeline:
 * 1. TypeScript → JavaScript (esbuild)
 * 2. JavaScript → WASM (componentize-js)
 * 3. WASM → JS bindings (jco)
 * 4. Generate runWasm helper (type-safe runner)
 *
 * @param options - Build configuration options
 * @returns Build result with output paths or error
 *
 * @example
 * const result = await buildWasm({
 *   root: process.cwd(),
 *   name: 'my-module',
 * })
 *
 * if (result.success) {
 *   console.log(`Built: ${result.jsout}`)
 *   console.log(`Run helper: ${result.runJsPath}`)
 * } else {
 *   console.error(`Build failed:`, result.error)
 * }
 */
export const buildWasm = async (options: TWasmBuildOpts): Promise<TWasmBuildResult> => {
  // Resolve all paths from options
  const paths = await resolvePaths(options)

  !options.quiet && console.log(`🔨 Building WASM module: ${paths.name}`)

  // Step 1: TypeScript → JavaScript
  const ts = await esb(options, paths)

  // Step 2: JavaScript → WASM
  const wasm = await componentizeJs(options, paths)

  // Step 3: WASM → JS bindings
  const js = await jco(options, paths)

  return {
    success: true,
    jsin: ts.jsin,
    jsout: js.jsout,
    wasmout: wasm.wasmout,
  }
}
