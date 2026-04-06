#!/usr/bin/env bun

/**
 * Build script for tsa CLI.
 * Handles both bundling (bun build) and compilation (bun build --compile).
 *
 * Usage:
 *   bun run scripts/build.ts           # Bundle to dist/index.js
 *   bun run scripts/build.ts --compile # Compile to dist/tsa binary
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

// Step 1: Bundle
console.log(`Bundling tsa...`)
console.log(`  Entry: ${entrypoint}`)

const result = await Bun.build({
  entrypoints: [entrypoint],
  outdir: distDir,
  target: `bun`,
  minify: true,
  // @nuanced-dev/mutagen is not imported — CliDriver spawns the binary directly
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

// Bun.build names output after the entrypoint: main.ts -> main.js
const bundleName = `main.js`
console.log(`  Output: ${distDir}/${bundleName}`)

// Step 2: If --compile, compile the bundle into a native binary
if (isCompile) {
  const bundlePath = join(distDir, bundleName)
  const outfile = join(distDir, `tsa`)

  console.log(`\nCompiling to native binary...`)
  console.log(`  Output: ${outfile}`)

  await $`bun build ${bundlePath} --compile --outfile ${outfile}`.cwd(root)
}

console.log(`\nDone!`)
