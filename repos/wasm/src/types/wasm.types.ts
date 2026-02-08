import type { BuildOptions } from 'esbuild'

/**
 * Options for running a WASM module with preview2-shim setup
 */
export type TWasmRunOpts = {
  /** Path to the JS bindings file (e.g., dist/wasm/bash.js) */
  modulePath: string
  /** Custom imports to merge with default preview2-shim imports */
  imports?: Record<string, any>
  /** Arguments to pass to the WASM module (optional) */
  args?: string[]
  /** Environment variables to pass to the WASM module (optional) */
  env?: Record<string, string>
  /** Preopened directories for filesystem access (optional) */
  preopens?: Record<string, string>
}

/**
 * Result from running a WASM module
 */
export type WasmRunResult<T = any> = T

/**
 * Options for building WASM from TypeScript
 */
export type TWasmBuildOpts = {
  /** Path to package.json (required) */
  root: string
  /** Module name (default: from package.json name) */
  name?: string
  /** TypeScript input file (default: root/src/{name}.ts) */
  tsin?: string
  /** TypeScript output file (default: root/dist/{name}.ts) */
  tsout?: string
  /** JavaScript input file (default: root/dist/{name}.js) */
  jsin?: string
  /** JavaScript output file (default: root/dist/wasm/{name}.js) */
  jsout?: string
  /** Disable debug logs */
  quiet?: boolean
  /** World name for componentize-js (default: name) */
  world?: string
  /** WIT directory (default: root/wit) */
  witdir?: string
  /** WASM Output file (default: dist/wasm/<name>.wasm) */
  wasmout?: string
  /** Output directory (default: dist/wasm) */
  outdir?: string
  /** tsconfig path (default: root/tsconfig.json) */
  tsconfig?: string
  /** esbuild options */
  esbuild?: BuildOptions
  /** Polyfill configuration */
  polyfills?: TPolyfillCfg
}

/**
 * Resolved paths object for WASM build
 */
export type TResolvedPaths = {
  /** Module name */
  name: string
  /** Root directory path */
  root: string
  /** WIT input file name */
  witin: string
  /** JavaScript input file name */
  jsname: string
  /** Output directory */
  outdir: string
  /** WIT directory path */
  witdir: string
  /** JS output file path */
  jsout: string
  /** WASM output file path */
  wasmout: string
  /** TypeScript output directory */
  tsout: string
  /** TypeScript config path */
  tsconfig: string
  /** TypeScript input file path */
  tsin: string
  /** JavaScript input file path */
  jsin: string
}

/**
 * Result from building WASM
 */
export type TWasmBuildResult = {
  jsin: string
  jsout: string
  wasmout: string
  success: boolean
}

/**
 * Polyfill configuration
 */
export type TPolyfillCfg = {
  /** Use all internal polyfills */
  all?: boolean
  /** Specific polyfills to include */
  include?: string[]
  /** Specific polyfills to exclude */
  exclude?: string[]
  /** Custom polyfills (override internal) */
  custom?: Record<string, string>
}

/**
 * Map of registered polyfills (module name -> file path)
 */
export type RegisteredPolyfills = Record<string, string>

/**
 * Runtime imports for WASM instantiation
 */
export type RuntimeImports = Record<string, any>

/**
 * WebAssembly module interface
 */
export interface IWasmModule {
  exports: Record<string, unknown>
}
