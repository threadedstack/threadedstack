#!/usr/bin/env bun

/**
 * Build script for tsa CLI.
 * Handles both bundling (bun build) and compilation (bun build --compile).
 *
 * Usage:
 *   bun run scripts/build.ts           # Bundle to dist/index.js
 *   bun run scripts/build.ts --compile # Compile to dist/tsa binary
 *
 * The plugin stubs out `react-devtools-core` and `ws` which are statically
 * imported by Ink`s devtools module. Without this, the bundle/binary fails
 * at runtime with "Cannot find package" errors even though the devtools
 * code path is never executed (guarded by process.env.DEV === `true`).
 */

import { $ } from 'bun'
import { join, resolve } from 'node:path'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'

const root = resolve(import.meta.dirname, `..`)
const distDir = join(root, `dist`)
const entrypoint = join(root, `src`, `main`)
const pkg = JSON.parse(readFileSync(join(root, `package.json`), `utf-8`))

if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true })

const isCompile = process.argv.includes(`--compile`)

/**
 * Bun build plugin that intercepts imports of `react-devtools-core` and `ws`,
 * returning empty no-op modules so the bundle doesn`t require them at runtime.
 */
const devtoolsStubPlugin = {
  name: `stub-devtools`,
  setup(build: any) {
    build.onResolve({ filter: /^react-devtools-core$/ }, () => ({
      path: `react-devtools-core`,
      namespace: `devtools-stub`,
    }))
    build.onResolve({ filter: /^ws$/ }, () => ({
      path: `ws`,
      namespace: `devtools-stub`,
    }))
    build.onLoad({ filter: /.*/, namespace: `devtools-stub` }, () => ({
      contents: `export default {};`,
      loader: `js`,
    }))
  },
}

// Step 1: Bundle with plugin to stub devtools imports
console.log(`Bundling tsa...`)
console.log(`  Entry: ${entrypoint}`)

const result = await Bun.build({
  entrypoints: [entrypoint],
  outdir: distDir,
  target: `bun`,
  minify: true,
  plugins: [devtoolsStubPlugin],
  define: {
    __TDSK_REPL_VERSION__: JSON.stringify(pkg.version),
  },
})

if (!result.success) {
  console.error(`Build failed:`)
  for (const msg of result.logs) {
    console.error(msg)
  }
  process.exit(1)
}

console.log(`  Output: ${distDir}/index.js`)

// Step 2: If --compile, compile the already-stubbed bundle into a native binary
if (isCompile) {
  const bundlePath = join(distDir, `index.js`)
  const outfile = join(distDir, `tsa`)

  console.log(`\nCompiling to native binary...`)
  console.log(`  Output: ${outfile}`)

  await $`bun build ${bundlePath} --compile --outfile ${outfile}`.cwd(root)
}

console.log(`\nDone!`)
