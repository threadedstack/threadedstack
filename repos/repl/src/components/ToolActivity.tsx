import React from 'react'
import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'
import { getToolDisplayName } from '@TRL/constants/tools'

type TToolCall = {
  name: string
  args: string
  status: 'running' | 'success' | 'error'
  summary: string
  result?: string
}

type ToolActivityProps = {
  tools: TToolCall[]
  verbose?: boolean
}

export function ToolActivity({ tools, verbose = false }: ToolActivityProps) {
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
            {tool.status === 'success' && themed('success', '✓')}
            {tool.status === 'error' && themed('error', '✗')}
            {tool.status === 'running' && themed('warning', '⠙')}{' '}
            {tool.summary || getToolDisplayName(tool.name)}
          </Text>
          {verbose && tool.result && (
            <Box marginLeft={2}>
              <Text>{themed('muted', tool.result.slice(0, 500))}</Text>
            </Box>
          )}
        </Box>
      ))}
      <Text>{themed('border', '──')}</Text>
    </Box>
  )
}
