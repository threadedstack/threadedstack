import type { TInstallOpts, TDownload } from '@TWA/types'

import { readdir } from 'node:fs/promises'
import { download, findTargetDir } from '@TWA/utils/download'

const defaults = {
  dir: `deps`,
  witdir: `wit`,
  // Tag v18.0.2 contains the stable WASI 0.2.0 definitions
  tag: `v18.0.2`,
  source: `crates/wasi/wit/deps`,
  repo: `https://github.com/bytecodealliance/wasmtime.git`,
}


const check = async (opts:TDownload) => {
  try {
    const existing = await readdir(opts.target)
    if (existing.includes(`cli`)) return true
  } catch (err) {
    return false
  }
}

const buildOpts = (opts:TInstallOpts):TDownload => {
  const {
    root,
    quiet,
    witdir,
    tag=defaults.tag,
    repo=defaults.repo,
    source=defaults.source,
  } = opts


  return {
    tag,
    repo,
    quiet,
    source,
    target: findTargetDir(opts, defaults)
  }
} 


export const install = async (opts:TInstallOpts) => {

  const options = buildOpts(opts)
  const exists = await check(options)

  if(exists){
    !options.quiet && console.log(`✅ Dependencies already installed. Skipping download.`)
    return true
  }

  await download(options)

}
