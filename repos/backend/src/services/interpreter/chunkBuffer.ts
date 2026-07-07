import { nanoid } from 'nanoid'
import { BypassEventTypes, EParserEvtType } from '@tdsk/domain'
import type { TParsedEvent } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'

const DebounceMs = 200

type TChunkBufferCallbacks = {
  onStampedEvent: (event: TParsedEvent, chunkId?: string) => void
  onFlush: (chunkId: string, events: TParsedEvent[]) => void | Promise<void>
}

export class ChunkBuffer {
  #currentChunkId: string = nanoid()
  #buffer: TParsedEvent[] = []
  #debounceTimer: ReturnType<typeof setTimeout> | null = null
  #callbacks: TChunkBufferCallbacks
  #destroyed = false

  constructor(callbacks: TChunkBufferCallbacks) {
    this.#callbacks = callbacks
  }

  push(event: TParsedEvent) {
    if (this.#destroyed) return

    const isBypass = (BypassEventTypes as readonly string[]).includes(event.type)

    if (isBypass) {
      this.#callbacks.onStampedEvent(event, undefined)

      if (event.type === EParserEvtType.PromptReady) {
        this.#flush()
      }
      return
    }

    this.#buffer.push(event)
    this.#callbacks.onStampedEvent(event, this.#currentChunkId)
    this.#resetDebounce()
  }

  destroy() {
    if (this.#destroyed) return
    this.#destroyed = true
    this.#flush()
    this.#clearDebounce()
  }

  #flush() {
    this.#clearDebounce()

    if (this.#buffer.length === 0) return

    const chunkId = this.#currentChunkId
    const events = [...this.#buffer]
    this.#buffer = []
    this.#currentChunkId = nanoid()

    const result = this.#callbacks.onFlush(chunkId, events)
    if (result instanceof Promise) {
      result.catch((err) => {
        logger.warn('[ChunkBuffer] onFlush error:', (err as Error).message)
      })
    }
  }

  #resetDebounce() {
    this.#clearDebounce()
    this.#debounceTimer = setTimeout(() => this.#flush(), DebounceMs)
  }

  #clearDebounce() {
    if (this.#debounceTimer) {
      clearTimeout(this.#debounceTimer)
      this.#debounceTimer = null
    }
  }
}
