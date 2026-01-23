/**
 * Build script to compile TypeScript -> WASM Component
 *
 * Steps:
 * 1. Compile TS -> JS (via tsc or tsup)
 * 2. Componentize JS -> WASM using world.wit
 * 3. Transpile WASM -> JS bindings (via jco)
 *   - This creates JavaScript bindings that can be imported by the Host
 * Usage:
 *   pnpm build:wasm agent
 *   pnpm build:wasm sandbox
 */

import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { spawn } from 'node:child_process'
import { ife } from '@keg-hub/jsutils/ife'
import { writeFile, mkdir } from 'node:fs/promises'
import { capitalize } from '@keg-hub/jsutils/capitalize'
import { componentize } from '@bytecodealliance/componentize-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, `../..`)

const buildPaths = (name: `agent` | `sandbox`) => {
  return {
    name,
    root: rootDir,
    witin: `world.wit`,
    jsname: `${name}.js`,
    outdir: `dist/wasm`,
    witdir: join(rootDir, `wit/`),
    jsout: `dist/wasm/${name}.js`,
    wasmout: `dist/wasm/${name}.wasm`,
    tsout: join(rootDir, `dist/${name}`),
    tsin: join(rootDir, `src/wasm/${name}.ts`),
    jsin: join(rootDir, `dist/${name}/${name}.js`),
  }
}

const fromTS = async (paths: Record<string, string>) => {
  console.log(`📝 Compiling TypeScript to JavaScript...\n`)

  return new Promise((resolve, reject) => {
    const tsup = spawn(
      `npx`,
      [
        `tsup`,
        paths.tsin,
        `--format`,
        `esm`,
        `--outDir`,
        paths.tsout,
        `--target`,
        `esnext`,
        `--clean`,
        `--external`,
        `wasi:cli/environment@0.2.0`,
      ],
      {
        cwd: paths.root,
        stdio: `inherit`,
      }
    )

    tsup.on(`close`, (code) => {
      if (code === 0) {
        console.log(`✅ TypeScript compilation complete!\n`)
        resolve(void 0)
      } else {
        console.error(`❌ TypeScript compilation failed with code ${code}`)
        reject(new Error(`TypeScript compilation failed`))
      }
    })
  })
}

const toJS = async (paths: Record<string, string>) => {
  console.log(`🔄 Transpiling WASM to JS bindings...\n`)

  /**
   * Use jco's --instantiation option to generate an instantiate() function
   * This allows passing imports at runtime instead of using wrapper modules
   */
  const jco = spawn(
    `npx`,
    [`jco`, `transpile`, paths.wasmout, `-o`, paths.outdir, `--instantiation`],
    {
      cwd: paths.root,
      stdio: `inherit`,
    }
  )

  jco.on(`close`, async (code) => {
    if (code === 0) {
      console.log(`\n✅ Transpilation complete!`)
      console.log(`\n📦 Import from: ${paths.jsout}`)
      console.log(`🔗 Use wasmModule.instantiate(imports) to inject capabilities`)
    } else {
      console.error(`❌ Transpilation failed with code ${code}`)
      process.exit(1)
    }
  })
}

const toWasm = async (paths: Record<string, string>) => {
  console.log(`🔨 Building WASM ${capitalize(paths.name)} Component...\n`)

  try {
    console.log(`⚙️  Componentizing JavaScript to WASM...`)
    const { component } = await componentize({
      witPath: paths.witdir,
      worldName: paths.name,
      sourcePath: paths.jsin,
      // @ts-ignore
      sourceName: paths.jsname,
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
  const args = process.argv.slice(2) as string[]
  const name = args[0]
  if (name !== `agent` && name !== `sandbox`)
    throw new Error(`First argument of "agent" or "sandbox" is required`)

  const paths = buildPaths(name)

  await fromTS(paths)
  await toWasm(paths)
  await toJS(paths)
})
