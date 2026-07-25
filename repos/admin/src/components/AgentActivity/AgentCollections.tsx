import type { TCollectionWithCount } from '@tdsk/domain'

import Box from '@mui/material/Box'
import { nav } from '@TAF/services/nav'
import Skeleton from '@mui/material/Skeleton'
import { Text, Chip } from '@tdsk/components'

export type TAgentCollections = {
  orgId: string
  projectId: string
  /** `undefined` = not fetched yet, `{}` = fetched and there are none. */
  collections?: Record<string, TCollectionWithCount>
}

const gridSx = {
  display: `grid`,
  gap: 1.5,
  gridTemplateColumns: `repeat(auto-fill, minmax(240px, 1fr))`,
} as const

/**
 * The collections the agent operates on: the project's data domains with their
 * record counts. Each card links into the collections browser so the raw
 * records the agent reads and writes are one click away.
 */
export const AgentCollections = (props: TAgentCollections) => {
  const { collections, orgId, projectId } = props

  if (collections === undefined)
    return (
      <Box
        data-testid='agent-collections-skeleton'
        sx={gridSx}
      >
        {[0, 1, 2, 3].map((i) => (
          <Skeleton
            key={i}
            variant='rounded'
            height={104}
          />
        ))}
      </Box>
    )

  const list = Object.values(collections).sort(
    (a, b) => (b.recordCount ?? 0) - (a.recordCount ?? 0)
  )

  if (!list.length)
    return (
      <Box
        sx={{
          py: 8,
          textAlign: `center`,
          borderRadius: 2,
          border: `1px dashed`,
          borderColor: `divider`,
        }}
      >
        <Text sx={{ fontSize: 15, fontWeight: 600 }}>No collections</Text>
        <Text sx={{ mt: 0.5, fontSize: 13, color: `text.secondary` }}>
          This project has no data collections yet.
        </Text>
      </Box>
    )

  const browse = () => nav.to(`/orgs/${orgId}/projects/${projectId}/collections`)

  return (
    <Box sx={gridSx}>
      {list.map((col) => (
        <Box
          key={col.id}
          onClick={browse}
          sx={{
            p: 1.75,
            height: `100%`,
            display: `flex`,
            cursor: `pointer`,
            borderRadius: 2,
            border: `1px solid`,
            borderColor: `divider`,
            flexDirection: `column`,
            bgcolor: `background.paper`,
            transition: `border-color 150ms`,
            '&:hover': { borderColor: `primary.main` },
          }}
        >
          <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
            <Text
              sx={{
                flex: 1,
                minWidth: 0,
                fontWeight: 700,
                fontSize: 13.5,
                overflow: `hidden`,
                whiteSpace: `nowrap`,
                textOverflow: `ellipsis`,
                fontFamily: `ui-monospace, SFMono-Regular, Menlo, monospace`,
              }}
            >
              {col.name}
            </Text>
            <Chip
              size='sm'
              tone='neutral'
              label={`${col.recordCount ?? 0}`}
            />
          </Box>
          {col.description && (
            <Text
              sx={{
                mt: 0.75,
                fontSize: 12,
                lineHeight: 1.5,
                color: `text.secondary`,
                display: `-webkit-box`,
                WebkitLineClamp: 3,
                WebkitBoxOrient: `vertical`,
                overflow: `hidden`,
              }}
            >
              {col.description}
            </Text>
          )}
        </Box>
      ))}
    </Box>
  )
}
