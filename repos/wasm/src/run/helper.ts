import type { TWasmRunOpts } from '@TWA/types'
import type {
  WASIImportObject,
  VersionedWASIImportObject,
} from '@bytecodealliance/preview2-shim/instantiation'

import { join, dirname } from 'node:path'
import { readFile } from 'node:fs/promises'
import { WASIShim } from '@bytecodealliance/preview2-shim/instantiation'


const wss = new WASIShim()
const shim: WASIImportObject = wss.getImportObject()
shim satisfies WASIImportObject
shim satisfies VersionedWASIImportObject<``>


/**
 * Run a WASM module with automatic preview2-shim setup
 *
 * This function:
 * 1. Dynamically imports the WASM JS bindings
 * 2. Compiles WASM files from the same directory
 * 3. Merges default preview2-shim imports with custom imports
 * 4. Instantiates the WASM module
 * 5. Calls the exported run function (e.g., runBash())
 * 6. Returns the result
 *
 * @param options - Configuration for running the WASM module
 * @returns Promise<T> - The result from the WASM module's run function
 *
 * @example
 * ```typescript
 * // Run with default imports
 * const result = await runWasm({
 *   modulePath: './dist/wasm/bash.js',
 * })
 * ```
 *
 * @example
 * ```typescript
 * // Run with custom imports
 * import * as shim from '@bytecodealliance/preview2-shim'
 *
 * const result = await runWasm({
 *   modulePath: './dist/wasm/bash.js',
 *   imports: {
 *     'wasi:cli/stdout': customStdout,
 *   },
 *   args: ['--version'],
 *   env: { HOME: '/tmp' },
 * })
 * ```
 */
export async function runWasm<T = any>(
  options: TWasmRunOpts
): Promise<T> {
  const {
    modulePath,
    imports: customImports = {},
    args = [],
    env = {},
    preopens = {},
  } = options

  // Step 1: Dynamic import of the WASM module
  const moduleDir = dirname(modulePath)

  // The module should export an `instantiate` function
  const wasmModule = await import(modulePath)

  // Get the instantiate function (exported by jco-generated bindings)
  const instantiate = wasmModule.instantiate || wasmModule.default

  if (typeof instantiate !== 'function') {
    throw new Error(
      `WASM module at ${modulePath} does not export an 'instantiate' function. ` +
      `Make sure the module was built with jco.`
    )
  }

  // Step 2: Compile WASM files from the same directory
  const getCoreModule = async (url: string): Promise<WebAssembly.Module> => {
    const fileName = url.split('/').pop()
    const filePath = join(moduleDir, fileName!)

    try {
      const bytes = await readFile(filePath) as BufferSource
      return WebAssembly.compile(bytes)
    } catch (error) {
      throw new Error(
        `Failed to compile WASM file at ${filePath}: ${error}`
      )
    }
  }

  // Step 3: Merge default imports with custom imports
  // Custom imports override defaults (shallow merge)
  const mergedImports:typeof shim = {
    ...shim,
    ...customImports,
  }

  // Step 4: Configure environment and preopens if provided
  if (Object.keys(env).length > 0) {
    // Set environment variables through the CLI environment interface
    // This depends on the preview2-shim implementation
    // @ts-ignore
    const envImport = mergedImports['wasi:cli/environment']
    if (envImport && typeof envImport.setEnvironment === 'function') {
      await envImport.setEnvironment(env)
    }
  }

  if (Object.keys(preopens).length > 0) {
    // Configure preopens for filesystem access
    // @ts-ignore
    const preopensImport = mergedImports['wasi:filesystem/preopens']
    if (preopensImport && typeof preopensImport.setPreopens === 'function') {
      await preopensImport.setPreopens(preopens)
    }
  }

  // Step 5: Instantiate the WASM component
  let component
  try {
    component = await instantiate(getCoreModule, mergedImports)
  } catch (error) {
    throw new Error(
      `Failed to instantiate WASM module: ${error}`
    )
  }

  // Step 6: Find and call the run function
  // Try common patterns: run{Name}(), run(), or use the first exported function
  const moduleName = getModuleNameFromPath(modulePath)
  const possibleRunNames = [
    `run${capitalize(moduleName)}`,  // e.g., runBash
    `run${moduleName.toUpperCase()}`, // e.g., runBASH
    'run',                            // Generic run
  ]

  let runFunction = null
  for (const name of possibleRunNames) {
    if (typeof component[name] === 'function') {
      runFunction = component[name]
      break
    }
  }

  // If no named run function, try to find any exported function
  if (!runFunction) {
    const exports = Object.keys(component).filter(
      key => typeof component[key] === 'function'
    )

    if (exports.length === 1) {
      runFunction = component[exports[0]]
    } else if (exports.length > 1) {
      throw new Error(
        `Multiple exported functions found: ${exports.join(', ')}. ` +
        `Please specify which function to call.`
      )
    } else {
      throw new Error(
        `No run function found in WASM module. ` +
        `Tried: ${possibleRunNames.filter(Boolean).join(', ')}`
      )
    }
  }

  // Step 7: Call the run function with args if provided
  try {
    const result = args.length > 0
      ? await runFunction(...args)
      : await runFunction()

    return result as T
  } catch (error) {
    throw new Error(
      `WASM run function failed: ${error}`
    )
  }
}

/**
 * Extract module name from file path
 * e.g., "/path/to/bash.js" -> "bash"
 */
function getModuleNameFromPath(modulePath: string): string {
  const fileName = modulePath.split('/').pop() || ''
  const moduleName = fileName.replace(/\.(js|ts)$/, '')
  return moduleName
}

/**
 * Capitalize first letter of string
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
