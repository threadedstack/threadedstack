#!/usr/bin/env bun

import { $ } from 'bun'
import { join, resolve } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'

const root = resolve(import.meta.dirname, `..`)

const versionIdx = process.argv.indexOf(`--version`)
const version = versionIdx !== -1 ? process.argv[versionIdx + 1] : null

if (!version) {
  console.error(`Usage: bun run scripts/publish.ts --version <version>`)
  process.exit(1)
}

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
  await $`npm publish --access public ${provenance}`.cwd(pkgDir)
}

console.log(`\nPlatform packages published. Main package will be published by semantic-release.`)
