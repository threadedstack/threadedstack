import { Box } from '@mui/material'
import { EPermResource } from '@tdsk/domain'
import { DataTableSkeleton } from '@tdsk/components'
import { Add as AddIcon } from '@mui/icons-material'
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

const skeletonColumns = [
  { id: `name`, label: `Name` },
  { id: `method`, label: `Method` },
  { id: `type`, label: `Type` },
  { id: `path`, label: `Path` },
  { id: `public`, label: `Public`, align: `center` as const },
  { id: `actions`, label: `Actions`, align: `right` as const },
]

export const Endpoints = (props: TEndpoints) => {
  const {
    orgId,
    count,
    query,
    onDelete,
    setQuery,
    onCreate,
    endpoints,
    projectId,
    onNavigate,
    methodFilter,
    rawEndpoints,
    setMethodFilter,
    onCreateSuccess,
    visibilityFilter,
    createDrawerOpen,
    onCreateDrawerClose,
    setVisibilityFilter,
  } = useEndpoints()
  const isInitialLoading = rawEndpoints === undefined

  const { canCreate, canUpdate, canDelete } = usePermissions()
  const createDisabled = !canCreate(EPermResource.endpoint)

  return (
    <PageLayout
      title='Endpoints'
      countLabel='endpoint'
      onAction={onCreate}
      actionLabel='Create Endpoint'
      actionDisabled={createDisabled}
      count={isInitialLoading ? undefined : count}
    >
      {isInitialLoading && <DataTableSkeleton columns={skeletonColumns} />}

      {!isInitialLoading && count > 0 && (
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

      {!isInitialLoading && count === 0 && (
        <EmptyState
          onAction={onCreate}
          actionIcon={<AddIcon />}
          actionLabel='Create Endpoint'
          actionDisabled={createDisabled}
          message='No endpoints found for this project.'
        />
      )}

      {!isInitialLoading && count > 0 && endpoints.length === 0 && (
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
