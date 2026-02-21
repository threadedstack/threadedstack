import type { TThemeColors, TConnectionStatus } from '@TRL/types'
import { EConnectionStatus } from '@TRL/types'

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
