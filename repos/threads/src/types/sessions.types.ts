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
  threadId: string
  sandboxId: string
  sessionId: string
  projectId: string
  instanceId: string
  podOwnerUserId: string
  visibility: ESandboxSessionVisibility
}

export type TOpenSessionOpts = {
  orgId: string
  run?: boolean
  cols?: number
  rows?: number
  sandboxId: string
  projectId: string
  instanceId?: string
  newInstance?: boolean
  sessionId?: string | null
}

export type TSessionCategory = `connected` | `disconnected` | `shared`

export type TClassifiedSession = Omit<TSandboxSession, `orgId` | `instanceId`> & {
  category: TSessionCategory
  hasShellSession: boolean
}

export type TStopSandboxResult =
  | { stopped: true }
  | { stopped: false; activeSessions: TSandboxSession[] }
