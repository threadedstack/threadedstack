import React from 'react'
import { Box, Text } from 'ink'
import { Spinner } from './Spinner'
import { ToolActivity } from './ToolActivity'
import { renderMarkdown } from '@TRL/utils/markdown'

type TToolCall = {
  name: string
  args: string
  status: 'running' | 'success' | 'error'
  summary: string
  result?: string
}

type Props = {
  text: string
  toolCalls: TToolCall[]
  isStreaming: boolean
  verbose?: boolean
}

export function StreamingResponse({ text, toolCalls, isStreaming, verbose }: Props) {
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
