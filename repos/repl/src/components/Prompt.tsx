import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { themed } from '@TRL/theme'

type PromptProps = {
  onSubmit: (text: string) => void
  disabled: boolean
}

export function Prompt({ onSubmit, disabled }: PromptProps) {
  const [value, setValue] = useState('')

  useInput((input, key) => {
    if (disabled) return

    if (key.return) {
      if (value.trim()) {
        onSubmit(value.trim())
        setValue('')
      }
      return
    }

    if (key.backspace || key.delete) {
      setValue((prev) => prev.slice(0, -1))
      return
    }

    if (!key.ctrl && !key.meta && input) {
      setValue((prev) => prev + input)
    }
  })

  return (
    <Box>
      <Text>
        {themed(disabled ? 'muted' : 'primary', '> ')}
        {value}
        {!disabled && themed('primary', '█')}
      </Text>
    </Box>
  )
}
