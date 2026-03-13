import { Box } from '@mui/material'
import { Add as AddIcon } from '@mui/icons-material'
import { SearchBar } from '@TAF/components/SearchBar/SearchBar'
import { useEndpoints } from '@TAF/hooks/endpoints/useEndpoints'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
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
    onEdit,
    loading,
    onDelete,
    endpoint,
    setQuery,
    onCreate,
    endpoints,
    projectId,
    dialogOpen,
    methodFilter,
    onDialogClose,
    setMethodFilter,
    visibilityFilter,
    setVisibilityFilter,
  } = useEndpoints()

  return (
    <PageLayout
      title='Endpoints'
      count={count}
      loading={loading}
      countLabel='endpoint'
      onAction={onCreate}
      actionLabel='Create Endpoint'
    >
      {!loading && count > 0 && (
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

      {!loading && count === 0 && (
        <EmptyState
          onAction={onCreate}
          actionIcon={<AddIcon />}
          actionLabel='Create Endpoint'
          message='No endpoints found for this project.'
        />
      )}

      {!loading && count > 0 && endpoints.length === 0 && (
        <EmptyState message='No endpoints match your search or filter criteria.' />
      )}

      {!loading && endpoints.length > 0 && (
        <EndpointsTable
          onEdit={onEdit}
          onDelete={onDelete}
          endpoints={endpoints}
        />
      )}

      {orgId && projectId && (
        <EndpointDrawer
          orgId={orgId}
          open={dialogOpen}
          endpoint={endpoint}
          projectId={projectId}
          onClose={onDialogClose}
        />
      )}
    </PageLayout>
  )
}
