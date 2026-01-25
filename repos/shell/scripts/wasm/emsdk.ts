import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { ife } from '@keg-hub/jsutils/ife'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, `../..`)

const RepoUrl = `https://github.com/emscripten-core/emsdk.git`
const ModuleLoc = `node_modules/emsdk`
const InstallDir = path.resolve(rootDir, ModuleLoc)

const reset = () => {
  delete process.env[`EMSDK`]
  delete process.env[`EMSDK_NODE`]
  delete process.env[`EMSDK_PYTHON`]
  delete process.env[`SSL_CERT_FILE`]
}

// Helper to run shell commands
// Helper to run shell commands
const run = (command: string, cwd: string = rootDir) => {
  console.log(`Running: ${command}`)
  try {
    execSync(command, { stdio: `inherit`, cwd })
  } catch (error) {
    console.error(`Error executing command: ${command}`)
    process.exit(1)
  }
}

const clone = () => {
  // Clone the repository
  fs.existsSync(InstallDir)
    ? console.log(`emsdk directory already exists skipping clone.`)
    : run(`git clone ${RepoUrl} ${InstallDir}`, rootDir)
}

const setup = () => {
  // Install latest SDK, emsdk automatically detects the correct host architecture
  run(`./emsdk install latest`, InstallDir)

  // Activate latest SDK
  run(`./emsdk activate latest`, InstallDir)
}

ife(() => {
  console.log(`Starting Emscripten installation ...`)

  reset()
  clone()
  setup()

  console.log(`\nInstallation complete.`)
  console.log(`To add Emscripten to your PATH for this session, run:`)
  console.log(`source ./${ModuleLoc}/emsdk_env.sh`)
})
