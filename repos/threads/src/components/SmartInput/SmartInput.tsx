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
  sandboxId: string
}

const IdleInput = (props: { sandboxId: string }) => {
  const { sandboxId } = props
  const [text, setText] = useState(``)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    sendInput(sandboxId, trimmed + `\n`)
    setText(``)
  }, [sandboxId, text])

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

const PromptInput = (props: { sandboxId: string }) => {
  const { sandboxId } = props
  const [text, setText] = useState(``)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed) return
    sendInput(sandboxId, trimmed + `\n`)
    setText(``)
  }, [sandboxId, text])

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

const WorkingIndicator = (props: { sandboxId: string }) => {
  const { sandboxId } = props

  const handleStop = useCallback(() => {
    sendControl(sandboxId, { type: `signal`, signal: `SIGINT` })
  }, [sandboxId])

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

const PermissionButtons = (props: { sandboxId: string }) => {
  const { sandboxId } = props

  const handleApprove = useCallback(() => approvePermission(sandboxId), [sandboxId])
  const handleDeny = useCallback(() => denyPermission(sandboxId), [sandboxId])

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

const InteractiveInput = (props: { sandboxId: string }) => {
  const { sandboxId } = props

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      e.preventDefault()
      const key = e.key
      if (key.length === 1) {
        sendInput(sandboxId, key)
      } else if (key === `Enter`) {
        sendInput(sandboxId, `\n`)
      } else if (key === `Backspace`) {
        sendInput(sandboxId, `\x7f`)
      } else if (key === `Tab`) {
        sendInput(sandboxId, `\t`)
      } else if (key === `Escape`) {
        sendInput(sandboxId, `\x1b`)
      } else if (key === `ArrowUp`) {
        sendInput(sandboxId, `\x1b[A`)
      } else if (key === `ArrowDown`) {
        sendInput(sandboxId, `\x1b[B`)
      } else if (key === `ArrowRight`) {
        sendInput(sandboxId, `\x1b[C`)
      } else if (key === `ArrowLeft`) {
        sendInput(sandboxId, `\x1b[D`)
      }
    },
    [sandboxId]
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
  const { sandboxId } = props
  const toolState = useToolState(sandboxId)

  return (
    <Box sx={{ p: 1.5, borderTop: 1, borderColor: `divider` }}>
      {toolState === `idle` && <IdleInput sandboxId={sandboxId} />}
      {toolState === `prompt` && <PromptInput sandboxId={sandboxId} />}
      {toolState === `working` && <WorkingIndicator sandboxId={sandboxId} />}
      {toolState === `permission` && <PermissionButtons sandboxId={sandboxId} />}
      {toolState === `interactive` && <InteractiveInput sandboxId={sandboxId} />}
    </Box>
  )
}
