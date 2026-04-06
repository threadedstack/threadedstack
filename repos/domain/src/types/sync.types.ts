export type TSyncMode =
  | `one-way-replica`
  | `one-way-safe`
  | `two-way-safe`
  | `two-way-resolved`

export type TSyncStatus =
  | `watching`
  | `scanning`
  | `staging`
  | `syncing`
  | `idle`
  | `paused`
  | `errored`
  | `disconnected`

export type TSandboxSyncDefaults = {
  mode?: TSyncMode
  ignores?: string[]
  targetBase?: string
}

export type TSyncRule = {
  name: string
  source: string
  target?: string
  mode?: TSyncMode
  ignores?: string[]
}

export type TSyncRuleOverride = { name: string } & Partial<Omit<TSyncRule, 'name'>>

export type TSyncConfig = {
  autoStart?: boolean
  rules?: TSyncRule[]
  defaultIgnores?: string[]
  sandboxes?: Record<string, { rules?: TSyncRuleOverride[] }>
}

export type TSyncSessionLabels = {
  sandboxId: string
  ruleName: string
  orgId: string
} & Record<string, string>

export type TSyncSessionOpts = {
  name: string
  source: string
  target: string
  mode: TSyncMode
  ignores: string[]
  sandboxId: string
  labels: TSyncSessionLabels
  stageMode?: `neighboring` | `mutagen`
}

export type TSyncSession = {
  id: string
  name: string
  source?: string
  target?: string
  mode?: TSyncMode
  errors?: string[]
  status: TSyncStatus
  labels: Record<string, string>
}

export type IMutagenClient = {
  stopDaemon(): Promise<void>
  ensureDaemon(): Promise<void>
  pauseSession(sessionId: string): Promise<void>
  resumeSession(sessionId: string): Promise<void>
  flushSession(sessionId: string): Promise<void>
  terminateSession(sessionId: string): Promise<void>
  getSession(sessionId: string): Promise<TSyncSession | null>
  createSession(opts: TSyncSessionOpts): Promise<TSyncSession>
  listSessions(labels?: Record<string, string>): Promise<TSyncSession[]>
}
