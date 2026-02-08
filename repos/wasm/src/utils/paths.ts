import type { TWasmBuildOpts, TResolvedPaths, TInstallOpts } from '@TWA/types'

import path from 'node:path'
import { readdir, readFile } from 'node:fs/promises'

export const getWitFile = async (witdir: string) => {
  const files = await readdir(witdir)
  const found = files
    .filter((file) => path.extname(file) === `.wit`)
    .map((file) => path.join(witdir, file))

  return found[0]
}

export const getWorldName = async (options: TWasmBuildOpts, paths: TResolvedPaths) => {
  const name = options.world || paths.name
  if (name) return name
  const found = await getWitFile(paths.witdir)
  return path.parse(found).name
}

/**
 * Attempt to resolve the name of the wasm module
 *
 * @param options - Build options
 * @returns Name of the wasm module
 */
const resolveName = async (options: TWasmBuildOpts, root: string) => {
  // Read package.json to get default name
  if (options.name) return options.name
  if (options.world) return options.world

  try {
    const pkgPath = path.join(root, `package.json`)
    const pkgContent = await readFile(pkgPath, `utf-8`)
    const pkg = JSON.parse(pkgContent)
    return pkg.name?.replace(/^@[^/]+\//, ``) || `module`
  } catch {
    console.warn(`[WASM WARN] Could not resolve wasm module name, using default "module"`)
    return `module`
  }
}

const toABS = (location: string, root: string = ``) => {
  return path.isAbsolute(location) ? location : path.join(root, location)
}

/**
 * Resolve all paths for WASM build from options
 *
 * Intelligently derives paths from package.json and allows explicit overrides.
 *
 * @param options - Build options
 * @returns Resolved paths object
 */
export const resolvePaths = async (options: TWasmBuildOpts): Promise<TResolvedPaths> => {
  const root = toABS(options.root)
  const witdir = options.witdir ? toABS(options.witdir, root) : path.join(root, `wit`)
  const outdir = options.outdir
    ? toABS(options.outdir, root)
    : path.join(root, `dist/wasm`)

  const name = await resolveName(options, root)
  const witin = (await getWitFile(witdir)) || path.join(witdir, `${name}.wit`)
  const wasmout = options.wasmout
    ? toABS(options.wasmout, root)
    : path.join(outdir, `${name}.wasm`)

  const tsout = options.tsout ? toABS(options.tsout, root) : path.join(root, `dist`, name)
  const tsin = options.tsin
    ? toABS(options.tsin, root)
    : path.join(root, `src`, `${name}.ts`)

  const jsout = options.jsout
    ? toABS(options.jsout, root)
    : path.join(outdir, `${name}.js`)
  const jsin = options.jsin
    ? toABS(options.jsin, root)
    : path.join(root, `dist`, name, `${name}.js`)
  const tsconfig = options.tsconfig
    ? toABS(options.tsconfig, root)
    : path.join(root, `tsconfig.json`)

  return {
    name,
    root,
    tsin,
    jsin,
    witin,
    tsout,
    jsout,
    witdir,
    outdir,
    wasmout,
    tsconfig,
    jsname: `${name}.js`,
  }
}
