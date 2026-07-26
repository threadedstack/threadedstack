import type { TCollectionWithCount } from '@tdsk/domain'

import Box from '@mui/material/Box'
import { Storage } from '@mui/icons-material'
import { useState, useEffect } from 'react'
import Typography from '@mui/material/Typography'
import { MonoFont } from '@TTH/constants/values'
import { collectionApi } from '@TTH/services/collectionApi'
import { EmptyState } from '@TTH/components/EmptyState/EmptyState'
import { RowList, SectionHeader } from '@TTH/components/PagePrimitives'

const CollectionColumns = [
  { label: `Name`, width: `1fr` },
  { label: `Records`, width: `100px` },
]

export type TProjectCollectionsSection = {
  orgId: string
  projectId: string
}

export const ProjectCollectionsSection = (props: TProjectCollectionsSection) => {
  const { orgId, projectId } = props
  const [collections, setCollections] = useState<TCollectionWithCount[]>([])

  useEffect(() => {
    let cancelled = false

    collectionApi.list(orgId, projectId).then((resp) => {
      if (!cancelled) setCollections(resp.data || [])
    })

    return () => {
      cancelled = true
    }
  }, [orgId, projectId])

  return (
    <>
      <SectionHeader
        title='Collections'
        count={collections.length}
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
            </RowList.Row>
          ))}
        </RowList>
      )}
    </>
  )
}
