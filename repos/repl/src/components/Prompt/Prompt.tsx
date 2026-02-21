import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'
import { useState, useCallback } from 'react'

type TPrompt = {
  disabled: boolean
  onSubmit: (text: string) => void
}

export const Prompt = (props: TPrompt) => {
  const { onSubmit: onSubmitCB, disabled } = props

  const [value, setValue] = useState(``)

  const onSubmit = useCallback(
    (text: string) => {
      const val = text.trim()
      if (!val) return

      onSubmitCB?.(text.trim())
      setValue(``)
    },
    [onSubmitCB]
  )

  return (
    <Box>
      <Text color={disabled ? `gray` : `cyan`}>{`> `}</Text>
      <TextInput
        value={value}
        focus={!disabled}
        onChange={setValue}
        onSubmit={onSubmit}
      />
    </Box>
  )
}
