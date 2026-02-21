import { Box, Text } from 'ink'
import { themed } from '@TRL/theme'

type TWelcomeBox = {
  tools?: string[]
  agentName: string
  modelName?: string
  threadName?: string
  providerName?: string
  agentDescription?: string
  contextFileCount?: number
}

export const WelcomeBox = (props: TWelcomeBox) => {
  const {
    tools,
    modelName,
    agentName,
    threadName,
    providerName,
    agentDescription,
    contextFileCount,
  } = props

  return (
    <Box
      paddingY={1}
      paddingX={2}
      borderColor="cyan"
      borderStyle="round"
      flexDirection="column"
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
