import type { WebSocket } from 'ws'
import type { Client, ClientChannel } from 'ssh2'
import type { TerminalParser } from '@tdsk/domain'
import type { RingBuffer } from '@TBE/utils/ringBuffer'

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
}

export type TShellControlMsg =
  | { type: `resize`; cols: number; rows: number }
  | { type: `signal`; signal: `SIGINT` | `SIGTSTP` }
  | { type: `reconnect`; sessionId: string }

export type TShellServerMsg =
  | {
      type: `connected`
      sessionId: string
      sandboxId: string
      runtime: string
      threadId: string
    }
  | { type: `reconnected`; sessionId: string; bufferedBytes: number }
  | { type: `disconnected`; reason: string }
  | { type: `error`; message: string }
