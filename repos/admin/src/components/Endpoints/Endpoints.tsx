import type { Endpoint } from '@tdsk/domain'

import { useEffect, useState, useMemo } from 'react'
import { Box } from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'
import { useEndpoints } from '@TAF/state/selectors'
import { fetchEndpoints, deleteEndpoint } from '@TAF/actions/endpoints'
import { setActiveOrgId, setActiveprojectId } from '@TAF/state/accessors'
import {
  SearchBar,
  FilterSelect,
  PageHeader,
  EmptyState,
  LoadingSpinner,
} from '@TAF/components'
import { EndpointsTable } from './EndpointsTable'
import { EndpointDialog } from './EndpointDialog'

export type TEndpoints = {
  projectId: string
  orgId?: string
}

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

export const Endpoints = ({ projectId, orgId }: TEndpoints) => {
  const [endpoints] = useEndpoints()
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
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
    if (projectId) {
      await fetchEndpoints({ projectId })
    }
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
          endpoints={filteredEndpoints}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}

      {projectId && (
        <EndpointDialog
          open={dialogOpen}
          projectId={projectId}
          onClose={onDialogClose}
          endpoint={selectedEndpoint}
          onSuccess={onDialogSuccess}
        />
      )}
    </>
  )
}
