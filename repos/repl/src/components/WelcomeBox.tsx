import React from 'react'
import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'

type WelcomeBoxProps = {
  agentName: string
  agentDescription?: string
  providerName?: string
  modelName?: string
  threadName?: string
  contextFileCount?: number
  tools?: string[]
}

export function WelcomeBox({
  agentName,
  agentDescription,
  providerName,
  modelName,
  threadName,
  contextFileCount,
  tools,
}: WelcomeBoxProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={2}
      paddingY={1}
    >
      <Text>{themed('bold', agentName)}</Text>
      {agentDescription && <Text>{themed('muted', agentDescription)}</Text>}
      <Text> </Text>
      {tools && tools.length > 0 && (
        <Text>{themed('muted', `Tools: ${tools.join(', ')}`)}</Text>
      )}
      {providerName && (
        <Text>
          {themed(
            'muted',
            `Provider: ${providerName}${modelName ? ` (${modelName})` : ''}`
          )}
        </Text>
      )}
      {threadName && <Text>{themed('accent', `Resuming thread: "${threadName}"`)}</Text>}
      {(contextFileCount ?? 0) > 0 && (
        <Text>
          {themed(
            'muted',
            `Loaded ${contextFileCount} context file${contextFileCount === 1 ? '' : 's'}`
          )}
        </Text>
      )}
      <Text> </Text>
      <Text>{themed('muted', 'Type /help for commands, /new to start fresh.')}</Text>
    </Box>
  )
}
