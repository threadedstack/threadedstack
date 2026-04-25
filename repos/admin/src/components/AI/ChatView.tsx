import type { TPendingFile } from '@tdsk/components'

import { TextInput } from '@tdsk/components'
import { useAgentChat } from '@TAF/hooks/chat/useAgentChat'
import { PiChatPanel } from '@TAF/components/PI/PiChatPanel'
import { FilePreview, MessageBubble } from '@tdsk/components'
import { useState, useRef, useEffect, useCallback } from 'react'
import { branchThread } from '@TAF/actions/threads/api/branchThread'
import { useActiveOrgId, useActiveAgent } from '@TAF/state/selectors'
import { useParams, useSearchParams, useNavigate } from 'react-router'
import {
  Box,
  Alert,
  Paper,
  Button,
  Dialog,
  Tooltip,
  Typography,
  IconButton,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  Stop as StopIcon,
  Send as SendIcon,
  Refresh as RefreshIcon,
  ArrowBack as BackIcon,
  AttachFile as AttachIcon,
  SwapHoriz as SwapIcon,
} from '@mui/icons-material'

export type TChatViewProps = {}

export const ChatView = (props: TChatViewProps) => {
  const navigate = useNavigate()
  const { agentId } = useParams<{ agentId: string }>()
  const [orgId] = useActiveOrgId()
  const [agent] = useActiveAgent()
  const [input, setInput] = useState(``)
  const [searchParams, setSearchParams] = useSearchParams()
  const [pendingFiles, setPendingFiles] = useState<TPendingFile[]>([])
  const [usePiUI, setUsePiUI] = useState(false)
  const [branchMsgId, setBranchMsgId] = useState<string | null>(null)
  const [branchSuccess, setBranchSuccess] = useState<string | null>(null)

  const threadParam = searchParams.get(`thread`) || undefined

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { messages, sendMessage, isStreaming, threadId, error, reset, cancel, usage } =
    useAgentChat({
      orgId: orgId || ``,
      agentId: agentId || ``,
      threadId: threadParam,
    })

  // URL transition when thread is created during new chat
  useEffect(() => {
    if (threadId && !threadParam) {
      navigate(`threads/${threadId}/chat`, { replace: true })
    }
  }, [threadId, threadParam, navigate])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: `smooth` })
  }, [messages])

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!input.trim() || isStreaming) return

    const prompt = input
    const files = pendingFiles.map((pf) => pf.file)
    setInput(``)
    setPendingFiles([])
    await sendMessage(prompt, files.length > 0 ? files : undefined)
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

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return

    const newPending: TPendingFile[] = Array.from(files).map((file) => ({
      file,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    }))
    setPendingFiles((prev) => [...prev, ...newPending])

    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = ``
  }

  const onRemoveFile = (id: string) => {
    setPendingFiles((prev) => prev.filter((pf) => pf.id !== id))
  }

  const onBranch = useCallback((messageId: string) => {
    setBranchMsgId(messageId)
  }, [])

  const onBranchConfirm = async () => {
    if (!branchMsgId || !orgId || !agentId || !threadId) return

    const result = await branchThread({
      orgId,
      agentId,
      threadId,
      messageId: branchMsgId,
    })

    setBranchMsgId(null)

    if (result.error) {
      // Show error briefly via the chat error state
      return
    }

    if (result.data?.id) {
      setBranchSuccess(`Thread branched! Navigating...`)
      setTimeout(() => {
        setBranchSuccess(null)
        navigate(`../threads/${result.data!.id}/chat`, { replace: true })
      }, 1000)
    }
  }

  if (!orgId || !agentId) return null

  return (
    <Box
      sx={{
        display: `flex`,
        flexDirection: `column`,
        height: `calc(100vh - 220px)`,
        maxHeight: `calc(100vh - 220px)`,
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
        <Tooltip title={usePiUI ? `Switch to native chat` : `Switch to pi-web-ui`}>
          <IconButton
            size='small'
            onClick={() => setUsePiUI((v) => !v)}
            color={usePiUI ? `primary` : `default`}
          >
            <SwapIcon />
          </IconButton>
        </Tooltip>
        <Button
          size='small'
          variant='outlined'
          startIcon={<RefreshIcon />}
          onClick={() => {
            reset()
            setPendingFiles([])
            setSearchParams({})
          }}
          disabled={isStreaming}
        >
          New Chat
        </Button>
      </Box>

      {usePiUI ? (
        <PiChatPanel
          messages={messages}
          isStreaming={isStreaming}
          onSend={(text) => sendMessage(text)}
          onCancel={cancel}
          error={error || undefined}
        />
      ) : (
        <>
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
                onBranch={threadId ? onBranch : undefined}
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

          {branchSuccess && (
            <Alert
              severity='success'
              sx={{ mx: 2, mb: 1 }}
            >
              {branchSuccess}
            </Alert>
          )}

          <FilePreview
            files={pendingFiles}
            onRemove={onRemoveFile}
          />

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
            <input
              ref={fileInputRef}
              type='file'
              multiple
              hidden
              onChange={onFileSelect}
            />
            <IconButton
              size='small'
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              title='Attach file'
            >
              <AttachIcon />
            </IconButton>
            <TextInput
              fullWidth
              textarea
              autoFocus
              maxRows={4}
              value={input}
              id='chat-input'
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
        </>
      )}

      <Dialog
        open={!!branchMsgId}
        onClose={() => setBranchMsgId(null)}
      >
        <DialogTitle>Branch Thread</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>
            Create a new thread branching at this message? Messages before and including
            this point will be copied to the new thread.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBranchMsgId(null)}>Cancel</Button>
          <Button
            variant='contained'
            onClick={onBranchConfirm}
          >
            Branch
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ChatView
