#!/usr/bin/env bun

import { $ } from 'bun'
import { join, resolve } from 'node:path'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const root = resolve(import.meta.dirname, `..`)
const distDir = join(root, `dist`)
const entrypoint = join(root, `src`, `main`)
const pkg = JSON.parse(readFileSync(join(root, `package.json`), `utf-8`))

if (!existsSync(distDir)) mkdirSync(distDir, { recursive: true })

const isCompile = process.argv.includes(`--compile`)
const isPublish = process.argv.includes(`--publish`)

const Targets = [
  { platform: `darwin-arm64`, bunTarget: `bun-darwin-arm64`, bin: `tsa` },
  { platform: `darwin-x64`, bunTarget: `bun-darwin-x64`, bin: `tsa` },
  { platform: `linux-x64`, bunTarget: `bun-linux-x64`, bin: `tsa` },
  { platform: `linux-arm64`, bunTarget: `bun-linux-arm64`, bin: `tsa` },
  { platform: `win32-x64`, bunTarget: `bun-windows-x64`, bin: `tsa.exe` },
]

console.log(`Bundling tsa...`)
console.log(`  Entry: ${entrypoint}`)

const result = await Bun.build({
  entrypoints: [entrypoint],
  outdir: distDir,
  target: `bun`,
  minify: true,
  define: {
    __TDSK_TSA_VERSION__: JSON.stringify(pkg.version),
  },
})

if (!result.success) {
  console.error(`Build failed:`)
  for (const msg of result.logs) {
    console.error(msg)
  }
  process.exit(1)
}

const bundleName = `main.js`
const bundlePath = join(distDir, bundleName)
console.log(`  Output: ${bundlePath}`)

if (isPublish) {
  console.log(`\nCross-compiling for ${Targets.length} platforms...`)

  for (const { platform, bunTarget, bin } of Targets) {
    const outDir = join(root, `npm`, platform)
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

    const outfile = join(outDir, bin)
    console.log(`  ${platform} → ${outfile}`)
    await $`bun build ${bundlePath} --compile --target=${bunTarget} --outfile=${outfile}`.cwd(root)
  }

  const binDir = join(root, `bin`)
  if (!existsSync(binDir)) mkdirSync(binDir, { recursive: true })
  const binFile = join(binDir, `tsa`)
  writeFileSync(binFile, ``)
  chmodSync(binFile, 0o755)

  console.log(`\nAll platforms compiled!`)
} else if (isCompile) {
  const outfile = join(distDir, `tsa`)

  console.log(`\nCompiling to native binary...`)
  console.log(`  Output: ${outfile}`)

  await $`bun build ${bundlePath} --compile --outfile ${outfile}`.cwd(root)
}

console.log(`\nDone!`)
