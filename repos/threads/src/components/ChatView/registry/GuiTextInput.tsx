import { useState } from 'react'
import { Box, TextField, IconButton } from '@mui/material'
import { Send as SendIcon } from '@mui/icons-material'
import type { TInteraction } from '@tdsk/domain'

type TGuiTextInputProps = {
  placeholder?: string
  label?: string
  onAction?: (interaction: TInteraction) => void
}

export function GuiTextInput({ placeholder, label, onAction }: TGuiTextInputProps) {
  const [value, setValue] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = () => {
    if (!value.trim() || submitted) return
    setSubmitted(true)
    onAction?.({ type: 'TextInput', text: value.trim() })
  }

  return (
    <Box sx={{ my: 1 }}>
      {label && (
        <Box sx={{ mb: 0.5, fontSize: 13, color: 'text.secondary' }}>{label}</Box>
      )}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          size='small'
          fullWidth
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder={placeholder}
          disabled={submitted}
        />
        <IconButton
          onClick={handleSubmit}
          disabled={!value.trim() || submitted}
          size='small'
        >
          <SendIcon fontSize='small' />
        </IconButton>
      </Box>
    </Box>
  )
}
