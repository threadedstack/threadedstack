import { useState, useRef, useEffect, useCallback } from 'react'
import { Box, TextField, Button, IconButton } from '@mui/material'
import Send from '@mui/icons-material/Send'
import Stop from '@mui/icons-material/Stop'
import PlayArrow from '@mui/icons-material/PlayArrow'
import Check from '@mui/icons-material/Check'
import Close from '@mui/icons-material/Close'
import { useToolState } from '@TTH/state/selectors'
import {
  sendInput,
  sendControl,
  approvePermission,
  denyPermission,
} from '@TTH/actions/sessions'

export type TSmartInput = {
  sessionId: string
}

const IdleInput = (props: { sessionId: string }) => {
  const { sessionId } = props
  const [text, setText] = useState(``)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    sendInput(sessionId, trimmed + `\n`)
    setText(``)
  }, [sessionId, text])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === `Enter` && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <Box sx={{ display: `flex`, gap: 1, alignItems: `center` }}>
      <TextField
        inputRef={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder='Type a message...'
        size='small'
        fullWidth
        autoFocus
        slotProps={{
          input: {
            sx: { fontFamily: `inherit` },
          },
        }}
      />
      <Button
        variant='contained'
        size='small'
        startIcon={<PlayArrow />}
        onClick={handleSubmit}
        disabled={!text.trim()}
      >
        Start
      </Button>
    </Box>
  )
}

const PromptInput = (props: { sessionId: string }) => {
  const { sessionId } = props
  const [text, setText] = useState(``)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    sendInput(sessionId, trimmed + `\n`)
    setText(``)
  }, [sessionId, text])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === `Enter` && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <Box sx={{ display: `flex`, gap: 1, alignItems: `center` }}>
      <TextField
        inputRef={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder='Type a message...'
        size='small'
        fullWidth
        slotProps={{
          input: {
            sx: { fontFamily: `inherit` },
          },
        }}
      />
      <IconButton
        color='primary'
        onClick={handleSubmit}
        disabled={!text.trim()}
        size='small'
      >
        <Send />
      </IconButton>
    </Box>
  )
}

const WorkingIndicator = (props: { sessionId: string }) => {
  const { sessionId } = props

  const handleStop = useCallback(() => {
    sendControl(sessionId, { type: `signal`, signal: `SIGINT` })
  }, [sessionId])

  return (
    <Box sx={{ display: `flex`, gap: 1, alignItems: `center` }}>
      <TextField
        value='Working...'
        size='small'
        fullWidth
        disabled
        slotProps={{
          input: {
            sx: { fontFamily: `inherit`, fontStyle: `italic` },
          },
        }}
      />
      <IconButton
        color='error'
        onClick={handleStop}
        size='small'
        title='Stop (SIGINT)'
      >
        <Stop />
      </IconButton>
    </Box>
  )
}

const PermissionButtons = (props: { sessionId: string }) => {
  const { sessionId } = props

  const handleApprove = useCallback(() => approvePermission(sessionId), [sessionId])
  const handleDeny = useCallback(() => denyPermission(sessionId), [sessionId])

  return (
    <Box sx={{ display: `flex`, gap: 1, justifyContent: `center` }}>
      <Button
        variant='contained'
        color='success'
        startIcon={<Check />}
        onClick={handleApprove}
        size='small'
      >
        Approve
      </Button>
      <Button
        variant='outlined'
        color='error'
        startIcon={<Close />}
        onClick={handleDeny}
        size='small'
      >
        Deny
      </Button>
    </Box>
  )
}

const InteractiveInput = (props: { sessionId: string }) => {
  const { sessionId } = props

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      e.preventDefault()
      const key = e.key
      if (key.length === 1) {
        sendInput(sessionId, key)
      } else if (key === `Enter`) {
        sendInput(sessionId, `\n`)
      } else if (key === `Backspace`) {
        sendInput(sessionId, `\x7f`)
      } else if (key === `Tab`) {
        sendInput(sessionId, `\t`)
      } else if (key === `Escape`) {
        sendInput(sessionId, `\x1b`)
      } else if (key === `ArrowUp`) {
        sendInput(sessionId, `\x1b[A`)
      } else if (key === `ArrowDown`) {
        sendInput(sessionId, `\x1b[B`)
      } else if (key === `ArrowRight`) {
        sendInput(sessionId, `\x1b[C`)
      } else if (key === `ArrowLeft`) {
        sendInput(sessionId, `\x1b[D`)
      }
    },
    [sessionId]
  )

  return (
    <Box sx={{ display: `flex`, gap: 1, alignItems: `center` }}>
      <TextField
        size='small'
        fullWidth
        autoFocus
        placeholder='Interactive mode -- keystrokes sent directly'
        onKeyDown={handleKeyDown}
        slotProps={{
          input: {
            sx: { fontFamily: `monospace` },
          },
        }}
      />
    </Box>
  )
}

export const SmartInput = (props: TSmartInput) => {
  const { sessionId } = props
  const toolState = useToolState(sessionId)

  return (
    <Box sx={{ p: 1.5, borderTop: 1, borderColor: `divider` }}>
      {toolState === `idle` && <IdleInput sessionId={sessionId} />}
      {toolState === `prompt` && <PromptInput sessionId={sessionId} />}
      {toolState === `working` && <WorkingIndicator sessionId={sessionId} />}
      {toolState === `permission` && <PermissionButtons sessionId={sessionId} />}
      {toolState === `interactive` && <InteractiveInput sessionId={sessionId} />}
    </Box>
  )
}
