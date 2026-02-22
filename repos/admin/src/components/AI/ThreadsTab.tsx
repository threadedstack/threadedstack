import type { Thread } from '@tdsk/domain'
import { ConfirmDelete } from '@tdsk/components'
import { useState, useEffect, useMemo } from 'react'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { fetchThreads } from '@TAF/actions/threads/api/fetchThreads'
import { deleteThread } from '@TAF/actions/threads/api/deleteThread'
import { EditThreadDrawer } from '@TAF/components/AI/EditThreadDrawer'
import { CreateThreadDrawer } from '@TAF/components/AI/CreateThreadDrawer'
import {
  useOrgAgents,
  useOrgThreads,
  useProviders,
  useActiveOrgId,
  useActiveAgentId,
  useActiveThreadId,
} from '@TAF/state/selectors'
import {
  Box,
  Chip,
  Alert,
  Table,
  Select,
  Tooltip,
  MenuItem,
  TableRow,
  TableCell,
  TableBody,
  TableHead,
  Typography,
  IconButton,
  InputLabel,
  FormControl,
  TableContainer,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  CallSplit as BranchIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'

export type TThreadsTab = {
  onViewThread?: (threadId: string) => void
}

export const ThreadsTab = (props: TThreadsTab) => {
  const { onViewThread: onViewThreadCB } = props
  const [orgId] = useActiveOrgId()
  const [agents] = useOrgAgents()
  const [threads] = useOrgThreads()
  const [providers] = useProviders()
  const [, setActiveThreadId] = useActiveThreadId()
  const [activeAgentId] = useActiveAgentId()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [filterProviderId, setFilterProviderId] = useState<string>('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null)

  const agent = activeAgentId ? agents?.[activeAgentId] : undefined

  const filterProviders = useMemo(() => {
    const providerMap = new Map<string, string>()

    if (agent?.primaryProvider) {
      providerMap.set(
        agent.primaryProvider.id,
        agent.primaryProvider.name || 'Primary Provider'
      )
    }

    if (threads && providers) {
      Object.values(threads).forEach((thread) => {
        if (
          thread.agentId === activeAgentId &&
          thread.providerId &&
          providers[thread.providerId]
        ) {
          providerMap.set(thread.providerId, providers[thread.providerId].name)
        }
      })
    }

    return Array.from(providerMap, ([id, name]) => ({ id, name }))
  }, [threads, providers, agent, activeAgentId])

  useEffect(() => {
    const loadData = async () => {
      if (!orgId || !activeAgentId) return

      setLoading(true)
      setError(null)

      const result = await fetchThreads({
        orgId,
        agentId: activeAgentId,
        contextKey: 'org',
      })

      if (result.error) {
        setError(result.error.message)
      }

      setLoading(false)
    }

    loadData()
  }, [orgId, activeAgentId])

  const agentThreads = useMemo(() => {
    if (!threads || !activeAgentId) return []
    let filtered = Object.values(threads).filter(
      (thread) => thread.agentId === activeAgentId
    )

    if (filterProviderId !== 'all') {
      if (filterProviderId === 'primary') {
        filtered = filtered.filter(
          (thread) =>
            !thread.providerId || thread.providerId === agent?.primaryProvider?.id
        )
      } else {
        filtered = filtered.filter((thread) => thread.providerId === filterProviderId)
      }
    }

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
  }, [threads, activeAgentId, searchQuery, filterProviderId, agent])

  const totalThreadsCount = useMemo(() => {
    if (!threads || !activeAgentId) return 0
    return Object.values(threads).filter((thread) => thread.agentId === activeAgentId)
      .length
  }, [threads, activeAgentId])

  const getProviderName = (thread: Thread) => {
    if (thread.providerId && providers) {
      const provider = providers[thread.providerId]
      if (provider) return provider.name
    }
    return agent?.primaryProvider?.name || '-'
  }

  const onCreateThread = () => {
    setCreateDialogOpen(true)
  }

  const onCreateSuccess = async () => {
    if (orgId && activeAgentId) {
      await fetchThreads({ orgId, agentId: activeAgentId, contextKey: 'org' })
    }
    setSuccess('Thread created successfully')
    setTimeout(() => setSuccess(null), 2000)
  }

  const onEditThread = (thread: Thread) => {
    setSelectedThread(thread)
    setEditDialogOpen(true)
  }

  const onEditSuccess = async () => {
    if (orgId && activeAgentId) {
      await fetchThreads({ orgId, agentId: activeAgentId, contextKey: 'org' })
    }
    setSuccess('Thread updated successfully')
    setTimeout(() => setSuccess(null), 2000)
  }

  const onDeleteThread = (thread: Thread) => {
    setSelectedThread(thread)
    setDeleteDialogOpen(true)
  }

  const onDeleteConfirm = async () => {
    if (!selectedThread || !activeAgentId) return

    const result = await deleteThread(orgId, activeAgentId, selectedThread.id, 'org')

    if (result.error) {
      setError(result.error.message)
      setDeleteDialogOpen(false)
    } else {
      setSuccess('Thread deleted successfully')
      setDeleteDialogOpen(false)
      setTimeout(() => setSuccess(null), 2000)
      if (orgId && activeAgentId) {
        await fetchThreads({ orgId, agentId: activeAgentId, contextKey: 'org' })
      }
    }
  }

  const onViewThread = (thread: Thread) => {
    setActiveThreadId(thread.id)
    onViewThreadCB?.(thread.id)
  }

  if (!activeAgentId) {
    return (
      <EmptyState message='No agent selected. Navigate to an agent to view its threads.' />
    )
  }

  return (
    <PageLayout
      title='Threads'
      loading={loading}
      error={error}
      setError={setError}
      searchCount={0}
      query={searchQuery}
      countLabel='thread'
      count={totalThreadsCount}
      setSearchQuery={setSearchQuery}
      onAction={onCreateThread}
      actionLabel='Create Thread'
      searchPlaceholder='Search threads by name or ID...'
    >
      {success && (
        <Alert
          severity='success'
          sx={{ mb: 3 }}
        >
          {success}
        </Alert>
      )}

      {filterProviders.length > 1 && (
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl
            size='small'
            sx={{ minWidth: 200 }}
          >
            <InputLabel id='thread-provider-filter-label'>Filter by Provider</InputLabel>
            <Select
              labelId='thread-provider-filter-label'
              value={filterProviderId}
              label='Filter by Provider'
              onChange={(e) => setFilterProviderId(e.target.value)}
            >
              <MenuItem value='all'>All Providers</MenuItem>
              <MenuItem value='primary'>Primary Provider</MenuItem>
              {filterProviders.map((p) => (
                <MenuItem
                  key={p.id}
                  value={p.id}
                >
                  {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {totalThreadsCount === 0 && !loading && (
        <EmptyState
          actionIcon={<AddIcon />}
          onAction={onCreateThread}
          actionLabel='Create Thread'
          message='No threads found for this agent. Create a thread to start managing AI conversations.'
        />
      )}

      {totalThreadsCount > 0 && agentThreads.length === 0 && (
        <EmptyState message='No threads match your search criteria.' />
      )}

      {agentThreads.length > 0 && (
        <TableContainer>
          <Table size='small'>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>ID</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Public</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align='right'>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agentThreads.map((thread) => (
                <TableRow
                  key={thread.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => onViewThread(thread)}
                >
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant='body2'>
                        {thread.name || 'Untitled Thread'}
                      </Typography>
                      {thread.parentThreadId && (
                        <Chip
                          icon={<BranchIcon sx={{ fontSize: 14 }} />}
                          label='branched'
                          size='small'
                          variant='outlined'
                          color='info'
                          onClick={(e) => {
                            e.stopPropagation()
                            if (thread.parentThreadId) {
                              setActiveThreadId(thread.parentThreadId)
                            }
                          }}
                          title='Click to view parent thread'
                          sx={{ cursor: 'pointer' }}
                        />
                      )}
                    </Box>
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      sx={{ display: 'block', mt: 0.25 }}
                    >
                      {thread.public ? 'Public' : 'Private'}
                      {thread.parentThreadId ? ' · Branched' : ''}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title={thread.id}>
                      <Typography
                        variant='body2'
                        fontFamily='monospace'
                        sx={{ fontSize: '0.75rem', cursor: 'default' }}
                      >
                        {thread.id?.substring(0, 8)}...
                      </Typography>
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant='body2'
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {getProviderName(thread)}
                    </Typography>
                    {thread.providerId &&
                      thread.providerId !== agent?.primaryProvider?.id && (
                        <Typography
                          variant='caption'
                          color='info.main'
                          sx={{ display: 'block', fontSize: '0.65rem' }}
                        >
                          override
                        </Typography>
                      )}
                  </TableCell>
                  <TableCell>
                    <Typography variant='body2'>
                      {thread.public ? 'Yes' : 'No'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant='body2'
                      color='text.secondary'
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {thread.updatedAt
                        ? new Date(thread.updatedAt).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : thread.createdAt
                          ? new Date(thread.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '-'}
                    </Typography>
                  </TableCell>
                  <TableCell align='right'>
                    <IconButton
                      size='small'
                      color='info'
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewThread(thread)
                      }}
                      title='View messages'
                    >
                      <ViewIcon fontSize='small' />
                    </IconButton>
                    <IconButton
                      size='small'
                      color='primary'
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditThread(thread)
                      }}
                      title='Edit thread'
                    >
                      <EditIcon fontSize='small' />
                    </IconButton>
                    <IconButton
                      size='small'
                      color='error'
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteThread(thread)
                      }}
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

      {orgId && activeAgentId && (
        <CreateThreadDrawer
          orgId={orgId}
          agentId={activeAgentId}
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
    </PageLayout>
  )
}
