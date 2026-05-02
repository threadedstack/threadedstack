import type { ESandboxSessionVisibility, TSandboxSession } from '@tdsk/domain'

export type TViewMode = `gui` | `terminal`
export type TCommand = `stop` | `restart` | `recreate`
export type TPendingOp = `restart` | `recreate` | null

export type TSessionLocationState = {
  sandboxId?: string
  projectId?: string
}

export type TSessionCommandsProps = {
  isOwner: boolean
  sandboxId: string
  sessionId: string
  projectId: string
  onPendingOp: (op: TPendingOp) => void
}

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
  hasShellSession: boolean
}

export type TStopSandboxResult =
  | { stopped: true }
  | { stopped: false; activeSessions: TSandboxSession[] }
