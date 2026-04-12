import type { WebSocket } from 'ws'
import type { Client, ClientChannel } from 'ssh2'
import type { TerminalParser, ESandboxSessionVisibility } from '@tdsk/domain'
import type { RingBuffer } from '@TBE/utils/ringBuffer'

export type TShellWebSocket = WebSocket & {
  __joinedUserId?: string
  __shellSessionId?: string
}

export type TShellSession = {
  orgId: string
  userId: string
  sessionId: string
  sshClient: Client
  threadId: string
  sandboxId: string
  buffer: RingBuffer
  parser: TerminalParser
  sshStream: ClientChannel
  attachments: Set<WebSocket>
  ttlTimer: NodeJS.Timeout | null
  projectId?: string
  visibility: ESandboxSessionVisibility
}

export type TShellControlMsg =
  | { type: `resize`; cols: number; rows: number }
  | { type: `signal`; signal: `SIGINT` | `SIGTSTP` }
  | { type: `reconnect`; sessionId: string }
  | { type: `visibility`; visibility: ESandboxSessionVisibility }

export type TShellServerMsg =
  | { type: `error`; message: string }
  | { type: `disconnected`; reason: string }
  | { type: `user-left`; sessionId: string; userId: string }
  | { type: `user-joined`; sessionId: string; userId: string }
  | { type: `visibility`; sessionId: string; visibility: ESandboxSessionVisibility }
  | {
      type: `connected`
      runtime: string
      threadId: string
      sessionId: string
      sandboxId: string
      podOwnerUserId: string
    }
  | {
      type: `reconnected`
      runtime: string
      threadId: string
      sessionId: string
      sandboxId: string
      bufferedBytes: number
      podOwnerUserId: string
      visibility: ESandboxSessionVisibility
    }
  | {
      type: `joined`
      runtime: string
      threadId: string
      sessionId: string
      sandboxId: string
      podOwnerUserId: string
    }
