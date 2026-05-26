import type { TChatMessage } from '@tdsk/components'
import type { AgentMessage } from '@earendil-works/pi-web-ui'
import type { MessageList, MessageEditor } from '@earendil-works/pi-web-ui'

import '@earendil-works/pi-web-ui/app.css'

import { useRef, useEffect } from 'react'
import { Box, Alert } from '@mui/material'
import { getThemeBridgeStyles } from '@TAF/utils/piWebUiThemeBridge'

export type TPiChatPanel = {
  messages: TChatMessage[]
  isStreaming: boolean
  onSend: (text: string) => void
  onCancel: () => void
  error?: string
}

/**
 * Convert our TChatMessage[] to pi-agent-core AgentMessage[] format.
 *
 * pi-web-ui's MessageList expects AgentMessage which is a union of:
 *   - UserMessage:       { role: 'user', content: string | (TextContent | ImageContent)[], timestamp }
 *   - AssistantMessage:  { role: 'assistant', content: (TextContent | ThinkingContent | ToolCall)[], ... }
 *   - ToolResultMessage: { role: 'toolResult', ... }
 *
 * We map TChatMessage to the UserMessage and AssistantMessage variants.
 */
const convertMessages = (messages: TChatMessage[]): AgentMessage[] => {
  return messages.map((msg): AgentMessage => {
    if (msg.role === `user`) {
      return {
        role: `user`,
        content: msg.text,
        timestamp: msg.timestamp,
      } as AgentMessage
    }

    const content: { type: `text`; text: string }[] = []
    if (msg.text) {
      content.push({ type: `text`, text: msg.text })
    }

    return {
      role: `assistant`,
      content,
      api: `openai-completions`,
      provider: `openai`,
      model: ``,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: `stop`,
      timestamp: msg.timestamp,
    } as AgentMessage
  })
}

/**
 * React wrapper around pi-web-ui's `message-list` and `message-editor` Lit web components.
 *
 * Uses refs + useEffect to sync React state into the imperative Lit component properties.
 * Wrapped in a container with CSS custom property overrides so pi-web-ui inherits
 * our MUI dark theme.
 */
export const PiChatPanel = (props: TPiChatPanel) => {
  const { messages, isStreaming, onSend, onCancel, error } = props

  const listRef = useRef<MessageList | null>(null)
  const editorRef = useRef<MessageEditor | null>(null)

  // Sync messages into the MessageList web component
  useEffect(() => {
    if (!listRef.current) return
    listRef.current.messages = convertMessages(messages)
    listRef.current.isStreaming = isStreaming
  }, [messages, isStreaming])

  // Sync streaming state and wire callbacks on the MessageEditor
  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.isStreaming = isStreaming
  }, [isStreaming])

  // Attach callbacks after mount
  useEffect(() => {
    if (!editorRef.current) return
    editorRef.current.onSend = onSend
    editorRef.current.onAbort = onCancel
  }, [onSend, onCancel])

  const themeBridgeStyles = getThemeBridgeStyles()

  return (
    <Box
      className='dark pi-chat-panel-wrapper'
      sx={{
        width: `100%`,
        height: `100%`,
        display: `flex`,
        overflow: `hidden`,
        color: `text.primary`,
        flexDirection: `column`,
        bgcolor: `background.default`,
      }}
      style={themeBridgeStyles}
    >
      <Box
        sx={{
          flex: 1,
          overflow: `auto`,
          minHeight: 0,
        }}
      >
        <message-list
          ref={(el: HTMLElement | null) => {
            listRef.current = el as MessageList | null
          }}
        />
      </Box>

      {error && (
        <Alert
          severity='error'
          sx={{ mx: 2, mb: 1 }}
        >
          {error}
        </Alert>
      )}

      <Box
        sx={{
          flexShrink: 0,
          borderTop: 1,
          borderColor: `divider`,
        }}
      >
        <message-editor
          ref={(el: HTMLElement | null) => {
            editorRef.current = el as MessageEditor | null
          }}
        />
      </Box>
    </Box>
  )
}
