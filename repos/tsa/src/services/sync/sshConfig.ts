import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { execFileSync } from 'child_process'
import {
  SshDir,
  SshConfig,
  TdskBinDir,
  PublicKeyPath,
  TdskConfigDir,
  PrivateKeyPath,
  ProxyWrapperPath,
} from '@TSA/constants/sync'
import {
  mkdirSync,
  existsSync,
  unlinkSync,
  realpathSync,
  readFileSync,
  writeFileSync,
} from 'fs'

const buildSandboxBlock = (): string =>
  [
    `Host sb_*`,
    `  ProxyCommand ${ProxyWrapperPath} %h`,
    `  User sandbox`,
    `  IdentityFile ${PrivateKeyPath}`,
    `  StrictHostKeyChecking no`,
    `  UserKnownHostsFile /dev/null`,
    `  LogLevel ERROR`,
  ].join('\n')

/**
 * Resolve the path to the `tsa` binary for the ProxyCommand wrapper.
 * Checks compiled binary first, then falls back to bun + source.
 */
const resolveTsaBin = (): string => {
  // 1. Running as compiled tsa binary
  if (process.argv[0]?.endsWith('/tsa')) {
    try {
      return realpathSync(process.argv[0])
    } catch (err: any) {
      if (err?.code !== 'ENOENT')
        process.stderr.write(`Warning: could not resolve tsa binary: ${err?.message}\n`)
    }
  }

  // 2. Running via bun/node with tsa entry
  if (process.argv[1]?.includes('tsa')) {
    try {
      const script = realpathSync(process.argv[1])
      return `${process.argv[0]} ${script}`
    } catch (err: any) {
      if (err?.code !== 'ENOENT')
        process.stderr.write(`Warning: could not resolve tsa script: ${err?.message}\n`)
    }
  }

  // 3. Find compiled dist/tsa relative to this module
  try {
    const moduleDir = dirname(fileURLToPath(import.meta.url))
    const distTsa = join(moduleDir, '..', '..', '..', 'dist', 'tsa')
    if (existsSync(distTsa)) return realpathSync(distTsa)
  } catch (err: any) {
    if (err?.code !== 'ERR_INVALID_URL')
      process.stderr.write(`Warning: could not resolve dist/tsa: ${err?.message}\n`)
  }

  // 4. Find dist/tsa relative to cwd (integration tests run from repos/integration)
  const cwdCandidates = [
    join(process.cwd(), `dist`, `tsa`),
    join(process.cwd(), `..`, `tsa`, `dist`, `tsa`),
  ]
  for (const candidate of cwdCandidates) {
    if (existsSync(candidate)) {
      try {
        return realpathSync(candidate)
      } catch (err: any) {
        if (err?.code !== 'ENOENT')
          process.stderr.write(
            `Warning: could not resolve ${candidate}: ${err?.message}\n`
          )
      }
    }
  }

  // 5. Fallback: bun + source entry relative to this module
  try {
    const moduleDir = dirname(fileURLToPath(import.meta.url))
    const srcMain = join(moduleDir, `..`, `..`, `main.ts`)
    if (existsSync(srcMain)) return `bun ${realpathSync(srcMain)}`
  } catch (err: any) {
    if (err?.code !== 'ERR_INVALID_URL')
      process.stderr.write(`Warning: could not resolve source entry: ${err?.message}\n`)
  }

  process.stderr.write(
    `Warning: could not locate tsa binary; SSH ProxyCommand may fail. ` +
      `Ensure 'tsa' is on your PATH or build TSA cli with 'pnpm build'.\n`
  )
  return 'tsa'
}

const ensureProxyWrapper = (): void => {
  mkdirSync(TdskBinDir, { recursive: true })

  const tsaBin = resolveTsaBin()
  const lastPath = tsaBin.includes(` `) ? tsaBin.split(` `).pop()! : tsaBin

  // TODO: Need to validate how the tsa executable is resolved when compiled
  const pkgRoot = lastPath.includes(`/dist/`)
    ? lastPath.slice(0, lastPath.indexOf(`/dist/`))
    : lastPath.includes(`/src/`)
      ? lastPath.slice(0, lastPath.indexOf(`/src/`))
      : dirname(lastPath)
  const wrapper = [
    `#!/bin/sh`,
    `cd "${pkgRoot}" 2>/dev/null`,
    `arg="$1"`,
    `SANDBOX_ID="\${arg%%--*}"`,
    `if [ "$SANDBOX_ID" = "$arg" ]; then`,
    `  exec ${tsaBin} proxy "$arg"`,
    `else`,
    `  INSTANCE_ID="\${arg#*--}"`,
    `  exec ${tsaBin} proxy "$SANDBOX_ID" "$INSTANCE_ID"`,
    `fi`,
    ``,
  ].join('\n')

  if (existsSync(ProxyWrapperPath)) {
    const current = readFileSync(ProxyWrapperPath, `utf-8`)
    if (current === wrapper) return
  }

  writeFileSync(ProxyWrapperPath, wrapper, { mode: 0o700 })
}

const ensureKeyPair = (): void => {
  if (existsSync(PrivateKeyPath) && existsSync(PublicKeyPath)) return

  mkdirSync(TdskConfigDir, { recursive: true })

  for (const p of [PrivateKeyPath, PublicKeyPath]) {
    try {
      unlinkSync(p)
    } catch (err: any) {
      if (err.code !== `ENOENT`)
        throw new Error(`Cannot remove old key ${p}: ${err.message}`)
    }
  }

  try {
    execFileSync(
      `ssh-keygen`,
      [`-t`, `ed25519`, `-f`, PrivateKeyPath, `-N`, ``, `-C`, `tdsk-sandbox`, `-q`],
      { stdio: `ignore` }
    )
  } catch (err: any) {
    if (err.code === `ENOENT`) {
      throw new Error(
        `ssh-keygen not found. Install OpenSSH (e.g., apt install openssh-client).`
      )
    }
    throw new Error(
      `ssh-keygen failed (exit ${err.status}): ${err.stderr?.toString() || err.message}`
    )
  }
}

/**
 * Replace or remove the `Host sb_*` block from SSH config content.
 */
const removeSandboxBlock = (content: string): string => {
  const lines = content.split(`\n`)
  const result: string[] = []
  let inSandboxBlock = false

  for (const line of lines) {
    if (line.trimStart().startsWith(`Host `) && line.includes(`sb_*`)) {
      inSandboxBlock = true
      continue
    }
    if (inSandboxBlock) {
      if (line.trimStart().startsWith(`Host `) || line.trimStart().startsWith(`Match `)) {
        inSandboxBlock = false
        result.push(line)
      }
      continue
    }
    result.push(line)
  }

  while (result.length > 0 && result[result.length - 1].trim() === ``) {
    result.pop()
  }

  return result.join(`\n`)
}

export const ensureSshConfig = (): void => {
  if (!existsSync(SshDir)) mkdirSync(SshDir, { mode: 0o700 })

  ensureKeyPair()
  ensureProxyWrapper()

  const existing = existsSync(SshConfig) ? readFileSync(SshConfig, `utf-8`) : ``
  const desiredBlock = buildSandboxBlock()

  if (existing.includes(desiredBlock)) return

  const cleaned = existing.includes(`Host sb_*`) ? removeSandboxBlock(existing) : existing

  const separator = cleaned.length && !cleaned.endsWith(`\n\n`) ? `\n\n` : ``
  writeFileSync(SshConfig, cleaned + separator + desiredBlock + `\n`, { mode: 0o600 })
}

export const getPublicKey = (): string => {
  ensureKeyPair()
  return readFileSync(PublicKeyPath, `utf-8`).trim()
}
