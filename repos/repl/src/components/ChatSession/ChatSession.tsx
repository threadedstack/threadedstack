import type { TConnectionStatus, TMessage, TSelectItem, TToolCall } from '@TRL/types'

import { memo } from 'react'
import { Box } from 'ink'
import { Prompt } from '@TRL/components/Prompt'
import { StatusBar } from '@TRL/components/StatusBar/StatusBar'
import { MessageList } from '@TRL/components/Message/MessageList'
import { Streaming } from '@TRL/components/Streaming/Streaming'

type TSubMenuProps = {
  prompt: string
  visible: boolean
  items: TSelectItem[]
  selectedIndex: number
}

type TMetadata = {
  orgName?: string
  agentName?: string
  threadName?: string
  projectName?: string
  connection: TConnectionStatus
}

type TChatSession = {
  agentName: string
  verbose?: boolean
  modelName?: string
  streamText: string
  threadName?: string
  isStreaming: boolean
  isPreAuth?: boolean
  messages: TMessage[]
  metadata?: TMetadata
  providerName?: string
  toolCalls: TToolCall[]
  subMenu?: TSubMenuProps
  onSubMenuUp?: () => void
  onSubMenuDown?: () => void
  onSubMenuClose?: () => void
  onSubMenuSelect?: () => void
  onSubMenuAction?: () => void
  connection: TConnectionStatus
  onSubmit: (text: string) => void
}

export const ChatSession = memo((props: TChatSession) => {
  const {
    verbose,
    subMenu,
    onSubmit,
    metadata,
    messages,
    toolCalls,
    agentName,
    modelName,
    threadName,
    isPreAuth,
    connection,
    streamText,
    isStreaming,
    providerName,
    onSubMenuUp,
    onSubMenuDown,
    onSubMenuClose,
    onSubMenuSelect,
    onSubMenuAction,
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
          verbose={verbose}
          text={streamText}
          toolCalls={toolCalls}
          isStreaming={isStreaming}
        />
      )}
      <Prompt
        subMenu={subMenu}
        metadata={metadata}
        onSubmit={onSubmit}
        isPreAuth={isPreAuth}
        disabled={isStreaming}
        onSubMenuUp={onSubMenuUp}
        onSubMenuDown={onSubMenuDown}
        onSubMenuSelect={onSubMenuSelect}
        onSubMenuAction={onSubMenuAction}
        onSubMenuClose={onSubMenuClose}
      />
    </Box>
  )
})
