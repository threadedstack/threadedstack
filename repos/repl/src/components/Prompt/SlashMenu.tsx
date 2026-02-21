import type { TSlashCommand } from '@TRL/types'

import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'

type TSlashMenu = {
  visible: boolean
  commands: TSlashCommand[]
  selectedIndex: number
}

export const SlashMenu = (props: TSlashMenu) => {
  const { commands, selectedIndex, visible } = props

  if (!visible) return null

  if (commands.length === 0) {
    return (
      <Box paddingLeft={2}>
        <Text>{themed(`muted`, `No matching commands`)}</Text>
      </Box>
    )
  }

  return (
    <Box
      flexDirection="column"
      paddingLeft={2}
    >
      {commands.map((cmd, i) => {
        const isSelected = i === selectedIndex
        const aliases = cmd.aliases.length
          ? themed(`muted`, ` (${cmd.aliases.join(`, `)})`)
          : ``
        const desc = themed(`muted`, ` — ${cmd.description}`)
        const indicator = isSelected ? themed(`primary`, `❯ `) : `  `
        const name = themed(isSelected ? `primary` : `secondary`, `/${cmd.name}`)

        return (
          <Box key={cmd.name}>
            <Text>
              {indicator}
              {name}
              {aliases}
              {desc}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
