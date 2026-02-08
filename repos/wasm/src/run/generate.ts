/**
 * Generate a build-specific runWasm helper for WASM modules
 *
 * This builder creates a type-safe runner script that:
 * - Knows the exact exports from the WIT definition
 * - Properly loads core WASM modules from filesystem
 * - Provides correct TypeScript types for all exports/imports
 * - Handles preview2-shim integration
 *
 * The generated file is copied to the consuming repo's dist directory
 * alongside the generated .js and .wasm files from jco.
 */

import type { TWasmBuildOpts, TResolvedPaths } from '@TWA/types'

import path from 'node:path'
import { camelCase } from '@keg-hub/jsutils'
import { parseWit } from '@TWA/run/parseWit'
import { resolvePaths } from '@TWA/utils/paths'
import { readFile, writeFile } from 'node:fs/promises'
import { template, genericTemplate } from '@TWA/run/template'

/**
 * Result from generating runWasm file
 */
export type TGenerateRunWasmResult = {
  /** Path to generated runWasm file */
  path: string
  /** Success flag */
  success: boolean
}

export type TGenerateOpts = {
  name: string
  exports: string[]
  imports: string[]
  worldName: string
}

/**
 * Write the generated runWasm file to disk
 */
const writeRunFile = async (
  options: TWasmBuildOpts,
  paths: TResolvedPaths,
  generated: string
): Promise<TGenerateRunWasmResult> => {
  const { outdir } = paths
  const runJsPath = path.join(outdir, `${paths.name}.run.ts`)

  await writeFile(runJsPath, generated, `utf-8`)

  if (!options.quiet) {
    console.log(`\n✅ runWasm helper generated!`)
    console.log(`📦 Import from: ${runJsPath}`)
    console.log(
      `🔗 Use: import { run${camelCase(paths.name)} } from './${paths.name}.run.js'`
    )
  }

  return {
    success: true,
    path: runJsPath,
  }
}

/**
 * Generate the runWasm file for a WASM build
 *
 * This function:
 * 1. Parses the WIT world definition
 * 2. Extracts export names and import interfaces
 * 3. Generates a type-safe runner script
 * 4. Writes it to the output directory
 *
 * @param options - Build options
 * @param paths - Resolved paths (optional, will resolve if not provided)
 * @returns Promise resolving to generation result
 */
export const generate = async (
  options: TWasmBuildOpts,
  paths?: TResolvedPaths
): Promise<TGenerateRunWasmResult> => {
  !options.quiet && console.log(`📝 Generating runWasm helper...`)

  paths = paths || (await resolvePaths(options))

  // Parse WIT file to extract exports and imports
  const witContent = await readFile(paths.witin, `utf-8`)
  const world = parseWit(witContent)

  if (!world) {
    !options.quiet &&
      console.warn(`⚠️  No world found in WIT file, generating generic runner`)

    // Generate a generic runner without type information
    const built = genericTemplate(paths.name)
    return writeRunFile(options, paths, built)
  }

  if (!options.quiet) {
    console.log(` Found world: ${world.name}`)
    console.log(
      ` Exports: ${world.exports.length > 0 ? world.exports.join(', ') : `none`}`
    )
    console.log(
      ` Import interfaces: ${world.imports.length > 0 ? world.imports.join(`, `) : `none`}`
    )
  }

  const generated = template({
    name: paths.name,
    worldName: world.name,
    exports: world.exports,
    imports: world.imports,
  })

  // Write the generated file
  return writeRunFile(options, paths, generated)
}
