import type { KeyboardEvent } from 'react'
import { useState } from 'react'
import { Box, TextField, IconButton } from '@mui/material'
import { Send } from '@mui/icons-material'
import { sendInput } from '@TTH/actions/sessions/sendInput'

export type TSmartInput = { sessionId: string }

export const SmartInput = ({ sessionId }: TSmartInput) => {
  const [value, setValue] = useState(``)

  const handleSubmit = () => {
    if (!value.trim()) return
    sendInput(sessionId, value + `\n`)
    setValue(``)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === `Enter` && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <Box
      sx={{ display: `flex`, gap: 1, px: 2, py: 1, borderTop: 1, borderColor: `divider` }}
    >
      <TextField
        fullWidth
        size='small'
        placeholder='Type a command...'
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        sx={{ '& input': { fontFamily: `monospace` } }}
      />
      <IconButton
        onClick={handleSubmit}
        color='primary'
      >
        <Send />
      </IconButton>
    </Box>
  )
}
