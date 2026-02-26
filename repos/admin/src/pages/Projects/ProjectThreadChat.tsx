import type { SubmitEvent, KeyboardEvent } from 'react'

import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router'
import { useAgentChat } from '@TAF/hooks/chat/useAgentChat'
import { MessageBubble } from '@TAF/components/AI/MessageBubble'
import { EditThreadDrawer } from '@TAF/components/AI/EditThreadDrawer'
import { useActiveOrgId, useActiveAgent, useActiveThread } from '@TAF/state/selectors'
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
  Edit as EditIcon,
  ArrowBack as BackIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material'

type TMsgParams = {
  agentId: string
  threadId: string
}

export const ProjectThreadChat = () => {
  const navigate = useNavigate()
  const [orgId] = useActiveOrgId()
  const [agent] = useActiveAgent()
  const [thread] = useActiveThread()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const { agentId, threadId: threadParam } = useParams<TMsgParams>()

  const { error, reset, usage, cancel, messages, sendMessage, isStreaming, threadId } =
    useAgentChat({
      orgId: orgId || '',
      agentId: agentId || '',
      threadId: threadParam,
    })

  // URL transition when thread is created during new chat
  useEffect(() => {
    if (threadId && !threadParam) {
      navigate(`threads/${threadId}/chat`, { replace: true })
    }
  }, [threadId, threadParam, navigate])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const onSubmit = async (evt?: SubmitEvent) => {
    evt?.preventDefault()
    if (!input.trim() || isStreaming) return

    const prompt = input
    setInput('')
    await sendMessage(prompt)
  }

  const onKeyDown = (evt: KeyboardEvent) => {
    if (evt.key === `Enter` && !evt.shiftKey) {
      evt.preventDefault()
      onSubmit()
    }
  }

  if (!orgId || !agentId) return null

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 220px)',
        maxHeight: 'calc(100vh - 220px)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <IconButton
          size='small'
          onClick={() => window.history.back()}
        >
          <BackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant='h6'>{agent?.name || 'Agent Chat'}</Typography>
          {(threadId || threadParam) && (
            <Typography
              variant='caption'
              color='text.secondary'
              fontFamily='monospace'
            >
              Thread: {(threadId || threadParam)?.substring(0, 12)}...
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
        {threadParam && thread && (
          <Button
            size='small'
            variant='text'
            startIcon={<EditIcon />}
            onClick={() => setEditDrawerOpen(true)}
          >
            Edit Thread
          </Button>
        )}
        <Button
          size='small'
          variant='outlined'
          startIcon={<RefreshIcon />}
          onClick={() => reset()}
          disabled={isStreaming}
        >
          New Chat
        </Button>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          px: 3,
          py: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          width: '100%',
        }}
      >
        {messages.length === 0 && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography
              variant='body1'
              color='text.secondary'
            >
              Send a message to start chatting with {agent?.name || 'the agent'}
            </Typography>
          </Box>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={
              isStreaming && idx === messages.length - 1 && msg.role === 'assistant'
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
          p: 2,
          gap: 1,
          borderTop: 1,
          display: 'flex',
          alignItems: 'flex-end',
          borderColor: 'divider',
        }}
      >
        <TextField
          fullWidth
          autoFocus
          multiline
          maxRows={4}
          size='small'
          value={input}
          variant='outlined'
          onKeyDown={onKeyDown}
          disabled={isStreaming}
          placeholder='Type a message...'
          onChange={(e) => setInput(e.target.value)}
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

      <EditThreadDrawer
        open={editDrawerOpen}
        thread={thread || null}
        onClose={() => setEditDrawerOpen(false)}
        onSuccess={() => setEditDrawerOpen(false)}
      />
    </Box>
  )
}

export default ProjectThreadChat
