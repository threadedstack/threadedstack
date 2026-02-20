import React from 'react'
import { Box, Text } from 'ink'
import { UserMessage } from './UserMessage'
import { AssistantMessage } from './AssistantMessage'

type TDisplayMessage = {
  type: string
  content: string
  toolCalls?: any[]
}

type Props = {
  messages: TDisplayMessage[]
  markdown?: boolean
}

export function MessageList({ messages, markdown = true }: Props) {
  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => (
        <Box
          key={i}
          marginBottom={1}
        >
          {msg.type === 'user' ? (
            <UserMessage text={msg.content} />
          ) : msg.type === 'system' ? (
            <Text color="gray">{msg.content}</Text>
          ) : (
            <AssistantMessage
              text={msg.content}
              markdown={markdown}
            />
          )}
        </Box>
      ))}
    </Box>
  )
}
