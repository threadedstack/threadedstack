import { useRef, useEffect, useCallback } from 'react'
import { Terminal, FitAddon } from 'ghostty-web'
import { Box } from '@mui/material'
import {
  sendInput,
  sendControl,
  getRawBuffer,
  subscribeTerminalData,
} from '@TTH/actions/sessions'

export type TTerminalView = {
  sessionId: string
  active: boolean
}

export const TerminalView = (props: TTerminalView) => {
  const { sessionId, active } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)

  const handleData = useCallback(
    (data: string) => sendInput(sessionId, data),
    [sessionId]
  )

  const handleResize = useCallback(
    (dims: { cols: number; rows: number }) =>
      sendControl(sessionId, { type: `resize`, cols: dims.cols, rows: dims.rows }),
    [sessionId]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: `bar`,
      fontSize: 14,
      fontFamily: `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace`,
      scrollback: 10000,
      theme: {
        background: `#1e1e2e`,
        foreground: `#cdd6f4`,
        cursor: `#f5e0dc`,
        selectionBackground: `#45475a`,
        black: `#45475a`,
        red: `#f38ba8`,
        green: `#a6e3a1`,
        yellow: `#f9e2af`,
        blue: `#89b4fa`,
        magenta: `#f5c2e7`,
        cyan: `#94e2d5`,
        white: `#bac2de`,
        brightBlack: `#585b70`,
        brightRed: `#f38ba8`,
        brightGreen: `#a6e3a1`,
        brightYellow: `#f9e2af`,
        brightBlue: `#89b4fa`,
        brightMagenta: `#f5c2e7`,
        brightCyan: `#94e2d5`,
        brightWhite: `#a6adc8`,
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)
    fitAddon.fit()
    fitAddon.observeResize()

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Replay raw buffer from prior session data
    const buffer = getRawBuffer(sessionId)
    for (const chunk of buffer) {
      term.write(chunk)
    }

    // Wire terminal input to WebSocket
    const dataDisposable = term.onData(handleData)
    const resizeDisposable = term.onResize(handleResize)

    // Subscribe to decoded terminal data from the session action
    const unsubscribe = subscribeTerminalData(sessionId, (data: string) => {
      term.write(data)
    })

    return () => {
      dataDisposable.dispose()
      resizeDisposable.dispose()
      unsubscribe()
      fitAddon.dispose()
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
  }, [sessionId, handleData, handleResize])

  // Re-fit when visibility changes
  useEffect(() => {
    if (active && fitAddonRef.current) {
      fitAddonRef.current.fit()
    }
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
