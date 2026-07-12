import type { TThemeColors, TConnectionStatus } from '@TSA/types'

import { EConnectionStatus } from '@TSA/types'
import { isFeatureEnabled } from '@tdsk/domain'

export const AgentsEnabled = isFeatureEnabled('agents')

export const ApiKeyPrefix = `tdsk_`

// Defaults
export const DefaultMaxSteps = 10
export const DefaultMaxHistory = 50
export const UpstreamTimeoutMS = 30_000
export const DefaultTheme = `dark` as const
export const DefaultSandboxTimeout = 300000
export const LoginTimeoutMs = 5 * 60 * 1000
/** Idle timeout for an in-flight Executor.run() WS session — reset on every
 * inbound message (including the server's WsPingIntervalMS=25s heartbeat), so
 * a legitimately long-running turn never trips it as long as the connection
 * is alive, but a silent stall (dropped message, hung proxy) is caught. */
export const ExecutorIdleTimeoutMs = 90_000

// Retry
export const MaxRetries = 3
export const RetryDelays = [1000, 3000, 9000]

export const ConnectionColors: Record<TConnectionStatus, keyof TThemeColors> = {
  [EConnectionStatus.connected]: `success`,
  [EConnectionStatus.disconnected]: `error`,
  [EConnectionStatus.reconnecting]: `warning`,
}

export const ToolDisplayNames: Record<string, string> = {
  readFile: `Read file`,
  writeFile: `Wrote file`,
  shellExec: `Ran command`,
  deleteFile: `Deleted file`,
  webFetch: `Fetched webpage`,
  codeSearch: `Searched code`,
  listDir: `Listed directory`,
  webSearch: `Searched the web`,
}

export const SpinnerFrames = [`⠋`, `⠙`, `⠹`, `⠸`, `⠼`, `⠴`, `⠦`, `⠧`, `⠇`, `⠏`]

/** Commands that work without authentication */
export const PreAuthCommands = new Set([`login`, `help`, `exit`, `quit`, `q`, `h`, `li`])
