import type { TParsedEvent } from './parser.types'
import type { TJsonComponentTree } from './gui.types'

export type TShellEvent = {
  sessionId: string
  event: TParsedEvent
  chunkId?: string
  timestamp: number
}

export type TGenerativeUIEvent = {
  sessionId: string
  chunkId: string
  type: 'generative-ui'
  tree: TJsonComponentTree
  timestamp: number
}

export type TShellOutboundMessage = TShellEvent | TGenerativeUIEvent
