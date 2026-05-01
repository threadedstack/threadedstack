import type { TSyncConfig } from '@tdsk/domain'
import type { TThemeType } from '@TSA/types/theme.types'

export type TAuthConfig = {
  token?: string
  apiKey?: string
  neonAuthUrl?: string
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
  sandbox?: string
  project?: string
  auth?: TAuthConfig
  sync?: TSyncConfig
  hooks?: THooksConfig
  tools?: TToolsConfig
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
