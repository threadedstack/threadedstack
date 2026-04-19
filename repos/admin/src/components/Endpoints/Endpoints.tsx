import type { Endpoint } from '@tdsk/domain'

import { useCallback } from 'react'
import { Box } from '@mui/material'
import { ERoutePath } from '@TAF/types'
import { EPermResource } from '@tdsk/domain'
import { Add as AddIcon } from '@mui/icons-material'
import { buildNavRoute } from '@TAF/utils/nav/buildRoute'
import { setActiveEndpointId } from '@TAF/state/accessors'
import { SearchBar } from '@TAF/components/SearchBar/SearchBar'
import { useEndpoints } from '@TAF/hooks/endpoints/useEndpoints'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { HttpMethodOps, EPVisibilityOpts } from '@TAF/constants/values'
import { FilterSelect } from '@TAF/components/FilterSelect/FilterSelect'
import { EndpointsTable } from '@TAF/components/Endpoints/EndpointsTable'
import { EndpointDrawer } from '@TAF/components/Endpoints/EndpointDrawer'

export type TEndpoints = {}

export const Endpoints = (props: TEndpoints) => {
  const {
    orgId,
    count,
    query,
    onDelete,
    setQuery,
    onCreate,
    navigate,
    endpoints,
    projectId,
    onNavigate,
    methodFilter,
    setMethodFilter,
    visibilityFilter,
    createDrawerOpen,
    setCreateDrawerOpen,
    onCreateDrawerClose,
    setVisibilityFilter,
  } = useEndpoints()

  const { canCreate, canUpdate, canDelete } = usePermissions()
  const createDisabled = !canCreate(EPermResource.endpoint)

  const onCreateSuccess = useCallback(
    (endpoint?: Endpoint) => {
      setCreateDrawerOpen(false)
      if (endpoint?.id) {
        setActiveEndpointId(endpoint.id)
        const path = buildNavRoute(
          { orgId, projectId, endpointId: endpoint.id },
          ERoutePath.ProjectEndpoint
        )
        navigate(path)
      }
    },
    [navigate, orgId, projectId]
  )

  return (
    <PageLayout
      title='Endpoints'
      count={count}
      countLabel='endpoint'
      onAction={onCreate}
      actionLabel='Create Endpoint'
      actionDisabled={createDisabled}
    >
      {count > 0 && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <SearchBar
            value={query}
            onChange={setQuery}
            sx={{ flex: 1, minWidth: 200 }}
            placeholder='Search endpoints by name or URL...'
          />
          <FilterSelect
            label='Method'
            id='method-filter'
            value={methodFilter}
            allLabel='All Methods'
            options={HttpMethodOps}
            onChange={setMethodFilter}
          />
          <FilterSelect
            allLabel='All'
            label='Visibility'
            id='visibility-filter'
            value={visibilityFilter}
            options={EPVisibilityOpts}
            onChange={setVisibilityFilter}
          />
        </Box>
      )}

      {count === 0 && (
        <EmptyState
          onAction={onCreate}
          actionIcon={<AddIcon />}
          actionLabel='Create Endpoint'
          actionDisabled={createDisabled}
          message='No endpoints found for this project.'
        />
      )}

      {count > 0 && endpoints.length === 0 && (
        <EmptyState message='No endpoints match your search or filter criteria.' />
      )}

      {endpoints.length > 0 && (
        <EndpointsTable
          onDelete={onDelete}
          endpoints={endpoints}
          onNavigate={onNavigate}
          editDisabled={!canUpdate(EPermResource.endpoint)}
          deleteDisabled={!canDelete(EPermResource.endpoint)}
        />
      )}

      {orgId && projectId && (
        <EndpointDrawer
          orgId={orgId}
          endpoint={null}
          projectId={projectId}
          open={createDrawerOpen}
          onSuccess={onCreateSuccess}
          onClose={onCreateDrawerClose}
        />
      )}
    </PageLayout>
  )
}
