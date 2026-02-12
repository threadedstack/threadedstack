import { useState, useRef, useEffect } from 'react'
import { useParams } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { useAgentChat } from '@TAF/hooks/chat/useAgentChat'
import { MessageBubble } from '@TAF/components/AI/MessageBubble'
import { useActiveOrgId, useAgents } from '@TAF/state/selectors'
import {
  Box,
  Alert,
  Paper,
  Button,
  TextField,
  Typography,
  IconButton,
} from '@mui/material'
import {
  Send as SendIcon,
  Refresh as RefreshIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material'

export type TChatViewProps = {}

export const ChatView = (props: TChatViewProps) => {
  const { agentId } = useParams<{ agentId: string }>()
  const [orgId] = useActiveOrgId()
  const [agents] = useAgents()
  const [input, setInput] = useState(``)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const agent = agentId ? agents?.[agentId] : undefined

  const { messages, sendMessage, isStreaming, threadId, error, reset } = useAgentChat({
    orgId: orgId || ``,
    agentId: agentId || ``,
  })

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: `smooth` })
  }, [messages])

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isStreaming) return

    const prompt = input
    setInput(``)
    await sendMessage(prompt)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === `Enter` && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  const onBack = () => {
    window.history.back()
  }

  if (!orgId || !agentId) return null

  return (
    <Page className='tdsk-chat-view-page'>
      <Box
        sx={{
          display: `flex`,
          flexDirection: `column`,
          height: `calc(100vh - 100px)`,
          maxHeight: `calc(100vh - 100px)`,
        }}
      >
        <Box
          sx={{
            display: `flex`,
            alignItems: `center`,
            gap: 1,
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: `divider`,
          }}
        >
          <IconButton
            size='small'
            onClick={onBack}
          >
            <BackIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography variant='h6'>{agent?.name || `Agent Chat`}</Typography>
            {threadId && (
              <Typography
                variant='caption'
                color='text.secondary'
                fontFamily='monospace'
              >
                Thread: {threadId.substring(0, 12)}...
              </Typography>
            )}
          </Box>
          <Button
            size='small'
            variant='outlined'
            startIcon={<RefreshIcon />}
            onClick={reset}
            disabled={isStreaming}
          >
            New Chat
          </Button>
        </Box>

        <Box
          sx={{
            flex: 1,
            overflow: `auto`,
            px: 3,
            py: 2,
            display: `flex`,
            flexDirection: `column`,
            gap: 2,
          }}
        >
          {messages.length === 0 && (
            <Box
              sx={{
                flex: 1,
                display: `flex`,
                alignItems: `center`,
                justifyContent: `center`,
              }}
            >
              <Typography
                variant='body1'
                color='text.secondary'
              >
                Send a message to start chatting with{` `}
                {agent?.name || `the agent`}
              </Typography>
            </Box>
          )}

          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isStreaming={
                isStreaming && idx === messages.length - 1 && msg.role === `assistant`
              }
            />
          ))}
          <div ref={messagesEndRef} />
        </Box>

        {error && (
          <Alert
            severity='error'
            sx={{ mx: 2, mb: 1 }}
          >
            {error}
          </Alert>
        )}

        <Paper
          component='form'
          onSubmit={onSubmit}
          elevation={2}
          sx={{
            display: `flex`,
            alignItems: `flex-end`,
            gap: 1,
            p: 2,
            borderTop: 1,
            borderColor: `divider`,
          }}
        >
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={input}
            autoFocus
            placeholder='Type a message...'
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={isStreaming}
            variant='outlined'
            size='small'
          />
          <IconButton
            type='submit'
            color='primary'
            disabled={isStreaming || !input.trim()}
          >
            <SendIcon />
          </IconButton>
        </Paper>
      </Box>
    </Page>
  )
}

export default ChatView
