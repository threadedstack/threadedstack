import type { Endpoint } from '@tdsk/domain'

import { Box } from '@mui/material'
import { ife } from '@keg-hub/jsutils/ife'
import { useEndpoints } from '@TAF/state/selectors'
import { Add as AddIcon } from '@mui/icons-material'
import { useEffect, useState, useMemo } from 'react'
import { useActiveProjectId } from '@TAF/state/selectors'
import { SearchBar } from '@TAF/components/SearchBar/SearchBar'
import { PageHeader } from '@TAF/components/PageHeader/PageHeader'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { fetchEndpoints } from '@TAF/actions/endpoints/fetchEndpoints'
import { deleteEndpoint } from '@TAF/actions/endpoints/deleteEndpoint'
import { FilterSelect } from '@TAF/components/FilterSelect/FilterSelect'
import { EndpointsTable } from '@TAF/components/Endpoints/EndpointsTable'
import { EndpointDrawer } from '@TAF/components/Endpoints/EndpointDrawer'
import { LoadingSpinner } from '@TAF/components/LoadingSpinner/LoadingSpinner'

export type TEndpoints = {}

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

export const Endpoints = (props: TEndpoints) => {
  const [endpoints] = useEndpoints()
  const [projectId] = useActiveProjectId()
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  // TODO: figure out where to render deleteError
  const [deleteError, setDeleteError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [methodFilter, setMethodFilter] = useState<string>('all')
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all')
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint | null>(null)

  useEffect(() => {
    projectId &&
      ife(async () => {
        try {
          setLoading(true)
          await fetchEndpoints({ projectId })
        } finally {
          setLoading(false)
        }
      })
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

  const onDelete = async (id: string) => {
    const result = await deleteEndpoint(id)
    result.error && setDeleteError(`Failed to delete endpoint: ${result.error.message}`)
  }

  const onCreate = () => {
    setSelectedEndpoint(null)
    setDialogOpen(true)
  }

  const onEdit = (endpoint: Endpoint) => {
    setSelectedEndpoint(endpoint)
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
    setSelectedEndpoint(null)
  }

  const onDialogSuccess = async () => {
    projectId && (await fetchEndpoints({ projectId }))
  }

  return (
    <>
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
        <EndpointsTable
          onEdit={onEdit}
          onDelete={onDelete}
          endpoints={filteredEndpoints}
        />
      )}

      {(projectId && (
        <EndpointDrawer
          open={dialogOpen}
          projectId={projectId}
          onClose={onDialogClose}
          endpoint={selectedEndpoint}
          onSuccess={onDialogSuccess}
        />
      )) ||
        null}
    </>
  )
}
