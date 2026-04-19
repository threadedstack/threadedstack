import { useMemo } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import type { TDocument, TFeedEvent } from '@TTH/ast'
import { ViewToggle } from '@TTH/components/ViewToggle/ViewToggle'
import type { TViewMode } from '@TTH/components/ViewToggle/ViewToggle'

export type TSessionHeaderProps = {
  runtime: string
  project?: string
  doc: TDocument | undefined
  feedEvents: TFeedEvent[]
  viewMode: TViewMode
  onViewChange: (mode: TViewMode) => void
}

type TEventCounters = {
  reads: number
  edits: number
  pending: number
}

const deriveCounters = (events: TFeedEvent[]): TEventCounters => {
  let reads = 0
  let edits = 0
  let pending = 0

  for (const event of events) {
    if (event.kind === `action`) {
      const action = event.action.toLowerCase()
      if (action.includes(`read`) || action.includes(`view`) || action.includes(`list`))
        reads++
      else if (
        action.includes(`edit`) ||
        action.includes(`write`) ||
        action.includes(`create`) ||
        action.includes(`delete`)
      )
        edits++
    } else if (event.kind === `prompt` && event.status === `waiting`) {
      pending++
    }
  }

  return { reads, edits, pending }
}

export const SessionHeader = (props: TSessionHeaderProps) => {
  const { runtime, project, doc, feedEvents, viewMode, onViewChange } = props
  const counters = useMemo(() => deriveCounters(feedEvents), [feedEvents])
  const mode = doc?.mode

  return (
    <Box
      sx={{
        display: `flex`,
        alignItems: `center`,
        gap: 1.5,
        px: 2,
        py: 0.75,
        borderBottom: 1,
        borderColor: `divider`,
        flexShrink: 0,
      }}
    >
      <Box
        sx={{ display: `flex`, alignItems: `center`, gap: 0.75, flex: 1, minWidth: 0 }}
      >
        <Typography
          variant='body2'
          sx={{ fontWeight: 600, whiteSpace: `nowrap` }}
        >
          {runtime}
        </Typography>

        {project && (
          <>
            <Typography
              variant='body2'
              sx={{ color: `text.disabled` }}
            >
              /
            </Typography>
            <Typography
              variant='body2'
              sx={{
                color: `text.secondary`,
                overflow: `hidden`,
                textOverflow: `ellipsis`,
                whiteSpace: `nowrap`,
              }}
            >
              {project}
            </Typography>
          </>
        )}

        {mode && (
          <Chip
            label={mode}
            size='small'
            variant='outlined'
            sx={{ height: 18, fontSize: `0.65rem`, ml: 0.5 }}
          />
        )}
      </Box>

      <Box sx={{ display: `flex`, alignItems: `center`, gap: 1, flexShrink: 0 }}>
        {counters.reads > 0 && (
          <Typography
            variant='caption'
            sx={{ color: `text.disabled` }}
          >
            {counters.reads}R
          </Typography>
        )}
        {counters.edits > 0 && (
          <Typography
            variant='caption'
            sx={{ color: `text.secondary` }}
          >
            {counters.edits}E
          </Typography>
        )}
        {counters.pending > 0 && (
          <Chip
            label={`${counters.pending} pending`}
            size='small'
            color='warning'
            sx={{ height: 18, fontSize: `0.65rem` }}
          />
        )}
      </Box>

      <ViewToggle
        value={viewMode}
        onChange={onViewChange}
      />
    </Box>
  )
}
