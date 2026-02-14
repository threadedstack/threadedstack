#!/usr/bin/env bun

/**
 * Build script for compiling tdsk-agent into a single native binary.
 *
 * Usage:
 *   bun run scripts/compile.ts
 *   bun run scripts/compile.ts --target bun-darwin-arm64
 *
 * This wraps `bun build --compile` with workspace-aware path resolution.
 */

import { $ } from 'bun'
import { existsSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const root = resolve(import.meta.dirname, `..`)
const distDir = join(root, `dist`)
const entrypoint = join(root, `src`, `index.ts`)
const outfile = join(distDir, `tdsk-agent`)

if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true })

const target = process.argv.includes(`--target`)
  ? process.argv[process.argv.indexOf(`--target`) + 1]
  : undefined

const args = [
  `bun`,
  `build`,
  entrypoint,
  `--compile`,
  `--outfile`,
  outfile,
  `--minify`,
]

if (target) args.push(`--target`, target)

console.log(`Compiling tdsk-agent...`)
console.log(`  Entry: ${entrypoint}`)
console.log(`  Output: ${outfile}`)
if (target) console.log(`  Target: ${target}`)

await $`${args}`.cwd(root)

console.log(`\nDone! Binary at: ${outfile}`)
