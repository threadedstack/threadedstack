import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { themed } from '@TRL/theme'

type TSelectItem = {
  id: string
  label: string
  description?: string
}

type SelectPromptProps = {
  items: TSelectItem[]
  prompt: string
  onSelect: (item: TSelectItem) => void
}

export function SelectPrompt({ items, prompt, onSelect }: SelectPromptProps) {
  const [selected, setSelected] = useState(0)

  useInput((input, key) => {
    if (key.upArrow) {
      setSelected((prev) => Math.max(0, prev - 1))
    } else if (key.downArrow) {
      setSelected((prev) => Math.min(items.length - 1, prev + 1))
    } else if (key.return) {
      onSelect(items[selected])
    } else {
      const num = Number.parseInt(input, 10)
      if (num >= 1 && num <= items.length) {
        onSelect(items[num - 1])
      }
    }
  })

  return (
    <Box flexDirection="column">
      <Text>{themed('bold', prompt)}</Text>
      <Text> </Text>
      {items.map((item, i) => (
        <Box key={item.id}>
          <Text>
            {i === selected ? themed('primary', '❯') : ' '}{' '}
            {themed(i === selected ? 'primary' : 'secondary', `${i + 1}.`)} {item.label}
            {item.description ? themed('muted', ` — ${item.description}`) : ''}
          </Text>
        </Box>
      ))}
    </Box>
  )
}
