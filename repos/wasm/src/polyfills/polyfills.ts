/**
 * Polyfill Registry System for @tdsk/wasm
 *
 * Manages internal and custom polyfills for WASM builds.
 * Supports flexible registration with all, include, exclude, and custom options.
 */

import type { TPolyfillCfg } from '@TWA/types'
import { ImportMap } from '@TWA/polyfills/importMap'


/**
 * Registered polyfills (global state)
 * Can be modified via registerPolyfills()
 */
let registeredPolyfills: Record<string, string> = { ...ImportMap }

/**
 * Register polyfills globally
 *
 * Merges custom polyfills with internal ones.
 * Custom polyfills override internal ones with the same name.
 *
 * @param config - Polyfill configuration
 *
 * @example
 * // Use all internal polyfills
 * registerPolyfills({ all: true })
 *
 * @example
 * // Use specific polyfills
 * registerPolyfills({ include: ['process', 'zlib'] })
 *
 * @example
 * // Use all except some
 * registerPolyfills({ all: true, exclude: ['vm'] })
 *
 * @example
 * // Custom polyfills override internal
 * registerPolyfills({
 *   custom: {
 *     'node:fs': '/custom/path/to/fs-polyfill.js'
 *   }
 * })
 */
export const registerPolyfills = (config: TPolyfillCfg = {}): void => {
  registeredPolyfills = getPolyfills(config)
}

/**
 * Get registered polyfills based on configuration
 *
 * Returns the current polyfill registry, applying config on-the-fly
 * without modifying the global state.
 *
 * @param config - Polyfill configuration
 * @returns Map of module names to file paths
 *
 * @example
 * const polyfills = getPolyfills({ all: true })
 * // { process: '/path/to/process.ts', zlib: '/path/to/zlib.js', ... }
 */
export const getPolyfills = (config: TPolyfillCfg = {}): Record<string, string> => {
  const {
    all = false,
    custom = {},
    include = [],
    exclude = [],
  } = config

  let polyfills: Record<string, string> = { ...registeredPolyfills }

  // If no config and no registered polyfills, return empty
  if (Object.keys(polyfills).length === 0 && !all && include.length === 0)
    return {}

  // all: Include all internal polyfills
  if (all) polyfills = { ...ImportMap }

  // include: Only specified polyfills
  if (include?.length) {
    polyfills = {}
    for (const name of include)
      if (ImportMap[name]) polyfills[name] = ImportMap[name]
  }

  // exclude: Remove specified polyfills
  if (exclude?.length)
    for (const name of exclude)
      delete polyfills[name]

  // custom: Override with custom polyfills (takes precedence)
  for (const [name, path] of Object.entries(custom))
    polyfills[name] = path

  return polyfills
}

/**
 * Get list of available internal polyfill names
 *
 * Returns both 'node:' prefixed and non-prefixed names.
 *
 * @returns Array of unique polyfill module names
 *
 * @example
 * const available = getAvailablePolyfills()
 * // ['process', 'node:process', 'zlib', 'node:zlib', 'assert', ...]
 */
export const getAvailablePolyfills = (): string[] => {
  return Object.keys(ImportMap)
}



/**
 * Generate esbuild alias configuration from polyfills
 *
 * Converts polyfill registry to esbuild alias format.
 * Supports both 'node:' and non-'node:' module names.
 *
 * @param config - Polyfill configuration
 * @returns esbuild alias object
 *
 * @example
 * const aliases = getEsbuildAliases({ all: true })
 * // {
 * //   'process': '/path/to/polyfills/process.ts',
 * //   'node:process': '/path/to/polyfills/process.ts',
 * //   'zlib': '/path/to/polyfills/zlib.js',
 * //   ...
 * // }
 *
 * @example
 * // Use with esbuild
 * await esbuild.build({
 *   alias: getEsbuildAliases({ all: true })
 * })
 */
export const getEsbuildAliases = (config: TPolyfillCfg = {}): Record<string, string> => {
  const polyfills = getPolyfills(config)
  return polyfills
}

/**
 * Reset polyfill registry to internal defaults
 *
 * Clears any custom registrations and resets to initial state.
 *
 * @example
 * resetPolyfills()
 * registerPolyfills({ all: true })
 */
export const resetPolyfills = (): void => {
  registeredPolyfills = { ...ImportMap }
}

/**
 * Get current polyfill registry (for debugging)
 *
 * Returns the current state without modification.
 *
 * @returns Current polyfill registry
 */
export const getCurrentRegistry = (): Record<string, string> => {
  return { ...registeredPolyfills }
}
