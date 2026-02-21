import type { TToolCall } from '@TRL/types'

import { Box, Text } from 'ink'
import { renderMarkdown } from '@TRL/utils/markdown'
import { Spinner } from '@TRL/components/Spinner/Spinner'
import { ToolActivity } from '@TRL/components/ToolActivity/ToolActivity'

type TStreaming = {
  text: string
  verbose?: boolean
  isStreaming: boolean
  toolCalls: TToolCall[]
}

export const Streaming = (props: TStreaming) => {
  const { text, toolCalls, isStreaming, verbose } = props
  const showSpinner = isStreaming && !text && toolCalls.length === 0

  return (
    <Box flexDirection="column">
      {showSpinner && <Spinner message="Thinking..." />}
      {toolCalls.length > 0 && (
        <ToolActivity
          tools={toolCalls}
          verbose={verbose}
        />
      )}
      {text && <Text>{renderMarkdown(text)}</Text>}
    </Box>
  )
}
