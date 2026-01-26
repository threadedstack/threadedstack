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

import { build } from 'esbuild'
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

const fromTS = async (name: string, paths: Record<string, string>) => {
  console.log(`📝 Compiling TypeScript to JavaScript with esbuild...\n`)

  try {
    await build({
      entryPoints: [paths.tsin],
      outfile: paths.jsin,
      minify: false,
      bundle: true,
      format: `esm`,
      target: `esnext`,
      // Use browser platform for WASM - polyfills Node.js globals
      // Need to add Node fs polyfill
      //platform: `node`,
      platform: `browser`,
      tsconfig: join(paths.root, `tsconfig.json`),
      // Bundle everything except WASI imports and Node.js-only packages
      external: [`wasi:*`],
      logLevel: `info`,
      mainFields: [`browser`, `module`, `main`],
      conditions: [`browser`, `module`, `import`],
      // Alias packages for WASM compatibility
      alias: {
        //[`just-bash`]: join(rootDir, `./node_modules/just-bash/dist/bundle/index.js`),
        [`sprintf-js`]: join(rootDir, `./node_modules/sprintf-js/src/sprintf.js`),

        [`assert`]: join(rootDir, `src/wasm/polyfills/vendor/assert.js`),
        [`node:assert`]: join(rootDir, `src/wasm/polyfills/vendor/assert.js`),
        [`buffer`]: join(rootDir, `src/wasm/polyfills/vendor/buffer.js`),
        [`node:buffer`]: join(rootDir, `src/wasm/polyfills/vendor/buffer.js`),
        [`crypto`]: join(rootDir, `src/wasm/polyfills/vendor/crypto.js`),
        [`node:crypto`]: join(rootDir, `src/wasm/polyfills/vendor/crypto.js`),
        [`encoding`]: join(rootDir, `src/wasm/polyfills/vendor/encoding.js`),
        [`node:encoding`]: join(rootDir, `src/wasm/polyfills/vendor/encoding.js`),
        [`events`]: join(rootDir, `src/wasm/polyfills/vendor/events.js`),
        [`node:events`]: join(rootDir, `src/wasm/polyfills/vendor/events.js`),
        [`os`]: join(rootDir, `src/wasm/polyfills/vendor/os.js`),
        [`node:os`]: join(rootDir, `src/wasm/polyfills/vendor/os.js`),
        [`path`]: join(rootDir, `src/wasm/polyfills/vendor/path.js`),
        [`node:path`]: join(rootDir, `src/wasm/polyfills/vendor/path.js`),
        [`process`]: join(rootDir, `src/wasm/polyfills/vendor/process2.js`),
        [`node:process`]: join(rootDir, `src/wasm/polyfills/vendor/process2.js`),
        [`punycode`]: join(rootDir, `src/wasm/polyfills/vendor/punycode.js`),
        [`node:punycode`]: join(rootDir, `src/wasm/polyfills/vendor/punycode.js`),
        [`querystring`]: join(rootDir, `src/wasm/polyfills/vendor/querystring.js`),
        [`node:querystring`]: join(rootDir, `src/wasm/polyfills/vendor/querystring.js`),

        [`stream/promises`]: join(
          rootDir,
          `src/wasm/polyfills/vendor/stream/promises.js`
        ),
        [`node:stream/promises`]: join(
          rootDir,
          `src/wasm/polyfills/vendor/stream/promises.js`
        ),

        [`stream`]: join(rootDir, `src/wasm/polyfills/vendor/stream.js`),
        [`node:stream`]: join(rootDir, `src/wasm/polyfills/vendor/stream.js`),

        [`string_decoder`]: join(rootDir, `src/wasm/polyfills/vendor/string_decoder.js`),
        [`node:string_decoder`]: join(
          rootDir,
          `src/wasm/polyfills/vendor/string_decoder.js`
        ),
        [`timers`]: join(rootDir, `src/wasm/polyfills/vendor/timers.js`),
        [`node:timers`]: join(rootDir, `src/wasm/polyfills/vendor/timers.js`),
        [`vm`]: join(rootDir, `src/wasm/polyfills/vendor/vm.js`),
        [`node:vm`]: join(rootDir, `src/wasm/polyfills/vendor/vm.js`),
        [`zlib`]: join(rootDir, `./node_modules/browserify-zlib/lib/index.js`),
        [`node:zlib`]: join(rootDir, `./node_modules/browserify-zlib/lib/index.js`),
      },
    })
    console.log(`✅ TypeScript compilation complete!\n`)
  } catch (error: any) {
    console.error(`❌ TypeScript compilation failed:`, error.message)
    throw new Error(`TypeScript compilation failed`)
  }
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

  await fromTS(name, paths)
  await toWasm(paths)
  await toJS(paths)
})
