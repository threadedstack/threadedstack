import type { TMessage } from '@TRL/types'

import { Box, Text } from 'ink'
import { EMessageType } from '@TRL/types'
import { AssistantMessage } from './Assistant'
import { UserMessage } from '@TRL/components/Message/User'

type TMessageList = {
  markdown?: boolean
  messages: TMessage[]
}

export const MessageList = (props: TMessageList) => {
  const { messages, markdown = true } = props

  return (
    <Box flexDirection="column">
      {messages.map((msg) => (
        <Box
          key={msg.id}
          marginBottom={1}
        >
          {msg.type === EMessageType.user ? (
            <UserMessage text={msg.content} />
          ) : msg.type === EMessageType.system ? (
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
