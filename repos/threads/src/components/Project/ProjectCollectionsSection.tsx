import type { TCollectionWithCount } from '@tdsk/domain'

import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import { Storage, Add, Edit, Delete } from '@mui/icons-material'
import { useState, useEffect, useCallback } from 'react'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import { MonoFont } from '@TTH/constants/values'
import { collectionApi } from '@TTH/services/collectionApi'
import { EmptyState } from '@TTH/components/EmptyState/EmptyState'
import { RowList, SectionHeader } from '@TTH/components/PagePrimitives'
import { CollectionFormDialog } from '@TTH/components/Project/CollectionFormDialog'
import { CollectionDeleteDialog } from '@TTH/components/Project/CollectionDeleteDialog'

const CollectionColumns = [
  { label: `Name`, width: `1fr` },
  { label: `Records`, width: `100px` },
  { label: ``, width: `72px` },
]

export type TProjectCollectionsSection = {
  orgId: string
  projectId: string
}

export const ProjectCollectionsSection = (props: TProjectCollectionsSection) => {
  const { orgId, projectId } = props
  const [collections, setCollections] = useState<TCollectionWithCount[]>([])
  const [formTarget, setFormTarget] = useState<TCollectionWithCount | `new` | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TCollectionWithCount | null>(null)

  useEffect(() => {
    let cancelled = false

    collectionApi.list(orgId, projectId).then((resp) => {
      if (!cancelled) setCollections(resp.data || [])
    })

    return () => {
      cancelled = true
    }
  }, [orgId, projectId])

  const onSaved = useCallback((collection: TCollectionWithCount) => {
    setCollections((prev) => {
      const idx = prev.findIndex((c) => c.id === collection.id)
      if (idx === -1) return [...prev, collection]

      const next = [...prev]
      next[idx] = collection
      return next
    })
    setFormTarget(null)
  }, [])

  const onConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return

    const resp = await collectionApi.delete(orgId, projectId, deleteTarget.name)
    if (resp.error) {
      toast.error(`Failed to delete collection`, { description: resp.error.message })
      return
    }

    setCollections((prev) => prev.filter((c) => c.id !== deleteTarget.id))
    setDeleteTarget(null)
  }, [deleteTarget, orgId, projectId])

  return (
    <>
      <SectionHeader
        title='Collections'
        count={collections.length}
        actions={
          <Button
            size='small'
            variant='outlined'
            startIcon={<Add />}
            onClick={() => setFormTarget(`new`)}
          >
            Add Collection
          </Button>
        }
      />

      {collections.length === 0 ? (
        <EmptyState
          icon={<Storage />}
          title='No collections in this project'
        />
      ) : (
        <RowList columns={CollectionColumns}>
          {collections.map((collection, idx) => (
            <RowList.Row
              key={collection.id}
              isLast={idx === collections.length - 1}
            >
              {/* Name */}
              <Box sx={{ display: `flex`, alignItems: `center`, gap: `10px` }}>
                <Storage sx={{ fontSize: 18, color: `text.secondary` }} />
                <Typography
                  noWrap
                  sx={{
                    fontSize: `13px`,
                    fontWeight: 600,
                    fontFamily: MonoFont,
                  }}
                >
                  {collection.name}
                </Typography>
              </Box>

              {/* Records */}
              <Box sx={{ display: `flex`, alignItems: `center` }}>
                <Typography sx={{ fontSize: `13px`, fontWeight: 500 }}>
                  {collection.recordCount}
                </Typography>
              </Box>

              {/* Actions */}
              <Box sx={{ display: `flex`, alignItems: `center`, gap: `4px` }}>
                <IconButton
                  size='small'
                  title='Edit'
                  onClick={() => setFormTarget(collection)}
                >
                  <Edit sx={{ fontSize: 16 }} />
                </IconButton>
                <IconButton
                  size='small'
                  title='Delete'
                  onClick={() => setDeleteTarget(collection)}
                >
                  <Delete sx={{ fontSize: 16, color: `error.main` }} />
                </IconButton>
              </Box>
            </RowList.Row>
          ))}
        </RowList>
      )}

      <CollectionFormDialog
        orgId={orgId}
        projectId={projectId}
        open={formTarget !== null}
        collection={formTarget === `new` ? null : formTarget}
        onClose={() => setFormTarget(null)}
        onSaved={onSaved}
      />

      <CollectionDeleteDialog
        collection={deleteTarget}
        onConfirm={onConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  )
}
