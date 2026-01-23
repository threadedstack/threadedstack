/**
 * Build script to compile TypeScript -> WASM Component
 *
 * Steps:
 * 1. Compile TS -> JS (via tsc or tsup)
 * 2. Componentize JS -> WASM using world.wit
 * 3. Transpile WASM -> JS bindings (via jco)
 *   - This creates JavaScript bindings that can be imported by the Host
 * Usage:
 *   pnpm build:wasm
 */

import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { spawn } from 'node:child_process'
import { ife } from '@keg-hub/jsutils/ife'
import { writeFile, mkdir } from 'node:fs/promises'
import { componentize } from '@bytecodealliance/componentize-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, `../..`)

const paths = {
  root: rootDir,
  outdir: `dist/wasm`,
  jsname: `agent.js`,
  jsout: `dist/wasm/agent.js`,
  wasmout: `dist/wasm/agent.wasm`,
  witdir: join(rootDir, `wit/`),
  jsin: join(rootDir, `dist/agent/agent.js`),
}

const toJS = async () => {
  console.log(`🔄 Transpiling WASM to JS bindings...\n`)

  const jco = spawn(`npx`, [`jco`, `transpile`, paths.wasmout, `-o`, paths.outdir], {
    cwd: paths.root,
    stdio: `inherit`,
  })

  jco.on(`close`, (code) => {
    if (code === 0) {
      console.log(`\n✅ Transpilation complete!`)
      console.log(`📦 Import from: ${paths.jsout}`)
    } else {
      console.error(`❌ Transpilation failed with code ${code}`)
      process.exit(1)
    }
  })
}

const toWasm = async () => {
  console.log(`🔨 Building WASM Agent Component...\n`)

  try {
    console.log(`⚙️  Componentizing JavaScript to WASM...`)
    const { component } = await componentize({
      witPath: paths.witdir,
      sourcePath: paths.jsin,
      // @ts-ignore
      sourceName: paths.jsname,
      worldName: `agent-service`,
    })

    console.log(`💾 Writing WASM component...`)
    await mkdir(join(rootDir, paths.outdir), { recursive: true })
    await writeFile(join(rootDir, paths.wasmout), component)

    console.log(`✅ WASM component built successfully!`)
  } catch (error: any) {
    console.error(`❌ Build failed:`, error.message)
    process.exit(1)
  }
}

ife(async () => {
  await toWasm()
  await toJS()
})
