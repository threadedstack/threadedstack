import type { TCollectionWithCount } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { useState, useMemo } from 'react'
import Chip from '@mui/material/Chip'
import { useProjectCollections } from '@TAF/state/selectors'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { formatRelativeTime } from '@TAF/utils/transforms/time'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { Text, DataTableSkeleton } from '@tdsk/components'

const skeletonColumns = [
  { id: `name`, label: `Name`, width: 200 },
  { id: `description`, label: `Description` },
  { id: `schema`, label: `Schema`, width: 120 },
  { id: `recordCount`, label: `Records`, width: 100 },
  { id: `createdAt`, label: `Created`, width: 150 },
]

export const Collections = () => {
  const [collectionsMap] = useProjectCollections()
  const isInitialLoading = collectionsMap === undefined
  const collections = useMemo(() => Object.values(collectionsMap || {}), [collectionsMap])

  const [error, setError] = useState<Error>()
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCollections = useMemo(() => {
    if (!searchQuery.trim()) return collections

    const query = searchQuery.toLowerCase()
    return collections.filter(
      (collection) =>
        collection.name?.toLowerCase().includes(query) ||
        collection.description?.toLowerCase().includes(query)
    )
  }, [collections, searchQuery])

  const columns: TDataTableColumn<TCollectionWithCount>[] = [
    {
      id: 'name',
      label: 'Name',
      width: 200,
      render: (collection) => (
        <Text
          variant='body2'
          fontWeight='medium'
          sx={{ fontFamily: 'monospace' }}
        >
          {collection.name}
        </Text>
      ),
    },
    {
      id: 'description',
      label: 'Description',
      render: (collection) => (
        <Text
          variant='body2'
          color='text.secondary'
        >
          {collection.description || '—'}
        </Text>
      ),
    },
    {
      id: 'schema',
      label: 'Schema',
      width: 120,
      render: (collection) => (
        <Chip
          size='small'
          variant='outlined'
          color={collection.schema ? 'info' : 'default'}
          label={collection.schema ? `${collection.schema.length} fields` : 'Schemaless'}
        />
      ),
    },
    {
      id: 'recordCount',
      label: 'Records',
      width: 100,
      render: (collection) => <Text variant='body2'>{collection.recordCount}</Text>,
    },
    {
      id: 'createdAt',
      label: 'Created',
      width: 150,
      render: (collection) => (
        <Text
          variant='body2'
          color='text.secondary'
        >
          {formatRelativeTime(collection.createdAt)}
        </Text>
      ),
    },
  ]

  return (
    <PageLayout
      title='Collections'
      searchCount={0}
      countLabel='collection'
      query={searchQuery}
      error={error?.message}
      setSearchQuery={setSearchQuery}
      count={isInitialLoading ? undefined : collections.length}
      searchPlaceholder='Search collections by name or description...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : undefined)}
    >
      {isInitialLoading && <DataTableSkeleton columns={skeletonColumns} />}

      {!isInitialLoading && !error && collections.length === 0 && (
        <EmptyState message='No collections yet. Collections are created by agents and Functions through the Collections/Records API.' />
      )}

      {!isInitialLoading &&
        !error &&
        collections.length > 0 &&
        filteredCollections.length === 0 && (
          <EmptyState message='No collections match your search query.' />
        )}

      {!error && filteredCollections.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredCollections}
          getRowKey={(collection) => collection.id}
        />
      )}
    </PageLayout>
  )
}

export default Collections
