const { platform, arch } = process
const { join, dirname } = require(`path`)
const { copyFileSync, mkdirSync, chmodSync } = require(`fs`)

const Platforms = {
  [`linux-x64`]: { pkg: `@tdsk/tsa-linux-x64`, bin: `tsa` },
  [`darwin-x64`]: { pkg: `@tdsk/tsa-darwin-x64`, bin: `tsa` },
  [`darwin-arm64`]: { pkg: `@tdsk/tsa-darwin-arm64`, bin: `tsa` },
  [`linux-arm64`]: { pkg: `@tdsk/tsa-linux-arm64`, bin: `tsa` },
  [`win32-x64`]: { pkg: `@tdsk/tsa-win32-x64`, bin: `tsa.exe` },
}

const target = Platforms[`${platform}-${arch}`]
if (!target) {
  console.warn(`@tdsk/tsa: no prebuilt binary for ${platform}-${arch}`)
  process.exit(0)
}

try {
  const pkgDir = dirname(require.resolve(`${target.pkg}/package.json`))
  const src = join(pkgDir, target.bin)
  const dest = join(__dirname, `..`, `bin`, platform === `win32` ? `tsa.exe` : `tsa`)
  mkdirSync(dirname(dest), { recursive: true })
  copyFileSync(src, dest)
  if (platform !== `win32`) chmodSync(dest, 0o755)
} catch {
  console.warn(`@tdsk/tsa: could not install binary for ${platform}-${arch}`)
  process.exit(0)
}
