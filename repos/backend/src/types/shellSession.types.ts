import type { WebSocket } from 'ws'
import type { PassThrough } from 'stream'
import type { RingBuffer } from '@TBE/utils/ringBuffer'
import type { ESandboxSessionVisibility, TSandboxSession } from '@tdsk/domain'

export type TWebSocketMeta = {
  sessionId: string
  joinedUserId?: string
}

export type TPtyRecorder = {
  write(data: Uint8Array): void
  getRawBuffer(): Uint8Array
  destroy(): void
}

export type TShellSession = {
  readonly orgId: string
  readonly userId: string
  readonly threadId: string
  readonly sandboxId: string
  readonly sessionId: string
  readonly stdin: PassThrough
  readonly buffer: RingBuffer
  readonly stdout: PassThrough
  readonly closeExec: () => void
  readonly resize: (cols: number, rows: number) => void

  projectId?: string
  ptyRecorder: TPtyRecorder
  attachments: Set<WebSocket>
  ttlTimer: NodeJS.Timeout | null
  visibility: ESandboxSessionVisibility
}

export type TShellControlMsg =
  | { type: `resize`; cols: number; rows: number }
  | { type: `signal`; signal: `SIGINT` | `SIGTSTP` }
  | { type: `visibility`; visibility: ESandboxSessionVisibility }
  | { type: `permission-response`; response: `y` | `n` }

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
  | { type: `sandbox-stopping`; sandboxId: string }
  | { type: `sessions-updated`; sandboxId: string; sessions: TSandboxSession[] }
  | (TSessionIdentity & { type: `connected` })
  | (TSessionIdentity & {
      type: `reconnected`
      bufferedBytes: number
      visibility: ESandboxSessionVisibility
    })
  | (TSessionIdentity & { type: `joined` })
