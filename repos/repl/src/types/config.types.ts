import type { TThemeType } from '@TRL/types/theme.types'
import type { ESandboxType } from '@tdsk/domain'

export type TAuthConfig = {
  apiKey: string
  proxyUrl?: string
  insecure?: boolean
}

export type TDisplayConfig = {
  verbose?: boolean
  theme?: TThemeType
  markdown?: boolean
  timestamps?: boolean
}

export type TBehaviorConfig = {
  autoResume?: boolean
  maxHistory?: number
  confirmTools?: boolean
}

export type TSandboxConfig = {
  timeout?: number
  provider?: ESandboxType
  envVars?: Record<string, string>
}

export type THooksConfig = {
  onError?: string
  onMessage?: string
  onToolCall?: string
  onToolResult?: string
  onSessionEnd?: string
  onSessionStart?: string
}

export type TToolsConfig = {
  confirm?: string[]
  block?: string[]
}

export type TReplConfig = {
  org?: string
  agent?: string
  project?: string
  auth?: TAuthConfig
  hooks?: THooksConfig
  tools?: TToolsConfig
  sandbox?: TSandboxConfig
  display?: TDisplayConfig
  behavior?: TBehaviorConfig
}

export type TProjectConfig = {
  org?: string
  agent?: string
  context?: string[]
  hooks?: THooksConfig
  tools?: TToolsConfig
}
