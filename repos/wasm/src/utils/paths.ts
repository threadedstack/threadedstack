import type { TWasmBuildOpts, TResolvedPaths, TInstallOpts } from '@TWA/types'

import path from 'node:path'
import { readdir, readFile } from 'node:fs/promises'


export const getWitFile = async (witdir: string) => {
  const files = await readdir(witdir)
  const found = files
    .filter(file => path.extname(file) === `.wit`)
    .map(file => path.join(witdir, file))
  
  return found[0]
}

export const getWorldName = async (
  options: TWasmBuildOpts,
  paths: TResolvedPaths
) => {
  const name = options.world || paths.name
  if(name) return name
  const found = await getWitFile(paths.witdir)
  return path.parse(found).name
}


/**
 * Attempt to resolve the name of the wasm module
 *
 * @param options - Build options
 * @returns Name of the wasm module
 */
const resolveName = async (options:TWasmBuildOpts) => {
  // Read package.json to get default name
  if(options.name) return options.name
  if(options.world) return options.world

  try {
    const pkgPath = path.join(options.root, `package.json`)
    const pkgContent = await readFile(pkgPath, `utf-8`)
    const pkg = JSON.parse(pkgContent)
    return pkg.name?.replace(/^@[^/]+\//, ``) || `module`
  } catch {
    console.warn(`[WASM WARN] Could not resolve wasm module name, using default "module"`)
    return `module`
  }
}

/**
 * Resolve all paths for WASM build from options
 *
 * Intelligently derives paths from package.json and allows explicit overrides.
 *
 * @param options - Build options
 * @returns Resolved paths object
 */
export const resolvePaths = async (
  options:TWasmBuildOpts
): Promise<TResolvedPaths> => {

  const { root } = options
  const name = await resolveName(options)
  const witdir = options.witdir || path.join(root, `wit`)
  const witin = await getWitFile(witdir) || path.join(witdir, `${name}.wit`)

  return {
    name,
    witin,
    root: root,
    jsname: `${name}.js`,
    tsout: path.join(root, `dist`, name),
    witdir: options.witdir || path.join(root, `wit`),
    jsin: path.join(root, `dist`, name, `${name}.js`),
    outdir: options.outdir || path.join(root, `dist/wasm`),
    jsout: path.join(options.outdir || `dist/wasm`, `${name}.js`),
    tsin: options.tsin || path.join(root, `src`, `${name}.ts`),
    wasmout: path.join(options.outdir || `dist/wasm`, `${name}.wasm`),
    tsconfig: options.tsconfig || path.join(root, `tsconfig.json`),
  }
}

/**
 * Resolve absolute paths for the output files
 *
 * @param paths - Resolved paths object
 * @returns Absolute paths objects of output paths 
 */
export const getPaths = (paths: TResolvedPaths) => {
  return {
    outdir: path.isAbsolute(paths.outdir)
      ? paths.outdir
      : path.join(paths.root, paths.outdir),
    wasmout: path.isAbsolute(paths.wasmout)
      ? paths.wasmout
      : path.join(paths.root, paths.wasmout),
    jsout :path.isAbsolute(paths.jsout)
      ? paths.jsout
      : path.join(paths.root, paths.jsout),
  }
}
