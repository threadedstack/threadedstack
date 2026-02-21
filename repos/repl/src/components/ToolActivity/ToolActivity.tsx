import type { TToolCall } from '@TRL/types'

import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'
import { EToolStatus } from '@TRL/types'
import { getToolName } from '@TRL/utils/tools/getToolName'

type TToolActivity = {
  tools: TToolCall[]
  verbose?: boolean
}

export const ToolActivity = (props: TToolActivity) => {
  const { tools, verbose = false } = props
  if (tools.length === 0) return null

  return (
    <Box
      flexDirection="column"
      marginY={1}
    >
      <Text>{themed('border', '── Agent is working ──')}</Text>
      {tools.map((tool, i) => (
        <Box
          key={i}
          flexDirection="column"
        >
          <Text>
            {tool.status === EToolStatus.success && themed(`success`, `✓`)}
            {tool.status === EToolStatus.error && themed(`error`, `✗`)}
            {tool.status === EToolStatus.running && themed(`warning`, `⠙`)}
            {` `}
            {tool.summary || getToolName(tool.name)}
          </Text>
          {verbose && tool.result && (
            <Box marginLeft={2}>
              <Text>{themed(`muted`, tool.result.slice(0, 500))}</Text>
            </Box>
          )}
        </Box>
      ))}
      <Text>{themed(`border`, `──`)}</Text>
    </Box>
  )
}
