import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { componentize } from '@bytecodealliance/componentize-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

/**
 * Build script to compile TypeScript -> WASM Component
 *
 * Steps:
 * 1. Compile TS -> JS (via tsc or tsup)
 * 2. Componentize JS -> WASM using world.wit
 * 3. Transpile WASM -> JS bindings (via jco)
 *
 * Usage:
 *   pnpm tsx scripts/build.ts
 */
async function build() {
  console.log('🔨 Building WASM Agent Component...\n')

  try {
    // Step 1: Read the compiled JavaScript
    console.log('📖 Reading compiled JavaScript...')
    const agentJs = await readFile(join(rootDir, 'dist/agent/agent.cjs'), 'utf-8')

    // Step 2: Componentize JS -> WASM
    console.log('⚙️  Componentizing JavaScript to WASM...')
    const { component } = await componentize(agentJs, {
      witPath: join(rootDir, 'world.wit'),
      worldName: 'agent-service',
      disableFeatures: [],
    })

    // Step 3: Write WASM component
    console.log('💾 Writing WASM component...')
    await mkdir(join(rootDir, 'dist/wasm'), { recursive: true })
    await writeFile(join(rootDir, 'dist/wasm/agent.wasm'), component)

    console.log('✅ WASM component built successfully!')
    console.log('\n📦 Next steps:')
    console.log('   1. Run: npx jco transpile dist/wasm/agent.wasm -o dist/wasm')
    console.log('   2. Import from dist/wasm/agent.js in your Host code')
  } catch (error: any) {
    console.error('❌ Build failed:', error.message)
    process.exit(1)
  }
}

build()
