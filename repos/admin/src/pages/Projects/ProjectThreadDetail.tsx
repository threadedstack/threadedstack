import { ERoutePath } from '@TAF/types'
import { ConfirmDelete } from '@tdsk/components'
import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import { buildNavRoute } from '@TAF/utils/nav/buildRoute'
import { msgTypeColor } from '@TAF/utils/transforms/messages'
import { AgentSection } from '@TAF/components/Agents/AgentSection'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { useMessageActions } from '@TAF/hooks/chat/useMessageActions'
import { EditThreadDrawer } from '@TAF/components/AI/EditThreadDrawer'
import { fetchMessages } from '@TAF/actions/messages/api/fetchMessages'
import {
  useProviders,
  useActiveOrgId,
  useActiveAgent,
  useActiveThread,
  useActiveThreadId,
  useActiveProjectId,
  useThreadMessages,
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
  TableContainer,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Chat as ChatIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  CallSplit as BranchIcon,
} from '@mui/icons-material'

export const ProjectThreadDetail = () => {
  const navigate = useNavigate()
  const { agentId, threadId } = useParams<{ agentId: string; threadId: string }>()
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [agent] = useActiveAgent()
  const [thread] = useActiveThread()
  const [messages] = useThreadMessages()
  const [providers] = useProviders()
  const [, setActiveThreadId] = useActiveThreadId()

  const [loading, setLoading] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)

  const msgActions = useMessageActions({
    orgId: orgId || '',
    agentId: agentId || '',
    threadId: threadId || '',
    onBranchSuccess: (newThreadId) => {
      setActiveThreadId(newThreadId)
      navigate(
        buildNavRoute(
          { orgId, projectId, agentId, threadId: newThreadId },
          ERoutePath.ProjectAgentThreadDetail
        )
      )
    },
  })

  useEffect(() => {
    const loadMessages = async () => {
      if (!orgId || !agentId || !threadId) return
      setLoading(true)
      await fetchMessages({ orgId, agentId, threadId })
      setLoading(false)
    }
    loadMessages()
  }, [orgId, agentId, threadId])

  const threadMessages = useMemo(() => {
    if (!messages) return []
    return Object.values(messages).sort(
      (a, b) => ((a.createdAt || 0) as any) - ((b.createdAt || 0) as any)
    )
  }, [messages])

  const formatContent = (content: any) => {
    const text = msgActions.extractText(content)
    return text.length > 100 ? text.substring(0, 100) + '...' : text
  }

  const getProviderName = () => {
    if (!thread?.providerId || !providers) return agent?.primaryProvider?.name || '-'
    return providers[thread.providerId]?.name || agent?.primaryProvider?.name || '-'
  }

  const onContinueChat = () => {
    navigate(`chat`)
  }

  const onEditSuccess = () => {
    setEditDrawerOpen(false)
  }

  if (!thread && !loading) {
    return <EmptyState message='Thread not found.' />
  }

  return (
    <>
      {thread && (
        <AgentSection title='Thread Details'>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant='h6'>{thread.name || 'Untitled Thread'}</Typography>
            {thread.parentThreadId && (
              <Chip
                icon={<BranchIcon sx={{ fontSize: 14 }} />}
                label='branched'
                size='small'
                variant='outlined'
                color='info'
              />
            )}
            <Chip
              size='small'
              label={thread.public ? 'Public' : 'Private'}
              color={thread.public ? 'success' : 'default'}
              variant='outlined'
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 3, mb: 2, flexWrap: 'wrap' }}>
            <Box>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Thread ID
              </Typography>
              <Typography
                variant='body2'
                fontFamily='monospace'
              >
                {thread.id}
              </Typography>
            </Box>
            <Box>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Provider
              </Typography>
              <Typography variant='body2'>{getProviderName()}</Typography>
            </Box>
            {thread.createdAt && (
              <Box>
                <Typography
                  variant='subtitle2'
                  color='text.secondary'
                >
                  Created
                </Typography>
                <Typography variant='body2'>
                  {new Date(thread.createdAt).toLocaleString()}
                </Typography>
              </Box>
            )}
            {thread.updatedAt && (
              <Box>
                <Typography
                  variant='subtitle2'
                  color='text.secondary'
                >
                  Updated
                </Typography>
                <Typography variant='body2'>
                  {new Date(thread.updatedAt).toLocaleString()}
                </Typography>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size='small'
              variant='outlined'
              startIcon={<ChatIcon />}
              onClick={onContinueChat}
            >
              Continue Chat
            </Button>
            <Button
              size='small'
              variant='text'
              startIcon={<EditIcon />}
              onClick={() => setEditDrawerOpen(true)}
            >
              Edit Thread
            </Button>
          </Box>
        </AgentSection>
      )}

      {msgActions.error && (
        <Alert
          severity='error'
          sx={{ mb: 2 }}
        >
          {msgActions.error}
        </Alert>
      )}
      {msgActions.success && (
        <Alert
          severity='success'
          sx={{ mb: 2 }}
        >
          {msgActions.success}
        </Alert>
      )}

      <AgentSection title={`Messages (${threadMessages.length})`}>
        {threadMessages.length === 0 && !loading && (
          <EmptyState message='No messages found for this thread.' />
        )}

        {threadMessages.length > 0 && (
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
                        color={msgTypeColor(message.type) as any}
                      />
                    </TableCell>
                    <TableCell>
                      {msgActions.editingId === message.id ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <TextField
                            fullWidth
                            multiline
                            maxRows={4}
                            size='small'
                            value={msgActions.editContent}
                            onChange={(e) => msgActions.setEditContent(e.target.value)}
                          />
                          <IconButton
                            size='small'
                            onClick={msgActions.onEditCancel}
                          >
                            <CloseIcon fontSize='small' />
                          </IconButton>
                          <IconButton
                            size='small'
                            color='primary'
                            onClick={() => msgActions.onEditSave(message)}
                          >
                            <SaveIcon fontSize='small' />
                          </IconButton>
                        </Box>
                      ) : (
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
                      )}
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
                        onClick={() => msgActions.onEditStart(message)}
                      >
                        <EditIcon fontSize='small' />
                      </IconButton>
                      <IconButton
                        size='small'
                        color='info'
                        title='Branch at this message'
                        onClick={() => msgActions.onBranchClick(message)}
                      >
                        <BranchIcon fontSize='small' />
                      </IconButton>
                      <IconButton
                        size='small'
                        color='error'
                        title='Delete message'
                        onClick={() => msgActions.onDeleteClick(message)}
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
      </AgentSection>

      <ConfirmDelete
        title='Delete Message?'
        open={msgActions.deleteDialogOpen}
        itemName='this message'
        onConfirm={msgActions.onDeleteConfirm}
        warnText='This will permanently delete this message. This action cannot be undone.'
        onCancel={msgActions.onDeleteCancel}
      />

      <Dialog
        open={msgActions.branchDialogOpen}
        onClose={msgActions.onBranchCancel}
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
          <Button onClick={msgActions.onBranchCancel}>Cancel</Button>
          <Button
            variant='contained'
            onClick={msgActions.onBranchConfirm}
          >
            Branch
          </Button>
        </DialogActions>
      </Dialog>

      <EditThreadDrawer
        thread={thread || null}
        open={editDrawerOpen}
        onSuccess={onEditSuccess}
        onClose={() => setEditDrawerOpen(false)}
      />
    </>
  )
}

export default ProjectThreadDetail
