import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { ife } from '@keg-hub/jsutils/ife'
import { execSync } from 'node:child_process'
import { cp, mkdir, rm, readdir, mkdtemp } from 'node:fs/promises'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, `../..`)

// Tag v18.0.2 contains the stable WASI 0.2.0 definitions
const Tag = `v18.0.2`
const SourcePath = `crates/wasi/wit/deps`
const TargetDir = join(rootDir, `wit`, `deps`)
const RepoUrl = `https://github.com/bytecodealliance/wasmtime.git`

const git = async (tempDir: string) => {
  const run = (cmd: string) => execSync(cmd, { cwd: tempDir, stdio: `pipe` })

  console.log(`Initializing temporary git repo...`)
  run(`git init`)
  run(`git remote add origin ${RepoUrl}`)

  // Configure sparse checkout to avoid downloading the entire history
  run(`git config core.sparseCheckout true`)
  // Using simple echo for cross-platform compatibility in the temp dir
  run(`echo ${SourcePath} >> .git/info/sparse-checkout`)

  console.log(`Fetching ${Tag}...`)
  run(`git pull --depth 1 origin ${Tag}`)
}

const copy = async (tempDir: string) => {
  const sourceDir = join(tempDir, SourcePath)
  const packages = await readdir(sourceDir)

  console.log(`Copying ${packages.length} packages to wit/deps...`)

  for (const pkg of packages) {
    const src = join(sourceDir, pkg)
    const dest = join(TargetDir, pkg)
    await cp(src, dest, { recursive: true, force: true })
  }

  console.log(`✅ Success! Dependencies updated.`)
}

const download = async () => {
  console.log(`Setup: targeting ${TargetDir}`)

  await mkdir(TargetDir, { recursive: true })
  const tempDir = await mkdtemp(join(tmpdir(), `wasi-deps-`))

  try {
    git(tempDir)
    await copy(tempDir)
  } catch (error) {
    console.error(`❌ Error fetching dependencies:`, error)
    process.exit(1)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

ife(async () => {
  try {
    const existing = await readdir(TargetDir)
    if (existing.includes(`cli`)) {
      console.log(`✅ Dependencies already installed. Skipping download.`)
      return
    }
  } catch (err) {}

  await download()
})
