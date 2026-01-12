import type { Endpoint } from '@tdsk/domain'

import { useParams } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { useEndpoints } from '@TAF/state/selectors'
import { useEffect, useState, useMemo } from 'react'
import { EditEndpointDialog } from './EditEndpointDialog'
import { CreateEndpointDialog } from './CreateEndpointDialog'
import { fetchEndpoints, deleteEndpoint } from '@TAF/actions/endpoints'
import { setActiveOrgId, setActiveprojectId } from '@TAF/state/accessors'
import {
  SearchBar,
  FilterSelect,
  PageHeader,
  EmptyState,
  LoadingSpinner,
} from '@TAF/components'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Lock as PrivateIcon,
  Delete as DeleteIcon,
  Public as PublicIcon,
} from '@mui/icons-material'
import {
  Box,
  Chip,
  Card,
  Table,
  Tooltip,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
  IconButton,
  TableContainer,
} from '@mui/material'

export type TProjectEndpoints = {}

// TODO: move to domain repo
const METHOD_FILTER_OPTIONS = [
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'PATCH', label: 'PATCH' },
  { value: 'DELETE', label: 'DELETE' },
]
// TODO: move to domain repo
const VISIBILITY_FILTER_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Private' },
]

export const ProjectEndpoints = (props: TProjectEndpoints) => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>()
  const [endpoints] = useEndpoints()
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all')

  useEffect(() => {
    if (orgId) setActiveOrgId(orgId)
    if (projectId) setActiveprojectId(projectId)
  }, [orgId, projectId])

  useEffect(() => {
    const loadData = async () => {
      if (!projectId) return
      setLoading(true)
      await fetchEndpoints({ projectId })
      setLoading(false)
    }
    loadData()
  }, [projectId])

  const filteredEndpoints = useMemo(() => {
    if (!endpoints || !projectId) return []

    let filtered = Object.values(endpoints).filter(
      (endpoint) => endpoint.projectId === projectId
    )

    // Apply method filter
    if (methodFilter !== 'all') {
      filtered = filtered.filter((endpoint) => endpoint.method === methodFilter)
    }

    // Apply visibility filter
    if (visibilityFilter !== 'all') {
      const isPublic = visibilityFilter === 'public'
      filtered = filtered.filter((endpoint) => endpoint.public === isPublic)
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (endpoint) =>
          endpoint.name?.toLowerCase().includes(query) ||
          endpoint.url?.toLowerCase().includes(query) ||
          endpoint.id?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [endpoints, projectId, searchQuery, methodFilter, visibilityFilter])

  const endpointsCount = endpoints
    ? Object.values(endpoints).filter((e) => e.projectId === projectId).length
    : 0

  const onDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete endpoint "${name}"?`)) {
      return
    }
    const result = await deleteEndpoint(id)
    if (result.error) {
      alert(`Failed to delete endpoint: ${result.error.message}`)
    }
  }

  const onCreate = () => {
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
  }

  const onDialogSuccess = async () => {
    if (projectId) {
      await fetchEndpoints({ projectId })
    }
  }

  const onEdit = (endpoint: Endpoint) => {
    setSelectedEndpoint(endpoint)
    setEditDialogOpen(true)
  }

  const onEditDialogClose = () => {
    setEditDialogOpen(false)
    setSelectedEndpoint(null)
  }

  const onEditDialogSuccess = async () => {
    if (projectId) {
      await fetchEndpoints({ projectId })
    }
  }

  return (
    <Page className='tdsk-project-endpoints-page'>
      <PageHeader
        title='Endpoints'
        onAction={onCreate}
        countLabel='endpoint'
        count={endpointsCount}
        actionIcon={<AddIcon />}
        actionLabel='Create Endpoint'
      />

      {!loading && endpointsCount > 0 && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            sx={{ flex: 1, minWidth: 200 }}
            placeholder='Search endpoints by name or URL...'
          />
          <FilterSelect
            id='method-filter'
            label='Method'
            value={methodFilter}
            allLabel='All Methods'
            onChange={setMethodFilter}
            options={METHOD_FILTER_OPTIONS}
          />
          <FilterSelect
            allLabel='All'
            label='Visibility'
            id='visibility-filter'
            value={visibilityFilter}
            onChange={setVisibilityFilter}
            options={VISIBILITY_FILTER_OPTIONS}
          />
        </Box>
      )}

      {loading && <LoadingSpinner />}

      {!loading && endpointsCount === 0 && (
        <EmptyState
          onAction={onCreate}
          actionIcon={<AddIcon />}
          message='No endpoints found for this project.'
          actionLabel='Create Your First Endpoint'
        />
      )}

      {!loading && endpointsCount > 0 && filteredEndpoints.length === 0 && (
        <EmptyState message='No endpoints match your search or filter criteria.' />
      )}

      {!loading && filteredEndpoints.length > 0 && (
        <TableContainer component={Card}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Proxy URL</TableCell>
                <TableCell align='center'>Public</TableCell>
                <TableCell align='right'>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredEndpoints.map((endpoint) => (
                <TableRow
                  key={endpoint.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => onEdit(endpoint)}
                >
                  <TableCell>{endpoint.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={endpoint.method}
                      size='small'
                      color='primary'
                      variant='outlined'
                    />
                  </TableCell>
                  <TableCell
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      wordBreak: 'break-all',
                    }}
                  >
                    {endpoint.url}
                  </TableCell>
                  <TableCell align='center'>
                    {endpoint.public ? (
                      <Tooltip title='Public endpoint'>
                        <PublicIcon color='success' />
                      </Tooltip>
                    ) : (
                      <Tooltip title='Private endpoint'>
                        <PrivateIcon color='action' />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align='right'>
                    <Tooltip title='Edit endpoint'>
                      <IconButton
                        size='small'
                        onClick={(e) => {
                          e.stopPropagation()
                          onEdit(endpoint)
                        }}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title='Delete endpoint'>
                      <IconButton
                        size='small'
                        color='error'
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(endpoint.id, endpoint.name)
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {projectId && (
        <CreateEndpointDialog
          open={dialogOpen}
          projectId={projectId}
          onClose={onDialogClose}
          onSuccess={onDialogSuccess}
        />
      )}

      <EditEndpointDialog
        open={editDialogOpen}
        endpoint={selectedEndpoint}
        onClose={onEditDialogClose}
        onSuccess={onEditDialogSuccess}
      />
    </Page>
  )
}

export default ProjectEndpoints
