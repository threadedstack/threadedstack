import type { PluginBuild } from 'esbuild'

import { build } from 'esbuild'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'
import { spawn } from 'node:child_process'
import { ife } from '@keg-hub/jsutils/ife'
import { writeFile, mkdir } from 'node:fs/promises'
import { injectBanner } from '@TSH/polyfills/banner'
import { capitalize } from '@keg-hub/jsutils/capitalize'
import { componentize } from '@bytecodealliance/componentize-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, `../..`)

const apps = [
  //`shell`,
  `bash`,
]

const polyfills = {
  zlib: join(rootDir, `src/polyfills/zlib.ts`),
  process: join(rootDir, `src/polyfills/process.ts`),
}

const buildPaths = (name: string) => {
  return {
    name,
    root: rootDir,
    witin: `${name}.wit`,
    jsname: `${name}.js`,
    outdir: `dist/wasm`,
    witdir: join(rootDir, `wit/`),
    jsout: `dist/wasm/${name}.js`,
    wasmout: `dist/wasm/${name}.wasm`,
    tsout: join(rootDir, `dist/${name}`),
    tsconfig: join(rootDir, `tsconfig.json`),
    //tsin: join(rootDir, `src/wasm/${name}.ts`),
    tsin: join(rootDir, `src/${name}.ts`),
    jsin: join(rootDir, `dist/${name}/${name}.js`),
  }
}

const fromTS = async (paths: Record<string, string>) => {
  console.log(`📝 Compiling TypeScript to JavaScript with esbuild...\n`)

  const js = await injectBanner()

  await build({
    minify: false,
    bundle: true,
    format: `esm`,
    target: `esnext`,
    //write: false,
    //target: `es2020`,
    logLevel: `info`,
    platform: `browser`,
    outfile: paths.jsin,
    entryPoints: [paths.tsin],
    tsconfig: paths.tsconfig,
    // Bundle everything except WASI imports and Node.js-only packages
    external: [`wasi:*`],
    mainFields: [`browser`, `module`, `main`],
    conditions: [`browser`, `module`, `import`],
    /**
     * Inject a deterministic PRNG to replace Math.random.
     * This prevents the "wasi:random" call during the Wizer build snapshot.
     */
    banner: {
      js,
    },
    plugins: [
      {
        name: `node:zlib`,
        setup(build: PluginBuild) {
          build.onResolve({ filter: /^(node:)?zlib$/ }, () => ({
            path: polyfills.zlib,
          }))
        },
      },
    ],
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

const toJS = async (paths: Record<string, string>) => {
  console.log(`🔄 Transpiling WASM to JS bindings...\n`)

  /**
   * Use jco's --instantiation option to generate an instantiate() function
   * This allows passing imports at runtime instead of using wrapper modules
   */
  const jco = spawn(
    `npx`,
    [`jco`, `transpile`, paths.wasmout, `-o`, paths.outdir, `--instantiation`, `--quiet`],
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

ife(async () => {
  await Promise.all(
    apps.map(async (app: string) => {
      const paths = buildPaths(app)
      await fromTS(paths)
      await toWasm(paths)
      await toJS(paths)
    })
  )
})
