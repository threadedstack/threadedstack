export type TAuthConfig = {
  apiKey: string
  proxyUrl?: string
  insecure?: boolean
}

export type TDisplayConfig = {
  theme?: 'dark' | 'light' | 'auto'
  verbose?: boolean
  markdown?: boolean
  timestamps?: boolean
}

export type TBehaviorConfig = {
  autoResume?: boolean
  maxHistory?: number
  confirmTools?: boolean
}

export type TSandboxConfig = {
  provider?: 'local' | 'e2b'
  timeout?: number
  envVars?: Record<string, string>
}

export type THooksConfig = {
  onSessionStart?: string
  onSessionEnd?: string
  onToolCall?: string
  onToolResult?: string
  onError?: string
  onMessage?: string
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
