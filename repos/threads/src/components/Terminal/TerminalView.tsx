import { Box } from '@mui/material'
import { Terminal, FitAddon } from 'ghostty-web'
import { useTerminalSettings } from '@TTH/state/selectors'
import { useRef, useEffect, useCallback, useMemo } from 'react'
import {
  sendInput,
  sendControl,
  getRawBuffer,
  subscribeTerminalData,
} from '@TTH/actions/sessions'

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

  const handleData = useCallback(
    (data: string) => sendInput(sessionId, data),
    [sessionId]
  )

  const handleResize = useCallback(
    (dims: { cols: number; rows: number }) =>
      sendControl(sessionId, { type: `resize`, cols: dims.cols, rows: dims.rows }),
    [sessionId]
  )

  // Create terminal — rebuilds on session change or theme change
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let term: Terminal
    let fitAddon: FitAddon
    try {
      term = new Terminal({
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
      term.open(container)
      fitAddon.fit()
      fitAddon.observeResize()
    } catch (err) {
      console.error(
        `[TerminalView] Failed to create terminal for session ${sessionId}`,
        err
      )
      return
    }

    termRef.current = term
    fitAddonRef.current = fitAddon

    const buffer = getRawBuffer(sessionId)
    for (const chunk of buffer) {
      term.write(chunk)
    }

    const dataDisposable = term.onData(handleData)
    const resizeDisposable = term.onResize(handleResize)

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
  }, [sessionId, themeKey, handleData, handleResize])

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
