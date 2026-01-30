import type { Thread } from '@tdsk/domain'
import {
  useActiveOrgId,
  useActiveProjectId,
  useThreads,
  useActiveThreadId,
} from '@TAF/state/selectors'
import { fetchThreads } from '@TAF/actions/threads/api/fetchThreads'
import { deleteThread } from '@TAF/actions/threads/api/deleteThread'
import { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Card,
  Alert,
  Button,
  Table,
  TableRow,
  TextField,
  TableCell,
  TableBody,
  TableHead,
  Typography,
  IconButton,
  CardContent,
  InputAdornment,
  TableContainer,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Clear as ClearIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import { Loading, ConfirmDelete } from '@tdsk/components'
import { CreateThreadDrawer } from './CreateThreadDrawer'
import { EditThreadDrawer } from './EditThreadDrawer'
import { setActiveThreadId } from '@TAF/state/accessors'

export type TThreadsTab = {}

export const ThreadsTab = (props: TThreadsTab) => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [threads] = useThreads()
  const [, setActiveThreadId] = useActiveThreadId()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!orgId || !projectId) return

      setLoading(true)
      setError(null)

      const result = await fetchThreads({ orgId, projectId })

      if (result.error) {
        setError(result.error.message)
      }

      setLoading(false)
    }

    loadData()
  }, [orgId, projectId])

  const projectThreads = useMemo(() => {
    if (!threads || !projectId) return []
    let filtered = Object.values(threads).filter(
      (thread) => thread.projectId === projectId
    )

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((thread) => {
        return (
          thread.name?.toLowerCase().includes(query) ||
          thread.id?.toLowerCase().includes(query)
        )
      })
    }

    return filtered
  }, [threads, projectId, searchQuery])

  const totalThreadsCount = useMemo(() => {
    if (!threads || !projectId) return 0
    return Object.values(threads).filter((thread) => thread.projectId === projectId)
      .length
  }, [threads, projectId])

  const onCreateThread = () => {
    setCreateDialogOpen(true)
  }

  const onCreateSuccess = async () => {
    if (orgId && projectId) {
      await fetchThreads({ orgId, projectId })
    }
    setSuccess('Thread created successfully')
    setTimeout(() => setSuccess(null), 2000)
  }

  const onEditThread = (thread: Thread) => {
    setSelectedThread(thread)
    setEditDialogOpen(true)
  }

  const onEditSuccess = async () => {
    if (orgId && projectId) {
      await fetchThreads({ orgId, projectId })
    }
    setSuccess('Thread updated successfully')
    setTimeout(() => setSuccess(null), 2000)
  }

  const onDeleteThread = (thread: Thread) => {
    setSelectedThread(thread)
    setDeleteDialogOpen(true)
  }

  const onDeleteConfirm = async () => {
    if (!selectedThread) return

    const result = await deleteThread(selectedThread.id)

    if (result.error) {
      setError(result.error.message)
      setDeleteDialogOpen(false)
    } else {
      setSuccess('Thread deleted successfully')
      setDeleteDialogOpen(false)
      setTimeout(() => setSuccess(null), 2000)
      // Refresh threads
      if (orgId && projectId) {
        await fetchThreads({ orgId, projectId })
      }
    }
  }

  const onViewThread = (thread: Thread) => {
    setActiveThreadId(thread.id)
    // TODO: Navigate to messages tab and filter by this thread
  }

  return (
    <Box>
      {loading && (
        <Loading
          fixed
          full
        />
      )}

      {error && (
        <Box
          component='alert'
          sx={{ mb: 3, color: 'error.main' }}
        >
          {error}
        </Box>
      )}

      {success && (
        <Alert
          severity='success'
          sx={{ mb: 3 }}
        >
          {success}
        </Alert>
      )}

      {!loading && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant='h6'>Threads</Typography>
                <Typography
                  variant='body2'
                  color='text.secondary'
                >
                  {totalThreadsCount} thread{totalThreadsCount !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <Button
                size='small'
                variant='outlined'
                startIcon={<AddIcon />}
                onClick={onCreateThread}
              >
                Create Thread
              </Button>
            </Box>

            {totalThreadsCount > 0 && (
              <Box sx={{ mb: 2 }}>
                <TextField
                  placeholder='Search threads by name or ID...'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size='small'
                  fullWidth
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position='start'>
                        <SearchIcon color='action' />
                      </InputAdornment>
                    ),
                    endAdornment: searchQuery && (
                      <InputAdornment position='end'>
                        <IconButton
                          size='small'
                          onClick={() => setSearchQuery('')}
                          edge='end'
                        >
                          <ClearIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />
              </Box>
            )}

            {totalThreadsCount === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color='text.secondary'>
                  No threads found for this project. Create a thread to start managing AI
                  conversations.
                </Typography>
              </Box>
            )}

            {totalThreadsCount > 0 && projectThreads.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography color='text.secondary'>
                  No threads match your search criteria.
                </Typography>
              </Box>
            )}

            {projectThreads.length > 0 && (
              <TableContainer>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>ID</TableCell>
                      <TableCell>Provider</TableCell>
                      <TableCell>Public</TableCell>
                      <TableCell align='right'>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {projectThreads.map((thread) => (
                      <TableRow
                        key={thread.id}
                        hover
                      >
                        <TableCell>
                          <Typography variant='body2'>
                            {thread.name || 'Untitled Thread'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant='body2'
                            fontFamily='monospace'
                            sx={{ fontSize: '0.75rem' }}
                          >
                            {thread.id}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant='body2'
                            fontFamily='monospace'
                            sx={{ fontSize: '0.75rem' }}
                          >
                            {thread.providerId || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>
                            {thread.public ? 'Yes' : 'No'}
                          </Typography>
                        </TableCell>
                        <TableCell align='right'>
                          <IconButton
                            size='small'
                            color='info'
                            onClick={() => onViewThread(thread)}
                            title='View messages'
                          >
                            <ViewIcon fontSize='small' />
                          </IconButton>
                          <IconButton
                            size='small'
                            color='primary'
                            onClick={() => onEditThread(thread)}
                            title='Edit thread'
                          >
                            <EditIcon fontSize='small' />
                          </IconButton>
                          <IconButton
                            size='small'
                            color='error'
                            onClick={() => onDeleteThread(thread)}
                            title='Delete thread'
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
          </CardContent>
        </Card>
      )}

      {orgId && projectId && (
        <CreateThreadDrawer
          orgId={orgId}
          projectId={projectId}
          open={createDialogOpen}
          onSuccess={onCreateSuccess}
          onClose={() => setCreateDialogOpen(false)}
        />
      )}

      <EditThreadDrawer
        thread={selectedThread}
        open={editDialogOpen}
        onSuccess={onEditSuccess}
        onClose={() => {
          setEditDialogOpen(false)
          setSelectedThread(null)
        }}
      />

      <ConfirmDelete
        onConfirm={onDeleteConfirm}
        title='Delete Thread?'
        open={deleteDialogOpen}
        itemName={selectedThread?.name || selectedThread?.id}
        onCancel={() => {
          setDeleteDialogOpen(false)
          setSelectedThread(null)
        }}
        warnText='This will permanently delete this thread and all associated messages. This action cannot be undone.'
      />
    </Box>
  )
}
