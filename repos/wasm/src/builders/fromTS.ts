/**
 * Compile TypeScript to JavaScript with esbuild
 */

import type { TResolvedPaths, TWasmBuildOpts } from '@TWA/types'

import { build } from 'esbuild'
import { defineEnv } from "unenv"
import { resolvePaths } from '@TWA/utils/paths'
import { overrides } from '@TWA/polyfills/inject'
import { injectBanner } from '@TWA/polyfills/banner'
import { flatUnion } from '@keg-hub/jsutils/flatUnion'

export interface FromTSResult {
  jsin: string
  success: boolean
}

/**
 * Build TypeScript to JavaScript with esbuild
 *
 * Compiles TypeScript source to bundled JavaScript, injects polyfills,
 * and prepares it for WASM componentization.
 *
 * @param options - Build options
 * @param paths - Resolved paths
 * @returns Compilation result with output path
 */
export async function fromTS(
  options: TWasmBuildOpts,
  paths?: TResolvedPaths
): Promise<FromTSResult> {
  
  paths = paths || await resolvePaths(options)

  !options.quiet && console.log(`📝 Compiling TypeScript to JavaScript with esbuild...`)

  const polyfills = defineEnv({})
  const banner = await injectBanner(options?.esbuild?.banner)
  const external = flatUnion(
    [`wasi:*`, ...polyfills.env.external],
    options?.esbuild?.external
  )


  await build({
    platform: `neutral`,
    mainFields: [`browser`, `module`, `main`],
    conditions: [`browser`, `module`, `import`],
    logLevel: options.quiet ? `error` : `info`,
    ...options?.esbuild,
    external,
    bundle: true,
    format: `esm`,
    target: `esnext`,
    outfile: paths.jsin,
    tsconfig: paths.tsconfig,
    entryPoints: [paths.tsin],
    inject: [
      overrides
    ],
    banner: {
      js: banner,
    },
    alias: {
      ...polyfills.env.alias,
      ...(options?.esbuild?.alias || {}),
    },
  })

  !options.quiet && console.log(`✅ TypeScript compiled: ${paths.jsin}`)

  return {
    success: true,
    jsin: paths.jsin,
  }

}

