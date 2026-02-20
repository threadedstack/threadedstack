import { join } from 'node:path'

/**
 * Package version — injected at build time via Bun's `define` option.
 * When running from source (bun run src/index.ts), the global is undefined
 * and we fall back to reading package.json dynamically.
 */
const resolveVersion = (): string => {
  try {
    // @ts-expect-error Injected by build script via `define`
    return __TDSK_REPL_VERSION__
  } catch {
    // Running from source — resolve package.json dynamically
    try {
      const { createRequire } = require('node:module')
      const req = createRequire(import.meta.url)
      return req('../../package.json').version
    } catch {
      return `0.0.0`
    }
  }
}

const pkgVersion = resolveVersion()

export const TDSK_REPL_VERSION = pkgVersion

// Keep backward-compatible alias
export const Version = pkgVersion

// Paths
export const ConfigDir = join(process.env.HOME || `~`, `.config`, `tdsk`, `repl`)
export const ConfigPath = join(ConfigDir, `config.yaml`)
export const HistoryPath = join(ConfigDir, `history`)

// Project context
export const ProjectDir = `.tdsk`
export const AgentsFile = `AGENTS.md`
export const ContextDir = `.tdsk/context`
export const ProjectConfig = `.tdsk/config.yaml`

// Defaults
export const DefaultMaxSteps = 10
export const DefaultMaxHistory = 50
export const DefaultTheme = `dark` as const
export const DefaultSandboxTimeout = 300000

// TODO: fix this, it should default to production URL once production is deployed
export const DefaultProxyUrl = `https://px.local.threadedstack.app`

// Retry
export const MaxRetries = 3
export const RetryDelays = [1000, 3000, 9000]
