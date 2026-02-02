import type { TDownload, TInstallOpts } from '@TWA/types'

import { tmpdir } from 'node:os'
import { join, isAbsolute } from 'node:path'
import { execSync } from 'node:child_process'
import { cp, mkdir, rm, readdir, mkdtemp } from 'node:fs/promises'


type TDownloadTemp = TDownload & { temp: string }
type TTargetFallback = {
  witdir: string
  dir: string
}

/**
 * Clones the wit git repo into a temp directory
 * @param props - Deps download options with temp directory
 * @returns undefined
 */
const gitClone = async (props:TDownloadTemp) => {
  const {
    tag,
    temp,
    repo,
    quiet,
    source,
  } = props
  
  const run = (cmd: string) => execSync(cmd, { cwd: temp, stdio: `pipe` })

  !quiet && console.log(`Initializing temporary git repo...`)
  run(`git init`)
  run(`git remote add origin ${repo}`)

  // Configure sparse checkout to avoid downloading the entire history
  run(`git config core.sparseCheckout true`)
  // Using simple echo for cross-platform compatibility in the temp dir
  run(`echo ${source} >> .git/info/sparse-checkout`)

  !quiet && console.log(`Fetching ${tag}...`)
  run(`git pull --depth 1 origin ${tag}`)
}


/**
 * Copies the download wit deps to the configured directory
 * @param props - Deps download options with temp directory
 * @returns undefined
 */
const copyDeps = async (props:Omit<TDownloadTemp, `repo`|`tag`>) => {
  const {
    temp,
    quiet,
    source,
    target,
  } = props
  
  const sourceDir = join(temp, source)
  const packages = await readdir(sourceDir)

  !quiet && console.log(`Copying ${packages.length} packages to wit/deps...`)

  for (const pkg of packages) {
    const dest = join(target, pkg)
    const src = join(sourceDir, pkg)
    await cp(src, dest, { recursive: true, force: true })
  }

  !quiet && console.log(`✅ Success! Dependencies updated.`)
}


/**
 * Downloads the wit deps from the passed in git repo url
 * @param props - Deps download options
 * @returns undefined
 */
export const download = async (props:TDownload) => {
  const {
    quiet,
    target
  } = props
  
  !quiet && console.log(`Setup: installing wit deps to ${target}`)

  await mkdir(target, { recursive: true })
  const temp = await mkdtemp(join(tmpdir(), `wasi-deps-`))

  try {
    const opts = {...props, temp }
    gitClone(opts)
    await copyDeps(opts)
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
}


/**
 * Resolve the target path when deps should be installed
 *
 * @param opts - Wit deps install options
 * @returns Absolute paths objects of output paths
 */
export const findTargetDir = (opts:TInstallOpts, fallback:TTargetFallback) => {
  const { root, target, witdir } = opts

  return target
    ? isAbsolute(target)
      ? target
      : join(root, target)
    : witdir
      ? isAbsolute(witdir)
        ? join(witdir, fallback.dir)
        : join(root, witdir, fallback.dir)
      : join(root, fallback.witdir, fallback.dir)
}