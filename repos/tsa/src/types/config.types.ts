import type { TThemeType } from '@TSA/types/theme.types'
import type { ESandboxType, TSyncConfig } from '@tdsk/domain'

export type TAuthConfig = {
  token?: string
  apiKey?: string
  authUrl?: string
  proxyUrl?: string
  insecure?: boolean
  expiresAt?: string
  threadsUrl?: string
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

export type TTsaConfig = {
  org?: string
  agent?: string
  project?: string
  auth?: TAuthConfig
  sync?: TSyncConfig
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
