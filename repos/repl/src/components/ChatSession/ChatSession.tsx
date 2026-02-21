import type { TConnectionStatus, TMessage, TToolCall } from '@TRL/types'

import { Box } from 'ink'
import { Prompt } from '@TRL/components/Prompt'
import { StatusBar } from '@TRL/components/StatusBar/StatusBar'
import { MessageList } from '@TRL/components/Message/MessageList'
import { Streaming } from '@TRL/components/Streaming/Streaming'

type TChatSession = {
  agentName: string
  verbose?: boolean
  modelName?: string
  streamText: string
  threadName?: string
  isStreaming: boolean
  messages: TMessage[]
  providerName?: string
  toolCalls: TToolCall[]
  connection: TConnectionStatus
  onSubmit: (text: string) => void
}

export const ChatSession = (props: TChatSession) => {
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
      flexGrow={1}
      flexDirection="column"
    >
      <StatusBar
        agentName={agentName}
        modelName={modelName}
        threadName={threadName}
        connection={connection}
        providerName={providerName}
      />
      <MessageList messages={messages} />
      {isStreaming && (
        <Streaming
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
