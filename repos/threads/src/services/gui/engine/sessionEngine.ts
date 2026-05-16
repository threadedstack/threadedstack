import type { TPalette } from '@TTH/types/tokenizer.types'
import type { TModeContext } from '@TTH/types/parser.types'
import type { TBrowserVTerminal } from '@TTH/types'
import type { TDocument, TFeedEvent } from '@TTH/types/ast.types'

import { parse } from '@TTH/services/gui/parser'
import { tokenize } from '@TTH/services/gui/tokenizer'
import { diffToFeedEvents } from '@TTH/services/gui/visitors'
import { createBrowserTerminal } from '@TTH/services/gui/engine/wasmBridge'

type TEngineCallbacks = {
  onAST: (doc: TDocument) => void
  onFeedEvents: (events: TFeedEvent[]) => void
}

const emptyDoc: TDocument = {
  children: [],
  type: `Document`,
  mode: `interactive`,
  cursor: { x: 0, y: 0, visible: false },
  bounds: { top: 0, left: 0, bottom: 23, right: 79 },
}

export class SessionEngine {
  private dirty = false
  private lastDataTime = 0
  private destroyed = false
  readonly sessionId: string
  private consecutiveErrors = 0
  private consecutiveDirtyCycles = 0
  private rafId: number | null = null
  private terminal: TBrowserVTerminal
  private callbacks: TEngineCallbacks
  private prevDoc: TDocument = emptyDoc
  private prevPalette: TPalette | null = null
  private idleCheckTimer: ReturnType<typeof setInterval> | null = null

  private constructor(
    sessionId: string,
    terminal: TBrowserVTerminal,
    callbacks: TEngineCallbacks
  ) {
    this.sessionId = sessionId
    this.terminal = terminal
    this.callbacks = callbacks

    // Periodic idle check — only processes when terminal has pending dirty
    // state that wasn't flushed by rAF (e.g. mode transition after data stops)
    this.idleCheckTimer = setInterval(() => {
      if (this.destroyed || !this.dirty) return
      if (this.prevDoc.mode !== `idle`) {
        const idleMs = Date.now() - this.lastDataTime
        if (idleMs > 2000) this.process()
      }
    }, 1000)
  }

  static create(sessionId: string, callbacks: TEngineCallbacks): SessionEngine {
    const terminal = createBrowserTerminal(80, 24)
    return new SessionEngine(sessionId, terminal, callbacks)
  }

  write(data: string | Uint8Array): void {
    if (this.destroyed) return
    this.terminal.write(data)
    this.lastDataTime = Date.now()
    this.dirty = true

    if (!this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null
        if (this.dirty) this.process()
      })
    }
  }

  resize(cols: number, rows: number): void {
    if (this.destroyed) return
    this.terminal.resize(cols, rows)
    this.dirty = true
    this.process()
  }

  private process(): void {
    if (this.destroyed) return
    this.dirty = false

    try {
      const dirtyRows = this.terminal.getDirtyRows()
      const cursor = this.terminal.getCursor()
      const view = this.terminal.getViewport()

      if (dirtyRows.length > 3) {
        this.consecutiveDirtyCycles++
      } else {
        this.consecutiveDirtyCycles = 0
      }

      const idleDurationMs = Date.now() - this.lastDataTime

      const tokenResult = tokenize(
        view,
        this.terminal.cols,
        this.terminal.rows,
        cursor,
        this.prevPalette ?? undefined,
        dirtyRows.length > 0 ? dirtyRows : undefined
      )
      this.prevPalette = tokenResult.palette

      const modeCtx: TModeContext = {
        isAlternateScreen: this.terminal.isAlternateScreen(),
        cursor,
        dirtyRowCount: dirtyRows.length,
        consecutiveDirtyCycles: this.consecutiveDirtyCycles,
        idleDurationMs,
        // Not yet wired — flatParser detects interactive regions but the signal
        // is not propagated back to the engine. Streaming detection works without it.
        hasInteractiveRegion: false,
      }
      const doc = parse(tokenResult, modeCtx)

      const feedEvents = diffToFeedEvents(this.prevDoc, doc)

      this.prevDoc = doc
      this.consecutiveErrors = 0
      this.terminal.markClean()

      // Callbacks run after engine state is committed so a callback error
      // does not leave the terminal dirty or inflate consecutiveErrors.
      try {
        if (feedEvents.length > 0) this.callbacks.onFeedEvents(feedEvents)
        this.callbacks.onAST(doc)
      } catch (cbErr) {
        console.error(`[SessionEngine] callback failed for ${this.sessionId}:`, cbErr)
      }
    } catch (err) {
      this.consecutiveErrors++
      console.error(
        `[SessionEngine] process() failed for ${this.sessionId} (${this.consecutiveErrors} consecutive):`,
        err
      )
      if (this.consecutiveErrors === 3) {
        try {
          this.callbacks.onFeedEvents([
            {
              kind: `output`,
              id: `engine-err-${this.consecutiveErrors}`,
              status: `complete`,
              lines: [],
              summary: `Engine error: terminal rendering failed (${this.consecutiveErrors} consecutive failures)`,
              collapsed: false,
            },
          ])
        } catch (cbErr) {
          console.error(
            `[SessionEngine] onFeedEvents callback failed for ${this.sessionId}:`,
            cbErr
          )
        }
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.idleCheckTimer) clearInterval(this.idleCheckTimer)
    if (this.rafId) cancelAnimationFrame(this.rafId)
    this.terminal.free()
  }
}
