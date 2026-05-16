import '@xterm/xterm/css/xterm.css'
import { Box } from '@mui/material'
import { Terminal } from '@xterm/xterm'
import { EShellMsg } from '@tdsk/domain'
import { FitAddon } from '@xterm/addon-fit'
import { useRef, useEffect, useCallback } from 'react'
import { useTerminalSettings } from '@TTH/state/selectors'
import {
  sendInput,
  sendControl,
  getTerminal,
  setTerminal,
  getRawBuffer,
  deleteTerminal,
  subscribeTerminalData,
} from '@TTH/actions/sessions'

export type TTerminalView = {
  active: boolean
  sessionId: string
}

function tryFit(fitAddon: FitAddon) {
  try {
    fitAddon.fit()
  } catch {
    /* terminal disposed or container detached */
  }
}

export const TerminalView = (props: TTerminalView) => {
  const { sessionId, active } = props
  const [settings] = useTerminalSettings()
  const containerRef = useRef<HTMLDivElement>(null)

  const onData = useCallback((data: string) => sendInput(sessionId, data), [sessionId])

  const onResize = useCallback(
    (dims: { cols: number; rows: number }) => {
      sendControl(sessionId, { type: EShellMsg.Resize, cols: dims.cols, rows: dims.rows })
    },
    [sessionId]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let entry = getTerminal(sessionId)

    if (!entry) {
      try {
        const term = new Terminal({
          theme: settings.theme,
          fontSize: settings.fontSize,
          fontFamily: settings.fontFamily,
          scrollback: settings.scrollback,
          cursorBlink: settings.cursorBlink,
          cursorStyle: settings.cursorStyle,
          allowTransparency: settings.allowTransparency,
          smoothScrollDuration: settings.smoothScrollDuration,
        })

        const fitAddon = new FitAddon()
        term.loadAddon(fitAddon)
        term.open(container)

        const buffer = getRawBuffer(sessionId).slice()
        for (const chunk of buffer) {
          term.write(chunk)
        }

        entry = { term, fitAddon }
        setTerminal(sessionId, entry)
      } catch (err) {
        console.error(
          `[TerminalView] Failed to create terminal for session ${sessionId}`,
          err
        )
        return
      }
    } else {
      if (!entry.term.element) {
        console.warn(
          `[TerminalView] Terminal for session ${sessionId} lost its DOM element`
        )
        deleteTerminal(sessionId)
        return
      }
      container.replaceChildren()
      container.appendChild(entry.term.element)
      entry.term.focus()
    }

    const { term, fitAddon } = entry

    const dataDisposable = term.onData(onData)
    const resizeDisposable = term.onResize(onResize)

    const unsubscribe = subscribeTerminalData(sessionId, (data: string) => {
      term.write(data)
    })

    const resizeObserver = new ResizeObserver(() => {
      tryFit(fitAddon)
    })
    resizeObserver.observe(container)

    tryFit(fitAddon)

    return () => {
      dataDisposable.dispose()
      resizeDisposable.dispose()
      unsubscribe()
      resizeObserver.disconnect()
    }
  }, [sessionId, onData, onResize])

  useEffect(() => {
    const entry = getTerminal(sessionId)
    if (!entry) return

    const { term } = entry

    try {
      term.options.fontSize = settings.fontSize
      term.options.scrollback = settings.scrollback
      term.options.fontFamily = settings.fontFamily
      term.options.cursorStyle = settings.cursorStyle
      term.options.cursorBlink = settings.cursorBlink
      term.options.allowTransparency = settings.allowTransparency
      term.options.smoothScrollDuration = settings.smoothScrollDuration
      term.options.theme = { ...settings.theme }
    } catch (err) {
      console.error(`[TerminalView] Failed to apply terminal settings`, err)
    }

    tryFit(entry.fitAddon)
  }, [
    sessionId,
    settings.theme,
    settings.fontSize,
    settings.fontFamily,
    settings.cursorStyle,
    settings.cursorBlink,
    settings.scrollback,
    settings.allowTransparency,
    settings.smoothScrollDuration,
  ])

  useEffect(() => {
    if (!active) return
    const entry = getTerminal(sessionId)
    if (!entry) return
    tryFit(entry.fitAddon)
  }, [active, sessionId])

  return (
    <Box
      ref={containerRef}
      sx={{
        width: `100%`,
        height: `100%`,
        display: active ? `block` : `none`,
        '& .xterm': {
          height: `100%`,
        },
      }}
    />
  )
}
