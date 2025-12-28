import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { GlobOptionsWithFileTypesUnset } from 'glob'
import { glob } from 'glob'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const srcDir = path.join(dirname, `../src`)

const GlobJSExts = [`js`, `cjs`, `mjs`, `ts`, `cts`, `mts`]
const exts = GlobJSExts.join(`,`)
const GlobJSFiles = `**/*.{${exts}}`

type TGetEntries = Omit<Partial<GlobOptionsWithFileTypesUnset>, `ignore`> & {
  ignore?: string[]
  noDefs?: boolean
}

const defIgnore = [
  `**/*.d.ts`,
  `/node_modules/`,
  `\\.pnp\\.[^/]+$`,
  `**/__tests__/**/*.{${exts}}`,
  `**/__mocks__/**/*.{${exts}}`,
  `**/node_modules/**/*.{${exts}}`,
]

export const getEntries = async (opts: TGetEntries = {}) => {
  const { noDefs, ...options } = opts

  return await glob(GlobJSFiles, {
    cwd: srcDir,
    nodir: true,
    absolute: true,
    ...options,
    ignore: [...(opts.ignore || []), ...(noDefs ? [] : defIgnore)],
  })
}
