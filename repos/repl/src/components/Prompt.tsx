import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { useState, useCallback } from 'react'

type PromptProps = {
  disabled: boolean
  onSubmit: (text: string) => void
}

export function Prompt({ onSubmit, disabled }: PromptProps) {
  const [value, setValue] = useState(``)

  const handleSubmit = useCallback(
    (text: string) => {
      const val = text.trim()
      if (!val) return

      onSubmit(text.trim())
      setValue(``)
    },
    [onSubmit]
  )

  return (
    <Box>
      <Text color={disabled ? `gray` : `cyan`}>{`> `}</Text>
      <TextInput
        value={value}
        onChange={setValue}
        onSubmit={handleSubmit}
        focus={!disabled}
      />
    </Box>
  )
}
