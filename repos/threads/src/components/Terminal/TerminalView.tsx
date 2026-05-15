import { Box } from '@mui/material'
import { Terminal, FitAddon } from 'ghostty-web'
import { useTerminalSettings } from '@TTH/state/selectors'
import { useRef, useEffect, useCallback, useMemo } from 'react'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'
import {
  sendInput,
  sendControl,
  getRawBuffer,
  subscribeTerminalData,
} from '@TTH/actions/sessions'

const sessionDims = new Map<string, { cols: number; rows: number }>()

export type TTerminalView = {
  active: boolean
  sessionId: string
}

export const TerminalView = (props: TTerminalView) => {
  const { sessionId, active } = props
  const [settings] = useTerminalSettings()
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Theme changes require terminal recreation because ghostty-web bakes palette
  // colors into cell RGB values at write time via the WASM layer. Changing the
  // renderer theme only affects line backgrounds, selection, and cursor — not
  // existing cell text/bg colors. A stable key that changes on theme change
  // triggers the construction effect to destroy and recreate the terminal.
  const themeKey = useMemo(() => JSON.stringify(settings.theme), [settings.theme])

  const onData = useCallback((data: string) => sendInput(sessionId, data), [sessionId])

  const onResize = useCallback(
    (dims: { cols: number; rows: number }) => {
      sessionDims.set(sessionId, { cols: dims.cols, rows: dims.rows })
      sendControl(sessionId, { type: `resize`, cols: dims.cols, rows: dims.rows })
    },
    [sessionId]
  )

  // Create terminal — rebuilds on session change or theme change
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.replaceChildren()

    let term: Terminal
    let fitAddon: FitAddon
    try {
      // Start the terminal at the PTY's dimensions so buffer replay matches
      // the data's column/row formatting (preventing garbled overlapping text).
      const replayDims = sessionDims.get(sessionId) ?? estimateTerminalDimensions()

      term = new Terminal({
        cols: replayDims.cols,
        rows: replayDims.rows,
        theme: settings.theme,
        fontSize: settings.fontSize,
        fontFamily: settings.fontFamily,
        scrollback: settings.scrollback,
        cursorBlink: settings.cursorBlink,
        cursorStyle: settings.cursorStyle,
        allowTransparency: settings.allowTransparency,
        smoothScrollDuration: settings.smoothScrollDuration,
      })

      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)

      // Disable the built-in RAF render loop before open() starts it.
      // ghostty-web's loop does partial redraws that miss rows after buffer
      // replay on tab switch, causing faded colors. We drive rendering
      // on demand instead (floeterm approach).
      const termAny = term as any
      termAny.startRenderLoop = () => {}

      term.open(container)

      if (termAny.animationFrameId != null) {
        cancelAnimationFrame(termAny.animationFrameId)
        termAny.animationFrameId = undefined
      }

      fitAddon.observeResize()
    } catch (err) {
      console.error(
        `[TerminalView] Failed to create terminal for session ${sessionId}`,
        err
      )
      return
    }

    let alive = true
    let pendingRaf: number | undefined
    let unsubscribe: (() => void) | undefined

    termRef.current = term
    fitAddonRef.current = fitAddon

    const render = (full: boolean) => {
      const t = term as any
      if (t.renderer && t.wasmTerm && !t.isDisposed) {
        t.renderer.render(
          t.wasmTerm,
          full,
          t.viewportY ?? 0,
          term,
          t.scrollbarOpacity ?? 0
        )
      }
    }

    const scheduleRender = () => {
      if (pendingRaf != null) return
      pendingRaf = requestAnimationFrame(() => {
        pendingRaf = undefined
        if (alive) render(false)
      })
    }

    const dataDisposable = term.onData(onData)
    const resizeDisposable = term.onResize(onResize)
    const scrollDisposable = term.onScroll(scheduleRender)
    const selectionDisposable = term.onSelectionChange(scheduleRender)

    // Replay buffer FIRST at the PTY's dimensions (set via constructor),
    // THEN fit to the container. This order is critical: the buffer data
    // contains escape sequences with absolute cursor positions formatted
    // for the PTY's dimensions. Fitting first would resize the local
    // terminal to container dimensions which differ from the PTY's,
    // causing garbled overlapping text during replay.
    // After replay, fit() resizes the terminal to the container and sends
    // a resize control to the backend, which triggers a SIGWINCH that
    // makes TUI apps redraw at the new dimensions with fresh data.
    const rafId = requestAnimationFrame(() => {
      if (!alive) return

      const buffer = getRawBuffer(sessionId).slice()
      for (const chunk of buffer) {
        term.write(chunk)
      }
      render(true)

      fitAddon.fit()

      unsubscribe = subscribeTerminalData(sessionId, (data: string) => {
        if (!alive) return
        term.write(data)
        scheduleRender()
      })

      // Buffer replay can produce stale colors because escape-sequence
      // context from before the buffer window is lost. Force a SIGWINCH by
      // toggling the PTY row count — the remote process repaints with fresh
      // escape sequences. Only the BACKEND dimensions change (via sendControl);
      // the local terminal stays at the fitted size so response data always
      // matches, preventing garbled text from dimension mismatch.
      const fitCols = (term as any).cols as number
      const fitRows = (term as any).rows as number
      sendControl(sessionId, { type: `resize`, cols: fitCols, rows: fitRows + 1 })
      sendControl(sessionId, { type: `resize`, cols: fitCols, rows: fitRows })
    })

    return () => {
      alive = false
      cancelAnimationFrame(rafId)
      if (pendingRaf != null) cancelAnimationFrame(pendingRaf)
      dataDisposable.dispose()
      resizeDisposable.dispose()
      scrollDisposable.dispose()
      selectionDisposable.dispose()
      unsubscribe?.()
      fitAddon.dispose()
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
  }, [sessionId, themeKey, onData, onResize])

  // Apply non-theme runtime setting changes without recreating the terminal
  useEffect(() => {
    const term = termRef.current
    if (!term) return

    try {
      term.options.fontSize = settings.fontSize
      term.options.fontFamily = settings.fontFamily
      term.options.cursorStyle = settings.cursorStyle
      term.options.cursorBlink = settings.cursorBlink
      term.options.allowTransparency = settings.allowTransparency
      term.options.smoothScrollDuration = settings.smoothScrollDuration
    } catch (err) {
      console.error(`[TerminalView] Failed to apply terminal settings`, err)
    }

    fitAddonRef.current?.fit()
  }, [
    settings.fontSize,
    settings.fontFamily,
    settings.cursorStyle,
    settings.cursorBlink,
    settings.allowTransparency,
    settings.smoothScrollDuration,
  ])

  useEffect(() => {
    if (!active) return
    const fitAddon = fitAddonRef.current
    if (!fitAddon) return
    fitAddon.fit()
  }, [active])

  return (
    <Box
      ref={containerRef}
      sx={{
        width: `100%`,
        height: `100%`,
        display: active ? `block` : `none`,
        '& canvas': {
          outline: `none`,
        },
      }}
    />
  )
}
