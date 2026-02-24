import { useState, useRef, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { useAgentChat } from '@TAF/hooks/chat/useAgentChat'
import { MessageBubble } from '@TAF/components/AI/MessageBubble'
import { useActiveOrgId, useActiveAgent } from '@TAF/state/selectors'
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
  Stop as StopIcon,
  Send as SendIcon,
  Refresh as RefreshIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material'

// TODO: Accessors should NEVER be imported into react components - are for actions ONLY
import {
  setActiveOrgId,
  setActiveProjectId,
  setActiveAgentId,
} from '@TAF/state/accessors'

export type TChatViewProps = {}

export const ChatView = (props: TChatViewProps) => {
  const {
    orgId: urlOrgId,
    projectId: urlProjectId,
    agentId,
  } = useParams<{ orgId: string; projectId: string; agentId: string }>()
  const [orgId] = useActiveOrgId()
  const [agent] = useActiveAgent()
  const [input, setInput] = useState(``)
  const [searchParams, setSearchParams] = useSearchParams()

  const threadParam = searchParams.get(`thread`) || undefined

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // TODO: This is an anti-pattern and should NEVER be done!!
    // Important - FIX THIS, accessors are not allowed to be used in components
    // Use actions instead!!!
    if (urlOrgId) setActiveOrgId(urlOrgId)
    if (urlProjectId) setActiveProjectId(urlProjectId)
    if (agentId) setActiveAgentId(agentId)
  }, [urlOrgId, urlProjectId, agentId])

  const { messages, sendMessage, isStreaming, threadId, error, reset, cancel, usage } =
    useAgentChat({
      orgId: urlOrgId || orgId || ``,
      agentId: agentId || ``,
      threadId: threadParam,
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
            {agent?.model && (
              <Typography
                variant='caption'
                color='text.secondary'
              >
                {agent.model}
                {agent.environment?.temperature != null
                  ? ` · Temp: ${agent.environment.temperature}`
                  : ''}
              </Typography>
            )}
          </Box>
          {usage.total > 0 && (
            <Typography
              variant='caption'
              color='text.secondary'
              sx={{ mr: 1 }}
            >
              Tokens: {usage.total.toLocaleString()}
            </Typography>
          )}
          {isStreaming && (
            <Button
              size='small'
              color='warning'
              variant='outlined'
              startIcon={<StopIcon />}
              onClick={cancel}
            >
              Stop
            </Button>
          )}
          <Button
            size='small'
            variant='outlined'
            startIcon={<RefreshIcon />}
            onClick={() => {
              reset()
              setSearchParams({})
            }}
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
            width: `100%`,
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
          {isStreaming ? (
            <IconButton
              color='warning'
              onClick={cancel}
            >
              <StopIcon />
            </IconButton>
          ) : (
            <IconButton
              type='submit'
              color='primary'
              disabled={!input.trim()}
            >
              <SendIcon />
            </IconButton>
          )}
        </Paper>
      </Box>
    </Page>
  )
}

export default ChatView
