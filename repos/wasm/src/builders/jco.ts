/**
 * WebAssembly to JavaScript transpilation with jco
 */

import type { TWasmBuildOpts, TResolvedPaths } from '@TWA/types'

import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { resolvePaths } from '@TWA/utils/paths'
import { ImportMap } from '@TWA/polyfills/importMap'

/**
 * Resolves the full path to the jco executable
 * If the jco package changes, this should be updates as well
 */
const getJcoPath = () => {
  const require = createRequire(import.meta.url)
  const location = path.dirname(require.resolve(`@bytecodealliance/jco`))
  return path.join(location, `jco.js`)
}

/**
 * Result from JS transpilation
 */
export interface ToJSResult {
  /** Path to transpiled JavaScript file */
  jsout: string
  /** Success flag */
  success: boolean
  /** Error if transpilation failed */
  error?: Error
}

const buildMap = () => {
  return Object.entries(ImportMap).reduce((acc, [key, value]) => {
    acc.push(`--map`, `${key}=${value}`)
    return acc
  }, [] as string[])
}

/**
 * Transpile WASM component to JavaScript bindings with jco
 *
 * Generates JavaScript bindings that can be imported by the host.
 * Uses --instantiation flag to generate an instantiate() function
 * for runtime import injection.
 *
 * @param options - Build options
 * @param paths - Resolved paths
 * @returns Promise that resolves when transpilation completes
 */
export const jco = async (
  options: TWasmBuildOpts,
  paths?: TResolvedPaths
): Promise<ToJSResult> => {
  return new Promise(async (resolve, reject) => {
    !options.quiet && console.log(`🔄 Transpiling WASM to JS bindings...`)

    paths = paths || (await resolvePaths(options))

    const { outdir, wasmout, jsout } = paths

    const args = [
      getJcoPath(),
      `transpile`,
      wasmout,
      `-o`,
      outdir,
      //...buildMap(),
      `--instantiation`,
    ]
    options.quiet && args.push(`--quiet`)

    const proc = spawn(`node`, args, {
      cwd: paths.root,
      stdio: `inherit`,
    })

    proc.on(`close`, async (code) => {
      if (code === 0) {
        if (!options.quiet) {
          console.log(`\n✅ Transpilation complete!`)
          console.log(`📦 Import from: ${jsout}`)
          console.log(`🔗 Use wasmModule.instantiate(imports) to inject capabilities`)
        }

        resolve({
          jsout: jsout,
          success: true,
        })
      } else {
        const error = new Error(`jco transpilation failed with exit code ${code}`)
        !options.quiet && console.error(`❌ Transpilation failed:`, error.message)
        reject(error)
      }
    })

    proc.on(`error`, (error) => {
      !options.quiet && console.error(`❌ Failed to start jco process:`, error.message)
      reject(error)
    })
  })
}
