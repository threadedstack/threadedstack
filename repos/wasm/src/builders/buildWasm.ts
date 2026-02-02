/**
 * Build utilities for TypeScript to WebAssembly compilation
 */

import type { TWasmBuildOpts, TWasmBuildResult } from '@TWA/types'

import { toJS } from '@TWA/builders/toJS'
import { fromTS } from '@TWA/builders/fromTS'
import { toWasm } from '@TWA/builders/toWasm'
import { resolvePaths } from '@TWA/utils/paths'

/**
 * Build a complete WASM module from TypeScript source
 *
 * Orchestrates the three-step build pipeline:
 * 1. TypeScript → JavaScript (esbuild)
 * 2. JavaScript → WASM (componentize-js)
 * 3. WASM → JS bindings (jco)
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
 * } else {
 *   console.error(`Build failed:`, result.error)
 * }
 */
export const buildWasm = async (options: TWasmBuildOpts): Promise<TWasmBuildResult> => {

  // Resolve all paths from options
  const paths = await resolvePaths(options)

  !options.quiet && console.log(`🔨 Building WASM module: ${paths.name}`)

  // Step 1: TypeScript → JavaScript
  const ts = await fromTS(options, paths)

  // Step 2: JavaScript → WASM
  const wasm = await toWasm(options, paths)

  // Step 3: WASM → JS bindings
  const js = await toJS(options, paths)

  return {
    success: true,
    jsin: ts.jsin,
    jsout: js.jsout,
    wasmout: wasm.wasmout,
  }

}
