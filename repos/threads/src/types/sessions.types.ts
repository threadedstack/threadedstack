export type TSandboxStatus = 'stopped' | 'starting' | 'running' | 'error'

export type TOpenSession = {
  sandboxId: string
  sessionId: string
  threadId: string
  runtime: string
  projectId: string
  podName: string
}

export type TOpenSessionOpts = {
  sandboxId: string
  orgId: string
  projectId: string
  run?: boolean
  reconnectSessionId?: string | null
}
