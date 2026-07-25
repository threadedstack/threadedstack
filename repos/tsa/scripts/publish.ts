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

const isDry = process.argv.includes(`--dry`)

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
  const publishedPkg = JSON.parse(readFileSync(join(pkgDir, `package.json`), `utf-8`))
  console.log(`  Publishing ${publishedPkg.name}@${publishedPkg.version}...`)
  // Interpolating a possibly-empty STRING here (e.g. `` `--otp=` : `` ``) still
  // passes a literal empty-string argument to npm, which npm reads as the
  // package-spec positional arg and resolves to a bogus "undefined@0.1.0"
  // template package (npm error 403 on `registry.npmjs.org/undefined`).
  // Interpolating an ARRAY omits the flag entirely when empty.
  // --dry-run still validates against the registry when an auth token is
  // present, so a prerelease-looking dry version (e.g. 0.0.0-dryrun) needs an
  // explicit --tag or npm refuses with "You must specify a tag".
  const dryRun = isDry ? [`--dry-run`, `--tag`, `dry-run-only`] : []
  const provenance = process.env.GITHUB_ACTIONS && !isDry ? [`--provenance`] : []
  const otpFlag = otp ? [`--otp=${otp}`] : []
  await $`npm publish --access public ${dryRun} ${provenance} ${otpFlag}`.cwd(pkgDir)
}

if (isDry) {
  console.log(`\nDry run complete -- no packages were actually published.`)
} else if (process.env.GITHUB_ACTIONS) {
  console.log(`\nPlatform packages published. Main package will be published by semantic-release.`)
} else {
  console.log(`\nPublishing main @tdsk/tsa package...`)
  const otpFlag = otp ? [`--otp=${otp}`] : []
  await $`npm publish --access public ${otpFlag}`.cwd(root)
  console.log(`\nAll packages published successfully!`)
}
