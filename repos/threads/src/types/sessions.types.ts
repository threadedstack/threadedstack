import type { ESandboxSessionVisibility, TSandboxSession } from '@tdsk/domain'

export type TCommand = `stop` | `restart` | `recreate`

export type TSessionCommandsProps = {
  sandboxId: string
  sessionId: string
  projectId: string
  isOwner: boolean
  onPendingOp: (op: `restart` | `recreate` | null) => void
}

export type TSandboxStatus = 'stopped' | 'starting' | 'running' | 'error'

export type TOpenSession = {
  runtime: string
  podName: string
  threadId: string
  sandboxId: string
  sessionId: string
  projectId: string
  podOwnerUserId: string
  visibility: ESandboxSessionVisibility
}

export type TOpenSessionOpts = {
  orgId: string
  run?: boolean
  sandboxId: string
  projectId: string
  /**
   * Session intent:
   * - `undefined` — auto-resolve from sessionStorage (reconnect first stored session)
   * - `string` — reconnect/join a specific session by ID
   * - `null` — force creation of a new session (ignore stored sessions)
   */
  sessionId?: string | null
}

export type TSessionCategory = `connected` | `disconnected` | `shared`

export type TClassifiedSession = Omit<TSandboxSession, `orgId` | `podName`> & {
  category: TSessionCategory
}
