import type { TSelectItem } from '@TRL/types'

import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'

type TSubMenu = {
  visible: boolean
  prompt: string
  items: TSelectItem[]
  selectedIndex: number
}

export const SubMenu = (props: TSubMenu) => {
  const { visible, prompt, items, selectedIndex } = props

  if (!visible) return null

  if (items.length === 0) {
    return (
      <Box paddingLeft={2}>
        <Text>{themed(`muted`, `No items`)}</Text>
      </Box>
    )
  }

  return (
    <Box
      flexDirection="column"
      paddingLeft={2}
    >
      <Text>{themed(`bold`, prompt)}</Text>
      <Text> </Text>
      {items.map((item, i) => {
        const isSelected = i === selectedIndex
        const indicator = isSelected ? themed(`primary`, `❯ `) : `  `
        const number = themed(isSelected ? `primary` : `secondary`, `${i + 1}.`)
        const label = themed(isSelected ? `primary` : `secondary`, ` ${item.label}`)
        const desc = item.description ? themed(`muted`, ` — ${item.description}`) : ``

        return (
          <Box key={item.id}>
            <Text>
              {indicator}
              {number}
              {label}
              {desc}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
