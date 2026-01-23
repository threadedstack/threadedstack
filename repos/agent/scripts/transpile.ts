import { spawn } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

/**
 * Transpile WASM component to JS bindings using JCO
 *
 * This creates JavaScript bindings that can be imported by the Host
 *
 * Usage:
 *   pnpm tsx scripts/transpile.ts
 */
async function transpile() {
  console.log('🔄 Transpiling WASM to JS bindings...\n')

  const jco = spawn(
    'npx',
    ['jco', 'transpile', 'dist/wasm/agent.wasm', '-o', 'dist/wasm'],
    {
      cwd: rootDir,
      stdio: 'inherit',
    }
  )

  jco.on('close', (code) => {
    if (code === 0) {
      console.log('\n✅ Transpilation complete!')
      console.log('📦 Import from: dist/wasm/agent.js')
    } else {
      console.error(`❌ Transpilation failed with code ${code}`)
      process.exit(1)
    }
  })
}

transpile()
