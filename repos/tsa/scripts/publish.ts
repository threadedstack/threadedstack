#!/usr/bin/env bun

import { $ } from 'bun'
import { join, resolve } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'

const root = resolve(import.meta.dirname, `..`)

const versionIdx = process.argv.indexOf(`--version`)
const version = versionIdx !== -1
  ? process.argv[versionIdx + 1]
  : JSON.parse(readFileSync(join(root, `package.json`), `utf-8`)).version

if (!version) {
  console.error(`Usage: bun run scripts/publish.ts [--version <version>] [--otp <code>]`)
  process.exit(1)
}

const otpIdx = process.argv.indexOf(`--otp`)
const otp = otpIdx !== -1 ? process.argv[otpIdx + 1] : ``

const Platforms = [
  `darwin-arm64`,
  `darwin-x64`,
  `linux-x64`,
  `linux-arm64`,
  `win32-x64`,
]

console.log(`Publishing @tdsk/tsa v${version}\n`)

console.log(`Syncing version across platform packages...`)
for (const platform of Platforms) {
  const pkgPath = join(root, `npm`, platform, `package.json`)
  const platformPkg = JSON.parse(readFileSync(pkgPath, `utf-8`))
  platformPkg.version = version
  writeFileSync(pkgPath, JSON.stringify(platformPkg, null, 2) + `\n`)
  console.log(`  ${platformPkg.name} → ${version}`)
}

const mainPkgPath = join(root, `package.json`)
const mainPkg = JSON.parse(readFileSync(mainPkgPath, `utf-8`))
mainPkg.version = version
if (mainPkg.optionalDependencies) {
  for (const dep of Object.keys(mainPkg.optionalDependencies)) {
    if (dep.startsWith(`@tdsk/tsa-`)) {
      mainPkg.optionalDependencies[dep] = version
    }
  }
}
writeFileSync(mainPkgPath, JSON.stringify(mainPkg, null, 2) + `\n`)
console.log(`  @tdsk/tsa → ${version}`)

console.log(`\nCross-compiling binaries...`)
await $`bun run build:publish`.cwd(root)

console.log(`\nPublishing platform packages...`)
for (const platform of Platforms) {
  const pkgDir = join(root, `npm`, platform)
  console.log(`  Publishing @tdsk/tsa-${platform}...`)
  const provenance = process.env.GITHUB_ACTIONS ? `--provenance` : ``
  const otpFlag = otp ? `--otp=${otp}` : ``
  await $`npm publish --access public ${provenance} ${otpFlag}`.cwd(pkgDir)
}

if (process.env.GITHUB_ACTIONS) {
  console.log(`\nPlatform packages published. Main package will be published by semantic-release.`)
} else {
  console.log(`\nPublishing main @tdsk/tsa package...`)
  const otpFlag = otp ? `--otp=${otp}` : ``
  await $`npm publish --access public ${otpFlag}`.cwd(root)
  console.log(`\nAll packages published successfully!`)
}
