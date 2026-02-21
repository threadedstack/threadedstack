import { Box, Text } from 'ink'
import pc from 'picocolors'

type TEditor = {
  lines: string[]
  cursorRow: number
  cursorCol: number
  disabled: boolean
}

export const Editor = (props: TEditor) => {
  const { lines, cursorRow, cursorCol, disabled } = props

  if (disabled) {
    const content = lines.join(`\n`) || ` `
    return (
      <Box flexDirection="column">
        <Text color="gray">{content}</Text>
      </Box>
    )
  }

  // Empty state: just show the cursor placeholder
  if (lines.length === 1 && lines[0] === ``) {
    return (
      <Box flexDirection="column">
        <Text>{pc.inverse(` `)}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {lines.map((line, rowIdx) => {
        const key = `line-${rowIdx}`

        if (rowIdx !== cursorRow) {
          return <Text key={key}>{line || ` `}</Text>
        }

        // Render this line with the cursor
        const before = line.slice(0, cursorCol)
        const cursorChar = cursorCol < line.length ? line[cursorCol] : ` `
        const after = cursorCol < line.length ? line.slice(cursorCol + 1) : ``

        return (
          <Text key={key}>
            {before}
            {pc.inverse(cursorChar)}
            {after}
          </Text>
        )
      })}
    </Box>
  )
}
