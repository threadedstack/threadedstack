import type { TCollectionWithCount, Record as RecordModel } from '@tdsk/domain'

import Box from '@mui/material/Box'
import { useState } from 'react'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import { Text, Chip, Collapse } from '@tdsk/components'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { relativeTime } from '@TAF/utils/agentActivity/formatTime'
import { fetchCollectionRecords } from '@TAF/actions/agentActivity/api/fetchCollectionRecords'

export type TAgentCollections = {
  orgId: string
  projectId: string
  /** `undefined` = not fetched yet, `{}` = fetched and there are none. */
  collections?: Record<string, TCollectionWithCount>
  /** Records atom, keyed `${projectId}:${collectionName}`. `undefined` for a key
   * means that collection has not been opened yet. */
  recordsMap?: Record<string, RecordModel[]>
}

type TChipTone = `success` | `warning` | `info` | `error` | `neutral` | `primary`

const mono = `ui-monospace, SFMono-Regular, Menlo, monospace`

/** Longest single scalar value shown before it clamps behind a "more" toggle. */
const MaxInlineChars = 140

const gridSx = {
  display: `grid`,
  gap: 1.5,
  gridTemplateColumns: `repeat(auto-fill, minmax(240px, 1fr))`,
} as const

const clampSx = {
  display: `-webkit-box`,
  WebkitLineClamp: 3,
  WebkitBoxOrient: `vertical`,
  overflow: `hidden`,
} as const

const linkSx = {
  mt: 0.25,
  fontSize: 11.5,
  fontWeight: 600,
  cursor: `pointer`,
  color: `primary.main`,
  display: `inline-block`,
} as const

/** A value the UI can show as one line: primitives, not objects or arrays. */
const isScalar = (v: unknown) =>
  v === null ||
  typeof v === `string` ||
  typeof v === `number` ||
  typeof v === `boolean`

const safeStringify = (v: unknown) => {
  try {
    // JSON.stringify returns the value `undefined` (not a string) for undefined
    // and functions; fall back so callers always get a string to render.
    const json = JSON.stringify(v, null, 2)
    return json === undefined ? String(v) : json
  } catch {
    return String(v)
  }
}

/** Colour a status/state VALUE by common conventions. This maps on the value,
 * not on any collection-specific field name, so it stays generic. */
const statusTone = (status?: string): TChipTone => {
  const s = (status || ``).toLowerCase()
  if ([`active`, `open`, `running`, `in_progress`, `in progress`, `done`].includes(s))
    return `success`
  if ([`blocked`, `error`, `failed`, `cancelled`, `canceled`, `rejected`].includes(s))
    return `error`
  if ([`pending`, `queued`, `waiting`, `todo`, `paused`, `draft`].includes(s))
    return `warning`
  return `neutral`
}

/** One scalar field as a key/value row; long strings clamp behind a toggle. */
const KVRow = (props: { fieldKey: string; value: unknown }) => {
  const { fieldKey, value } = props
  const [open, setOpen] = useState(false)
  const str = value === null ? `null` : String(value)
  const long = str.length > MaxInlineChars

  return (
    <Box sx={{ display: `flex`, gap: 1.5, py: 0.4, alignItems: `baseline` }}>
      <Text
        sx={{
          minWidth: 100,
          maxWidth: 160,
          flexShrink: 0,
          fontSize: 12,
          fontFamily: mono,
          overflow: `hidden`,
          whiteSpace: `nowrap`,
          textOverflow: `ellipsis`,
          color: `text.secondary`,
        }}
      >
        {fieldKey}
      </Text>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Text
          sx={{
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: `pre-wrap`,
            wordBreak: `break-word`,
            ...(long && !open ? clampSx : {}),
          }}
        >
          {str}
        </Text>
        {long && (
          <Text
            onClick={() => setOpen((v) => !v)}
            sx={linkSx}
          >
            {open ? `less` : `more`}
          </Text>
        )}
      </Box>
    </Box>
  )
}

/** One object/array field as a labelled, monospace JSON block. Long blocks clamp
 * behind an expander; short ones render inline. */
const JsonField = (props: { fieldKey: string; value: unknown }) => {
  const { fieldKey, value } = props
  const json = safeStringify(value)
  const long = json.length > 160 || json.split(`\n`).length > 5

  const block = (
    <Box
      component='pre'
      sx={{
        m: 0,
        p: 1,
        fontSize: 12,
        lineHeight: 1.5,
        borderRadius: 1,
        fontFamily: mono,
        whiteSpace: `pre-wrap`,
        wordBreak: `break-word`,
        bgcolor: `action.hover`,
      }}
    >
      {json}
    </Box>
  )

  return (
    <Box sx={{ py: 0.4 }}>
      <Text
        sx={{
          mb: 0.5,
          fontSize: 12,
          fontFamily: mono,
          color: `text.secondary`,
        }}
      >
        {fieldKey}
      </Text>
      {long ? <Collapse collapse>{block}</Collapse> : block}
    </Box>
  )
}

/** The fields tried, in order, for a record's display title. */
const TitleKeys = [`title`, `name`, `subject`, `event`] as const

/**
 * One record, rendered without any collection-specific knowledge: a heuristic
 * title, a relative time, an optional status chip, scalar fields as key/value
 * rows, and object/array fields as collapsible JSON.
 */
const RecordCard = (props: { record: RecordModel }) => {
  const { record } = props
  const data = (record.data || {}) as Record<string, unknown>
  const entries = Object.entries(data)

  const titleKey = TitleKeys.find(
    (k) => isScalar(data[k]) && String(data[k] ?? ``).trim() !== ``
  )
  const title = titleKey ? String(data[titleKey]) : record.id

  const statusKey =
    data.status != null ? `status` : data.state != null ? `state` : undefined
  const status = statusKey ? String(data[statusKey]) : undefined

  const skip = new Set([titleKey, statusKey].filter(Boolean) as string[])
  const scalars = entries.filter(([k, v]) => isScalar(v) && !skip.has(k))
  const complex = entries.filter(([, v]) => !isScalar(v))

  const createdIso =
    record.createdAt instanceof Date ? record.createdAt.toISOString() : record.createdAt
  const created = relativeTime(createdIso)

  return (
    <Box
      sx={{
        p: 1.75,
        minWidth: 0,
        borderRadius: 2,
        border: `1px solid`,
        borderColor: `divider`,
        bgcolor: `background.paper`,
      }}
    >
      <Box sx={{ display: `flex`, alignItems: `baseline`, gap: 1, flexWrap: `wrap` }}>
        <Text
          sx={{
            flex: 1,
            minWidth: 0,
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.3,
            wordBreak: `break-word`,
          }}
        >
          {title}
        </Text>
        {status && (
          <Chip
            size='sm'
            tone={statusTone(status)}
            label={status}
          />
        )}
        {created && (
          <Text sx={{ fontSize: 11.5, flexShrink: 0, color: `text.secondary` }}>
            {created}
          </Text>
        )}
      </Box>

      {(scalars.length > 0 || complex.length > 0) && (
        <Box sx={{ mt: 1, display: `flex`, flexDirection: `column` }}>
          {scalars.map(([k, v]) => (
            <KVRow
              key={k}
              fieldKey={k}
              value={v}
            />
          ))}
          {complex.map(([k, v]) => (
            <JsonField
              key={k}
              fieldKey={k}
              value={v}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}

/** The records of one selected collection, with a Back button to the grid. */
const CollectionRecords = (props: {
  collection: TCollectionWithCount
  records?: RecordModel[]
  onBack: () => void
}) => {
  const { collection, records, onBack } = props
  const total = collection.recordCount ?? records?.length ?? 0
  const capped = Boolean(records && total > records.length)

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1.5, minWidth: 0 }}>
      <Box>
        <Button
          size='small'
          onClick={onBack}
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: `none`, color: `text.secondary` }}
        >
          Collections
        </Button>
      </Box>

      <Box sx={{ display: `flex`, alignItems: `center`, gap: 1, flexWrap: `wrap` }}>
        <Text sx={{ fontSize: 16, fontWeight: 700, fontFamily: mono }}>
          {collection.name}
        </Text>
        <Chip
          size='sm'
          tone='neutral'
          label={`${total} records`}
        />
      </Box>

      {collection.description && (
        <Text sx={{ fontSize: 13, lineHeight: 1.5, color: `text.secondary` }}>
          {collection.description}
        </Text>
      )}

      {capped && (
        <Text sx={{ fontSize: 11.5, color: `text.secondary` }}>
          Showing the first {records?.length} of {total}.
        </Text>
      )}

      {records === undefined ? (
        <Box
          data-testid='collection-records-skeleton'
          sx={{ display: `flex`, flexDirection: `column`, gap: 1.5 }}
        >
          <Skeleton
            variant='rounded'
            height={96}
          />
          <Skeleton
            variant='rounded'
            height={96}
          />
          <Skeleton
            variant='rounded'
            height={96}
          />
        </Box>
      ) : !records.length ? (
        <Box
          sx={{
            py: 8,
            textAlign: `center`,
            borderRadius: 2,
            border: `1px dashed`,
            borderColor: `divider`,
          }}
        >
          <Text sx={{ fontSize: 15, fontWeight: 600 }}>No records</Text>
          <Text sx={{ mt: 0.5, fontSize: 13, color: `text.secondary` }}>
            This collection has no records yet.
          </Text>
        </Box>
      ) : (
        <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1.5, minWidth: 0 }}>
          {records.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}

/**
 * A generic browser over every collection the project owns. It opens on a grid
 * of all collections (name, record count, description); clicking one fetches its
 * records (through an action, from this click handler) and renders them inline
 * with a Back button. Nothing here is tied to a specific collection or field
 * name, so it works for any agent in any project.
 */
export const AgentCollections = (props: TAgentCollections) => {
  const { collections, recordsMap, orgId, projectId } = props
  const [selected, setSelected] = useState<TCollectionWithCount>()

  if (selected)
    return (
      <CollectionRecords
        collection={selected}
        records={recordsMap?.[`${projectId}:${selected.name}`]}
        onBack={() => setSelected(undefined)}
      />
    )

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

  const onSelect = (col: TCollectionWithCount) => {
    setSelected(col)
    void fetchCollectionRecords(orgId, projectId, col.name)
  }

  return (
    <Box sx={gridSx}>
      {list.map((col) => (
        <Box
          key={col.id}
          onClick={() => onSelect(col)}
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
                fontFamily: mono,
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
