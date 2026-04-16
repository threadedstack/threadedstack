import type { WebSocket } from 'ws'
import type { Client, ClientChannel } from 'ssh2'
import type {
  TerminalParser,
  ESandboxSessionVisibility,
  TParsedEvent,
  TToolState,
  TInteraction,
} from '@tdsk/domain'
import type { RingBuffer } from '@TBE/utils/ringBuffer'

export type TWebSocketMeta = {
  sessionId: string
  joinedUserId?: string
}

export type TShellSession = {
  readonly orgId: string
  readonly userId: string
  readonly sessionId: string
  readonly sshClient: Client
  readonly threadId: string
  readonly sandboxId: string
  readonly buffer: RingBuffer
  readonly sshStream: ClientChannel
  parser: TerminalParser
  attachments: Set<WebSocket>
  ttlTimer: NodeJS.Timeout | null
  toolState: TToolState
  lastRunningToolCall: (TParsedEvent & { type: 'tool-call' }) | null
  projectId?: string
  visibility: ESandboxSessionVisibility
}

export type TShellControlMsg =
  | { type: `resize`; cols: number; rows: number }
  | { type: `signal`; signal: `SIGINT` | `SIGTSTP` }
  | { type: `visibility`; visibility: ESandboxSessionVisibility }
  | { type: `permission-response`; response: `y` | `n` }
  | { type: `gui-interaction`; interaction: TInteraction }

type TSessionIdentity = {
  runtime: string
  threadId: string
  sessionId: string
  sandboxId: string
  podOwnerUserId: string
}

export type TShellServerMsg =
  | { type: `error`; message: string }
  | { type: `disconnected`; reason: string }
  | { type: `user-left`; sessionId: string; userId: string }
  | { type: `user-joined`; sessionId: string; userId: string }
  | { type: `visibility`; sessionId: string; visibility: ESandboxSessionVisibility }
  | (TSessionIdentity & { type: `connected` })
  | (TSessionIdentity & {
      type: `reconnected`
      bufferedBytes: number
      visibility: ESandboxSessionVisibility
    })
  | (TSessionIdentity & { type: `joined` })
