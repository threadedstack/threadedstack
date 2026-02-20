import type { TConnectionStatus } from '@TRL/types'

import { Box } from 'ink'
import { Prompt } from './Prompt'
import { StatusBar } from './StatusBar'
import { MessageList } from './MessageList'
import { StreamingResponse } from './StreamingResponse'

type TToolCall = {
  name: string
  args: string
  summary: string
  result?: string
  status: `running` | `success` | `error`
}

type Props = {
  agentName: string
  verbose?: boolean
  modelName?: string
  streamText: string
  threadName?: string
  isStreaming: boolean
  providerName?: string
  toolCalls: TToolCall[]
  connection: TConnectionStatus
  onSubmit: (text: string) => void
  messages: Array<{ type: string; content: string }>
}

export function ChatSession(props: Props) {
  const {
    verbose,
    onSubmit,
    messages,
    toolCalls,
    agentName,
    modelName,
    threadName,
    connection,
    streamText,
    isStreaming,
    providerName,
  } = props

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
