import type {
  IMutagenClient,
  TSyncMode,
  TSyncSessionOpts,
  TSyncSession,
  TSyncStatus,
} from '@tdsk/domain'

import { promisify } from 'util'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { createRequire } from 'module'
import { execFile } from 'child_process'
import { platform, arch, tmpdir } from 'os'
import { ensureSshConfig } from '@TSA/services/sync/sshConfig'
import {
  TdskBinDir,
  MutagenBinPath,
  MutagenAgentsPath,
  MutagenNpmVersion,
} from '@TSA/constants/sync'
import {
  mkdirSync,
  chmodSync,
  unlinkSync,
  existsSync,
  readdirSync,
  copyFileSync,
  writeFileSync,
} from 'fs'

const execFileAsync = promisify(execFile)

/**
 * Copy the mutagen binary + agents bundle from a source directory.
 */
const installFromSource = (sourceDir: string): void => {
  mkdirSync(TdskBinDir, { recursive: true })

  const bin = join(sourceDir, `mutagen`)
  copyFileSync(bin, MutagenBinPath)
  chmodSync(MutagenBinPath, 0o755)

  const agents = join(sourceDir, `mutagen-agents.tar.gz`)
  if (existsSync(agents) && !existsSync(MutagenAgentsPath)) {
    copyFileSync(agents, MutagenAgentsPath)
  }
}

/**
 * Download the mutagen binary from the npm registry.
 * Fetches the platform-specific tarball and extracts bin/mutagen + bin/mutagen-agents.tar.gz.
 */
const downloadFromNpm = async (): Promise<void> => {
  const pkg = `mutagen-${platform()}-${arch()}`
  const tarballUrl = `https://registry.npmjs.org/@nuanced-dev/${pkg}/-/${pkg}-${MutagenNpmVersion}.tgz`

  process.stderr.write(`Installing mutagen (${platform()}-${arch()})...\n`)

  const response = await fetch(tarballUrl)
  if (!response.ok) {
    throw new Error(
      `Failed to download mutagen: HTTP ${response.status} from ${tarballUrl}`
    )
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const contentLength = response.headers.get('content-length')
  if (contentLength && buffer.length !== Number(contentLength)) {
    throw new Error(
      `Incomplete download: got ${buffer.length} bytes, expected ${contentLength}. Check your network connection.`
    )
  }
  if (buffer.length === 0) {
    throw new Error(
      `Empty response from ${tarballUrl}. Package may not exist for ${platform()}-${arch()}.`
    )
  }

  const tmpFile = join(tmpdir(), `tdsk-mutagen-${Date.now()}.tgz`)
  writeFileSync(tmpFile, buffer)

  mkdirSync(TdskBinDir, { recursive: true })

  try {
    await execFileAsync(`tar`, [
      `xzf`,
      tmpFile,
      `-C`,
      TdskBinDir,
      `--strip-components=2`,
      `package/bin/mutagen`,
      `package/bin/mutagen-agents.tar.gz`,
    ])
    chmodSync(MutagenBinPath, 0o755)
    process.stderr.write(`Mutagen installed to ${TdskBinDir}\n`)
  } catch (err: any) {
    if (err?.code === 'ENOENT') {
      throw new Error(
        'tar command not found. Install tar to enable automatic mutagen installation.'
      )
    }
    throw new Error(`Failed to extract mutagen tarball: ${err?.stderr || err?.message}`)
  } finally {
    try {
      unlinkSync(tmpFile)
    } catch (cleanupErr: any) {
      process.stderr.write(
        `Warning: could not remove temp file ${tmpFile}: ${cleanupErr.message}\n`
      )
    }
  }
}

/**
 * Try to find the binary from the pnpm store (dev environment only).
 * Returns the source bin/ directory path, or empty string if not found.
 */
const findInPnpmStore = (): string => {
  const platformPkg = `mutagen-${platform()}-${arch()}`

  try {
    const req = createRequire(import.meta.url)
    const mainPkgJson = req.resolve(`@nuanced-dev/mutagen/package.json`)
    const binDir = join(dirname(mainPkgJson), `..`, platformPkg, `bin`)
    if (existsSync(join(binDir, `mutagen`))) return binDir
  } catch (err: any) {
    if (err?.code !== 'MODULE_NOT_FOUND') {
      process.stderr.write(`Warning: pnpm store check failed: ${err.message}\n`)
    }
  }

  try {
    const moduleDir = dirname(fileURLToPath(import.meta.url))
    let dir = moduleDir
    for (let i = 0; i < 10; i++) {
      const pnpmDir = join(dir, `node_modules`, `.pnpm`)
      if (existsSync(pnpmDir)) {
        const entries = readdirSync(pnpmDir).filter((e) =>
          e.startsWith(`@nuanced-dev+${platformPkg}@`)
        )
        for (const entry of entries) {
          const binDir = join(
            pnpmDir,
            entry,
            `node_modules`,
            `@nuanced-dev`,
            platformPkg,
            `bin`
          )
          if (existsSync(join(binDir, `mutagen`))) return binDir
        }
      }
      dir = dirname(dir)
    }
  } catch (err: any) {
    if (err?.code !== `ENOENT` && err?.code !== `ERR_INVALID_URL`) {
      process.stderr.write(`Warning: pnpm store scan failed: ${err.message}\n`)
    }
  }

  return ''
}

/**
 * Ensure the mutagen binary is available.
 * Resolution order:
 *   1. ~/.config/tdsk/bin/mutagen (already installed)
 *   2. pnpm store (dev environment)
 *   3. Download from npm registry (end-user)
 */
const ensureMutagenBin = async (): Promise<string> => {
  if (existsSync(MutagenBinPath)) return MutagenBinPath

  const pnpmSource = findInPnpmStore()
  if (pnpmSource) {
    installFromSource(pnpmSource)
    if (!existsSync(MutagenBinPath)) {
      process.stderr.write(
        `Warning: pnpm store binary vanished during copy; downloading from npm.\n`
      )
    } else {
      return MutagenBinPath
    }
  }

  await downloadFromNpm()

  if (!existsSync(MutagenBinPath)) {
    throw new Error(
      `Mutagen installation failed. Place the mutagen binary at ${MutagenBinPath}`
    )
  }

  return MutagenBinPath
}

/**
 * Run the mutagen CLI binary with the given arguments.
 */
const runMutagen = async (
  args: string[]
): Promise<{ stdout: string; stderr: string }> => {
  const bin = await ensureMutagenBin()
  try {
    return await execFileAsync(bin, args, {
      maxBuffer: 10 * 1024 * 1024,
    })
  } catch (err: any) {
    const stderr = err?.stderr || err?.message || `unknown error`
    throw Object.assign(
      new Error(`mutagen ${args[0]} failed: ${stderr}`, { cause: err }),
      { exitCode: err?.code, stderr }
    )
  }
}

export class CliDriver implements IMutagenClient {
  async createSession(opts: TSyncSessionOpts): Promise<TSyncSession> {
    const args = [
      `sync`,
      `create`,
      `--name=${opts.name}`,
      `--mode=${opts.mode}`,
      `--stage-mode-beta=${opts.stageMode || `internal`}`,
      ...opts.ignores.map((i) => `--ignore=${i}`),
      ...Object.entries(opts.labels).map(([k, v]) => `--label=${k}=${v}`),
      opts.source,
      `sandbox@${opts.sandboxId}:${opts.target}`,
    ]

    await runMutagen(args)

    return {
      id: opts.name,
      name: opts.name,
      status: 'watching',
      source: opts.source,
      target: opts.target,
      mode: opts.mode,
      labels: opts.labels,
    }
  }

  async terminateSession(sessionId: string): Promise<void> {
    await runMutagen([`sync`, `terminate`, sessionId])
  }

  async pauseSession(sessionId: string): Promise<void> {
    await runMutagen([`sync`, `pause`, sessionId])
  }

  async resumeSession(sessionId: string): Promise<void> {
    await runMutagen([`sync`, `resume`, sessionId])
  }

  async flushSession(sessionId: string): Promise<void> {
    await runMutagen([`sync`, `flush`, sessionId])
  }

  async listSessions(labels?: Record<string, string>): Promise<TSyncSession[]> {
    const args = [`sync`, `list`, `--long`]
    if (labels) {
      const selector = Object.entries(labels)
        .map(([k, v]) => `${k}=${v}`)
        .join(`,`)
      args.push(`--label-selector=${selector}`)
    }
    const result = await runMutagen(args)
    return this.#parseListOutput(result.stdout)
  }

  async getSession(sessionId: string): Promise<TSyncSession | null> {
    const sessions = await this.listSessions()
    return sessions.find((s) => s.id === sessionId || s.name === sessionId) || null
  }

  async ensureDaemon(): Promise<void> {
    ensureSshConfig()
    await runMutagen([`daemon`, `start`])
  }

  async stopDaemon(): Promise<void> {
    await runMutagen([`daemon`, `stop`])
  }

  #parseListOutput(stdout: string): TSyncSession[] {
    if (!stdout.trim()) return []

    const sessions: TSyncSession[] = []
    const blocks = stdout.split(/\n-{20,}\n/).filter(Boolean)

    for (const block of blocks) {
      const nameMatch = block.match(/Name:\s*(.+)/i)
      const idMatch = block.match(/Identifier:\s*(.+)/i)
      const statusMatch = block.match(/Status:\s*(.+)/i)
      const alphaMatch = block.match(/Alpha:\s*(.+)/i)
      const betaMatch = block.match(/Beta:\s*(.+)/i)
      const modeMatch =
        block.match(/Synchronization mode:\s*(.+)/i) || block.match(/Mode:\s*(.+)/i)

      const labels: Record<string, string> = {}
      const labelsSection = block.match(/Labels:\s*\n((?:[\t ]+.+\n?)*)/i)
      if (labelsSection) {
        for (const line of labelsSection[1].split(`\n`)) {
          const kv = line.trim().match(/^(\w+):\s*(.+)$/)
          if (kv) labels[kv[1]] = kv[2]
        }
      }

      if (nameMatch) {
        sessions.push({
          id: idMatch?.[1]?.trim() || nameMatch[1].trim(),
          name: nameMatch[1].trim(),
          status: this.#mapStatus(statusMatch?.[1]?.trim()),
          source: this.#stripUrl(alphaMatch?.[1]?.trim()),
          target: this.#stripUrl(betaMatch?.[1]?.trim()),
          mode: this.#parseMode(modeMatch?.[1]?.trim()),
          labels,
        })
      }
    }

    return sessions
  }

  #stripUrl(raw?: string): string | undefined {
    if (!raw) return undefined
    return raw.startsWith(`URL: `) ? raw.slice(5) : raw
  }

  #parseMode(raw?: string): TSyncMode | undefined {
    if (!raw) return undefined
    const lower = raw.toLowerCase().replace(/[\s-]/g, ``)
    if (lower.includes(`onewayreplica`)) return `one-way-replica`
    if (lower.includes(`onewaysafe`)) return `one-way-safe`
    if (lower.includes(`twowaysafe`)) return `two-way-safe`
    if (lower.includes(`twowayresolved`)) return `two-way-resolved`
    return undefined
  }

  #mapStatus(raw?: string): TSyncStatus {
    if (!raw) return `disconnected`
    const lower = raw.toLowerCase()
    if (lower.includes(`watching`)) return `watching`
    if (lower.includes(`scanning`)) return `scanning`
    if (lower.includes(`staging`)) return `staging`
    if (lower.includes(`transitioning`) || lower.includes(`saving`)) return `syncing`
    if (lower.includes(`paused`)) return `paused`
    if (lower.includes(`error`) || lower.includes(`halted`)) return `errored`
    if (lower.includes(`disconnected`) || lower.includes(`connecting`))
      return `disconnected`
    return `idle`
  }
}
