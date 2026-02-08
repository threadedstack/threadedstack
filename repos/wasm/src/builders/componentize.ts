/**
 * JavaScript to WebAssembly componentization
 */

import type { TResolvedPaths, TWasmBuildOpts } from '@TWA/types'

import { writeFile, mkdir } from 'node:fs/promises'
import { capitalize } from '@keg-hub/jsutils/capitalize'
import { resolvePaths, getWorldName } from '@TWA/utils/paths'
import { componentize } from '@bytecodealliance/componentize-js'

export interface ToWasmResult {
  wasmout: string
  success: boolean
}

/**
 * Build JavaScript to WASM component with componentize-js
 *
 * Converts compiled JavaScript to a WebAssembly component using
 * the WIT interface definition.
 *
 * @param options - Build options
 * @param paths - Resolved paths
 * @returns Componentization result with output path
 */
export const componentizeJs = async (
  options: TWasmBuildOpts,
  paths?: TResolvedPaths
): Promise<ToWasmResult> => {
  paths = paths || (await resolvePaths(options))

  if (!options.quiet) {
    console.log(`🔨 Building WASM ${capitalize(paths.name)} Component...`)
    console.log(`⚙️  Componentizing JavaScript to WASM...`)
  }

  const world = await getWorldName(options, paths)
  const { component } = await componentize({
    worldName: world,
    witPath: paths.witdir,
    sourcePath: paths.jsin,
    // @ts-ignore
    sourceName: paths.jsname,
  })

  !options.quiet && console.log(`💾 Writing WASM component...`)

  const { outdir, wasmout } = paths
  await mkdir(outdir, { recursive: true })
  await writeFile(wasmout, component)

  !options.quiet && console.log(`✅ WASM component built successfully: ${wasmout}`)

  return {
    success: true,
    wasmout: wasmout,
  }
}
