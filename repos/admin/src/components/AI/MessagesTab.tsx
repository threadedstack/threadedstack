import type { Message } from '@tdsk/domain'

import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { ConfirmDelete, RobotOutlineIcon } from '@tdsk/components'
import { branchThread } from '@TAF/actions/threads/api/branchThread'
import { fetchMessages } from '@TAF/actions/messages/api/fetchMessages'
import { updateMessage } from '@TAF/actions/messages/api/updateMessage'
import { deleteMessage } from '@TAF/actions/messages/api/deleteMessage'
import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  useOrgThreads,
  useActiveOrgId,
  useThreadMessages,
  useActiveThreadId,
} from '@TAF/state/selectors'
import {
  Box,
  Chip,
  Table,
  Alert,
  Button,
  Dialog,
  TableRow,
  TableCell,
  TableBody,
  TableHead,
  TextField,
  Typography,
  IconButton,
  ToggleButton,
  DialogTitle,
  DialogContent,
  DialogActions,
  TableContainer,
  ToggleButtonGroup,
} from '@mui/material'
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Build as ToolIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Settings as SystemIcon,
  CallSplit as BranchIcon,
  ViewList as TableViewIcon,
  ChatBubble as ChatViewIcon,
} from '@mui/icons-material'

type TViewMode = 'chat' | 'table'

export type TMessagesTab = {}

export const MessagesTab = (props: TMessagesTab) => {
  const [orgId] = useActiveOrgId()
  const [activeThreadId, setActiveThreadId] = useActiveThreadId()
  const [threads] = useOrgThreads()
  const [messages] = useThreadMessages()

  const activeThread = activeThreadId ? threads?.[activeThreadId] : undefined
  const agentId = activeThread?.agentId

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<TViewMode>('chat')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [branchDialogOpen, setBranchDialogOpen] = useState(false)
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!orgId || !agentId || !activeThreadId) return

      setLoading(true)
      setError(null)

      const result = await fetchMessages({ orgId, agentId, threadId: activeThreadId })

      if (result.error) {
        setError(result.error.message)
      }

      setLoading(false)
    }

    loadData()
  }, [orgId, agentId, activeThreadId])

  const threadMessages = useMemo(() => {
    if (!messages) return []
    let filtered = Object.values(messages)

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((message) => {
        const content = JSON.stringify(message.content)
        return (
          content?.toLowerCase().includes(query) ||
          message.id?.toLowerCase().includes(query)
        )
      })
    }

    return filtered.sort(
      (a, b) => ((a.createdAt || 0) as any) - ((b.createdAt || 0) as any)
    )
  }, [messages, searchQuery])

  useEffect(() => {
    if (viewMode === 'chat' && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [threadMessages.length, viewMode])

  const getMsgTypeColor = (type: string) => {
    switch (type) {
      case 'user':
        return 'primary'
      case 'assistant':
        return 'success'
      case 'tool':
        return 'warning'
      case 'system':
        return 'default'
      case 'action':
        return 'info'
      default:
        return 'default'
    }
  }

  const extractText = useCallback((content: any): string => {
    if (typeof content === 'string') return content
    if (Array.isArray(content)) {
      return content
        .map((block: any) => {
          if (typeof block === 'string') return block
          if (block.type === 'text') return block.text || ''
          if (block.type === 'tool_use') return `[Tool: ${block.name}]`
          if (block.type === 'tool_result') return block.content || '[Tool Result]'
          return JSON.stringify(block)
        })
        .join('\n')
    }
    if (content && typeof content === 'object') {
      if (content.text) return content.text
      return JSON.stringify(content, null, 2)
    }
    return String(content ?? '')
  }, [])

  const formatContent = (content: any) => {
    const text = extractText(content)
    return text.length > 100 ? text.substring(0, 100) + '...' : text
  }

  const getMsgIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <PersonIcon sx={{ fontSize: 18 }} />
      case 'assistant':
        return <RobotOutlineIcon sx={{ fontSize: 18 }} />
      case 'tool':
        return <ToolIcon sx={{ fontSize: 18 }} />
      case 'system':
        return <SystemIcon sx={{ fontSize: 18 }} />
      default:
        return <PersonIcon sx={{ fontSize: 18 }} />
    }
  }

  const getMsgBgColor = (type: string) => {
    switch (type) {
      case 'user':
        return 'primary.main'
      case 'assistant':
        return 'grey.700'
      case 'tool':
        return 'warning.main'
      case 'system':
        return 'grey.500'
      default:
        return 'grey.600'
    }
  }

  const onEditStart = (message: Message) => {
    setEditingId(message.id)
    setEditContent(extractText(message.content))
  }

  const onEditCancel = () => {
    setEditingId(null)
    setEditContent('')
  }

  const onEditSave = async (message: Message) => {
    if (!orgId || !agentId || !activeThreadId) return

    const result = await updateMessage({
      orgId,
      agentId,
      threadId: activeThreadId,
      messageId: message.id,
      data: { content: editContent },
    })

    if (result.error) {
      setError(result.error.message || 'Failed to update message')
    } else {
      setSuccess('Message updated')
      setTimeout(() => setSuccess(null), 2000)
    }

    setEditingId(null)
    setEditContent('')
  }

  const onDeleteClick = (message: Message) => {
    setSelectedMessage(message)
    setDeleteDialogOpen(true)
  }

  const onDeleteConfirm = async () => {
    if (!selectedMessage || !orgId || !agentId || !activeThreadId) return

    const result = await deleteMessage({
      orgId,
      agentId,
      threadId: activeThreadId,
      messageId: selectedMessage.id,
    })

    if (result.error) {
      setError(result.error.message || 'Failed to delete message')
    } else {
      setSuccess('Message deleted')
      setTimeout(() => setSuccess(null), 2000)
    }

    setDeleteDialogOpen(false)
    setSelectedMessage(null)
  }

  const onBranchClick = (message: Message) => {
    setSelectedMessage(message)
    setBranchDialogOpen(true)
  }

  const onBranchConfirm = async () => {
    if (!selectedMessage || !orgId || !agentId || !activeThreadId) return

    const result = await branchThread({
      orgId,
      agentId,
      threadId: activeThreadId,
      messageId: selectedMessage.id,
      contextKey: 'org',
    })

    if (result.error) {
      setError(result.error.message || 'Failed to branch thread')
    } else {
      setSuccess('Thread branched successfully')
      setTimeout(() => setSuccess(null), 2000)
      if (result.data?.id) {
        setActiveThreadId(result.data.id)
      }
    }

    setBranchDialogOpen(false)
    setSelectedMessage(null)
  }

  if (!activeThreadId) {
    return (
      <EmptyState message='Select a thread from the Threads tab to view its messages.' />
    )
  }

  return (
    <PageLayout
      error={error}
      searchCount={0}
      title='Messages'
      loading={loading}
      setError={setError}
      query={searchQuery}
      countLabel='message'
      count={threadMessages.length}
      setSearchQuery={setSearchQuery}
      searchPlaceholder='Search messages...'
    >
      <Box
        className='tdsk-tab-box'
        sx={{
          mb: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography
          variant='body2'
          color='text.secondary'
          className='tdsk-msg-thread-name'
        >
          Thread: {activeThread?.name || 'Untitled'}
          {activeThread?.parentThreadId && (
            <Chip
              size='small'
              label='branched'
              variant='outlined'
              sx={{ ml: 1 }}
            />
          )}
        </Typography>
        <ToggleButtonGroup
          exclusive
          size='small'
          value={viewMode}
          className='tdsk-msg-toggle-btn-group'
          onChange={(_, v) => v && setViewMode(v)}
        >
          <ToggleButton
            className='tdsk-msg-toggle-btn-chat'
            value='chat'
          >
            <ChatViewIcon sx={{ fontSize: 18, mr: 0.5 }} />
            Chat
          </ToggleButton>
          <ToggleButton
            className='tdsk-msg-toggle-btn-table'
            value='table'
          >
            <TableViewIcon sx={{ fontSize: 18, mr: 0.5 }} />
            Table
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {success && (
        <Alert
          severity='success'
          sx={{ mb: 2 }}
        >
          {success}
        </Alert>
      )}

      {threadMessages.length === 0 && !loading && (
        <EmptyState message='No messages found for this thread.' />
      )}

      {threadMessages.length > 0 && viewMode === 'chat' && (
        <Box
          className='tdsk-msgs-box'
          sx={{
            p: 2,
            gap: 2,
            border: 1,
            width: '100%',
            minHeight: 300,
            display: 'flex',
            overflow: 'auto',
            borderRadius: 1,
            borderColor: 'divider',
            bgcolor: 'background.default',
            flexDirection: 'column',
            maxHeight: 'calc(100vh - 350px)',
            '& pre, & code': {
              overflowX: 'auto',
              maxWidth: '100%',
            },
          }}
        >
          {threadMessages.map((message) => {
            const isUser = message.type === 'user'
            const isEditing = editingId === message.id

            return (
              <Box
                className='tdsk-msg-box'
                key={message.id}
                sx={{
                  gap: 1.5,
                  display: 'flex',
                  alignItems: 'flex-start',
                  flexDirection: isUser ? 'row-reverse' : 'row',
                }}
              >
                <Box
                  className='tdsk-msg-icon-box'
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: getMsgBgColor(message.type),
                    color: 'white',
                    flexShrink: 0,
                    mt: 0.5,
                  }}
                >
                  {getMsgIcon(message.type)}
                </Box>

                <Box
                  className='tdsk-msg-pos-box'
                  sx={{ maxWidth: isUser ? '75%' : '85%', minWidth: 0 }}
                >
                  <Box
                    className='tdsk-msg-bubble-box'
                    sx={{
                      px: 2,
                      py: 1.5,
                      borderRadius: 2,
                      bgcolor: isUser ? 'primary.main' : 'background.paper',
                      color: isUser ? 'primary.contrastText' : 'text.primary',
                      border: isUser ? 'none' : 1,
                      borderColor: 'divider',
                    }}
                  >
                    {isEditing ? (
                      <Box className='tdsk-msg-edit-box'>
                        <TextField
                          fullWidth
                          multiline
                          minRows={2}
                          maxRows={10}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          size='small'
                          sx={{
                            '& .MuiInputBase-root': {
                              bgcolor: 'background.default',
                            },
                          }}
                        />
                        <Box
                          className='tdsk-msg-edit-actions-box'
                          sx={{
                            mt: 1,
                            gap: 1,
                            display: 'flex',
                            justifyContent: 'flex-end',
                          }}
                        >
                          <IconButton
                            size='small'
                            onClick={onEditCancel}
                            className='tdsk-msg-edit-close-action'
                          >
                            <CloseIcon fontSize='small' />
                          </IconButton>
                          <IconButton
                            size='small'
                            color='primary'
                            className='tdsk-msg-edit-save-action'
                            onClick={() => onEditSave(message)}
                          >
                            <SaveIcon fontSize='small' />
                          </IconButton>
                        </Box>
                      </Box>
                    ) : (
                      <Typography
                        variant='body2'
                        className='tdsk-msg-edit-text'
                        sx={{
                          fontSize: '14px',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {extractText(message.content)}
                      </Typography>
                    )}
                  </Box>

                  {!isEditing && (
                    <Box
                      className='tdsk-msg-display-box'
                      sx={{
                        mt: 0.5,
                        gap: 0.5,
                        opacity: 0.6,
                        display: 'flex',
                        justifyContent: isUser ? 'flex-end' : 'flex-start',
                        '&:hover': { opacity: 1 },
                      }}
                    >
                      <IconButton
                        size='small'
                        title='Edit message'
                        className='tdsk-msg-display-edit-action'
                        onClick={() => onEditStart(message)}
                      >
                        <EditIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                      <IconButton
                        size='small'
                        title='Branch at this message'
                        onClick={() => onBranchClick(message)}
                        className='tdsk-msg-display-branch-action'
                      >
                        <BranchIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                      <IconButton
                        size='small'
                        title='Delete message'
                        onClick={() => onDeleteClick(message)}
                        className='tdsk-msg-display-delete-action'
                      >
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        sx={{ ml: 1, alignSelf: 'center' }}
                      >
                        {message.createdAt
                          ? new Date(message.createdAt).toLocaleTimeString()
                          : ''}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            )
          })}
          <div ref={messagesEndRef} />
        </Box>
      )}

      {threadMessages.length > 0 && viewMode === 'table' && (
        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Content</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align='right'>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {threadMessages.map((message) => (
                <TableRow
                  key={message.id}
                  hover
                >
                  <TableCell>
                    <Chip
                      label={message.type}
                      size='small'
                      color={getMsgTypeColor(message.type) as any}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant='body2'
                      sx={{
                        maxWidth: 400,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatContent(message.content)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant='body2'>
                      {message.createdAt
                        ? new Date(message.createdAt).toLocaleString()
                        : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align='right'>
                    <IconButton
                      size='small'
                      color='primary'
                      title='Edit message'
                      onClick={() => onEditStart(message)}
                    >
                      <EditIcon fontSize='small' />
                    </IconButton>
                    <IconButton
                      size='small'
                      color='info'
                      title='Branch at this message'
                      onClick={() => onBranchClick(message)}
                    >
                      <BranchIcon fontSize='small' />
                    </IconButton>
                    <IconButton
                      size='small'
                      color='error'
                      title='Delete message'
                      onClick={() => onDeleteClick(message)}
                    >
                      <DeleteIcon fontSize='small' />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ConfirmDelete
        title='Delete Message?'
        open={deleteDialogOpen}
        itemName='this message'
        onConfirm={onDeleteConfirm}
        warnText='This will permanently delete this message. This action cannot be undone.'
        onCancel={() => {
          setDeleteDialogOpen(false)
          setSelectedMessage(null)
        }}
      />

      <Dialog
        open={branchDialogOpen}
        onClose={() => {
          setBranchDialogOpen(false)
          setSelectedMessage(null)
        }}
      >
        <DialogTitle>Branch Thread</DialogTitle>
        <DialogContent>
          <Typography variant='body2'>
            Create a new thread branching at this message? Messages before and including
            this point will be copied to the new thread. Messages after this point will
            not be included.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setBranchDialogOpen(false)
              setSelectedMessage(null)
            }}
          >
            Cancel
          </Button>
          <Button
            variant='contained'
            onClick={onBranchConfirm}
          >
            Branch
          </Button>
        </DialogActions>
      </Dialog>
    </PageLayout>
  )
}
