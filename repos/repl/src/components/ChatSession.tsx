import React from 'react'
import { Box } from 'ink'
import { StatusBar } from './StatusBar'
import { MessageList } from './MessageList'
import { StreamingResponse } from './StreamingResponse'
import { Prompt } from './Prompt'
import type { TConnectionStatus } from '@TRL/types'

type TToolCall = {
  name: string
  args: string
  status: 'running' | 'success' | 'error'
  summary: string
  result?: string
}

type Props = {
  agentName: string
  providerName?: string
  modelName?: string
  threadName?: string
  connection: TConnectionStatus
  messages: Array<{ type: string; content: string }>
  isStreaming: boolean
  streamText: string
  toolCalls: TToolCall[]
  verbose?: boolean
  onSubmit: (text: string) => void
}

export function ChatSession({
  agentName,
  providerName,
  modelName,
  threadName,
  connection,
  messages,
  isStreaming,
  streamText,
  toolCalls,
  verbose,
  onSubmit,
}: Props) {
  return (
    <Box
      flexDirection="column"
      flexGrow={1}
    >
      <StatusBar
        agentName={agentName}
        providerName={providerName}
        modelName={modelName}
        threadName={threadName}
        connection={connection}
      />
      <MessageList messages={messages} />
      {isStreaming && (
        <StreamingResponse
          text={streamText}
          toolCalls={toolCalls}
          isStreaming={isStreaming}
          verbose={verbose}
        />
      )}
      <Prompt
        onSubmit={onSubmit}
        disabled={isStreaming}
      />
    </Box>
  )
}
