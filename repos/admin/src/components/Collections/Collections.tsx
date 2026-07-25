import type { TCollectionWithCount } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { EPermResource } from '@tdsk/domain'
import { ERoutePath } from '@TAF/types'
import { buildNavRoute } from '@TAF/utils/nav/buildRoute'
import { useProjectCollections } from '@TAF/state/selectors'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { formatRelativeTime } from '@TAF/utils/transforms/time'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { Text, DataTableSkeleton, ConfirmDelete } from '@tdsk/components'
import { CollectionDrawer } from '@TAF/components/Collections/CollectionDrawer'
import { deleteCollection } from '@TAF/actions/collections/api/deleteCollection'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Preview as PreviewIcon,
} from '@mui/icons-material'

export type TCollections = {
  orgId?: string
  projectId?: string
}

const styles = {
  table: {
    actions: {
      box: {
        gap: 1.5,
        display: `flex`,
        alignItems: `center`,
        justifyContent: `end`,
      },
      icon: { fontSize: `16px` },
    },
  },
}

const skeletonColumns = [
  { id: `name`, label: `Name`, width: 200 },
  { id: `description`, label: `Description` },
  { id: `schema`, label: `Schema`, width: 120 },
  { id: `recordCount`, label: `Records`, width: 100 },
  { id: `createdAt`, label: `Created`, width: 150 },
  { id: `actions`, label: `Actions`, align: `right` as const },
]

export const Collections = (props: TCollections) => {
  const { orgId, projectId } = props

  const navigate = useNavigate()
  const [collectionsMap] = useProjectCollections()
  const isInitialLoading = collectionsMap === undefined
  const { canCreate, canUpdate, canDelete } = usePermissions()
  const collections = useMemo(() => Object.values(collectionsMap || {}), [collectionsMap])

  const [error, setError] = useState<Error>()
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<TCollectionWithCount>()
  const [selectedCollection, setSelectedCollection] =
    useState<TCollectionWithCount | null>(null)

  const onCreateCollection = () => {
    setSelectedCollection(null)
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
    setSelectedCollection(null)
  }

  const onEditCollection = (collection: TCollectionWithCount) => {
    setSelectedCollection(collection)
    setDialogOpen(true)
  }

  const onViewRecords = (collection: TCollectionWithCount) => {
    navigate(
      buildNavRoute(
        { orgId, projectId, name: collection.name },
        ERoutePath.ProjectCollectionDetail
      )
    )
  }

  const onRemove = async () => {
    if (!deleting || !orgId || !projectId) return

    setLoading(true)
    setError(undefined)

    const result = await deleteCollection(orgId, projectId, deleting.name, deleting.id)

    if (result.error) {
      setError(
        result.error instanceof Error ? result.error : new Error(String(result.error))
      )
    }

    setLoading(false)
    setDeleting(undefined)
    dialogOpen && setDialogOpen(false)
  }

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
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (collection) => (
        <Box sx={styles.table.actions.box}>
          <ActionIconButton
            tooltip='View Records'
            icon={<PreviewIcon sx={styles.table.actions.icon} />}
            size='small'
            color='primary'
            onClick={(e) => {
              e.stopPropagation()
              onViewRecords(collection)
            }}
          />
          <ActionIconButton
            tooltip='Edit Collection'
            icon={<EditIcon sx={styles.table.actions.icon} />}
            size='small'
            color='primary'
            disabled={!canUpdate(EPermResource.collection)}
            disabledTooltip='You do not have permission to edit collections'
            onClick={(e) => {
              e.stopPropagation()
              onEditCollection(collection)
            }}
          />
          <ActionIconButton
            tooltip='Delete Collection'
            icon={<DeleteIcon sx={styles.table.actions.icon} />}
            size='small'
            color='error'
            disabled={!canDelete(EPermResource.collection)}
            disabledTooltip='You do not have permission to delete collections'
            onClick={(e) => {
              e.stopPropagation()
              setDeleting(collection)
            }}
          />
        </Box>
      ),
    },
  ]

  return (
    <PageLayout
      title='Collections'
      loading={loading}
      searchCount={0}
      countLabel='collection'
      query={searchQuery}
      error={error?.message}
      actionIcon={<AddIcon />}
      setSearchQuery={setSearchQuery}
      onAction={collections.length > 0 && onCreateCollection}
      actionLabel={collections.length > 0 && 'Create Collection'}
      actionDisabled={!canCreate(EPermResource.collection)}
      count={isInitialLoading ? undefined : collections.length}
      searchPlaceholder='Search collections by name or description...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : undefined)}
    >
      {isInitialLoading && <DataTableSkeleton columns={skeletonColumns} />}

      {!isInitialLoading && !error && collections.length === 0 && !loading && (
        <EmptyState
          actionIcon={<AddIcon />}
          onAction={onCreateCollection}
          actionLabel='Create Collection'
          actionDisabled={!canCreate(EPermResource.collection)}
          message='No collections yet. Create your first collection to get started.'
        />
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
          onRowClick={onEditCollection}
          getRowKey={(collection) => collection.id}
        />
      )}

      {orgId && projectId && (
        <CollectionDrawer
          orgId={orgId}
          open={dialogOpen}
          projectId={projectId}
          onRemove={setDeleting}
          onClose={onDialogClose}
          collection={selectedCollection}
        />
      )}

      {deleting && (
        <ConfirmDelete
          deleting={loading}
          onConfirm={onRemove}
          itemName={deleting?.name || `Collection`}
          onCancel={() => setDeleting(undefined)}
        />
      )}
    </PageLayout>
  )
}

export default Collections
