import type { TFeedEvent } from '@TTH/types'

import { useState } from 'react'
import { Box, Collapse, Typography } from '@mui/material'
import { renderDocument } from '@TTH/services/gui/visitors'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'

type TActionEvent = Extract<TFeedEvent, { kind: 'action' }>

export type TActionCardProps = {
  event: TActionEvent
}

const STATUS_COLORS: Record<TActionEvent['status'], string> = {
  running: `#a855f7`,
  done: `#22c55e`,
  error: `#ef4444`,
}

export const ActionCard = (props: TActionCardProps) => {
  const { event } = props
  const [expanded, setExpanded] = useState(false)
  const hasDetail = Boolean(event.detail)
  const color = STATUS_COLORS[event.status]

  return (
    <Box
      sx={{
        px: 1,
        gap: 0.5,
        py: 0.75,
        display: `flex`,
        borderRadius: 1,
        flexDirection: `column`,
        cursor: hasDetail ? `pointer` : `default`,
        '&:hover': hasDetail ? { backgroundColor: `action.hover` } : {},
      }}
      onClick={() => hasDetail && setExpanded((prev) => !prev)}
    >
      <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
        <FiberManualRecordIcon sx={{ fontSize: 10, color, flexShrink: 0 }} />
        <Typography
          variant='body2'
          sx={{ textTransform: `capitalize`, fontWeight: 500 }}
        >
          {event.action}
        </Typography>
        <Typography
          variant='body2'
          sx={{
            overflow: `hidden`,
            whiteSpace: `nowrap`,
            fontFamily: `monospace`,
            color: `text.secondary`,
            textOverflow: `ellipsis`,
          }}
        >
          {event.target}
        </Typography>
      </Box>

      {hasDetail && event.detail && (
        <Collapse in={expanded}>
          <Box
            sx={{
              mt: 0.5,
              pl: 2.5,
              borderLeft: `2px solid`,
              borderColor: `divider`,
            }}
          >
            {renderDocument(event.detail)}
          </Box>
        </Collapse>
      )}
    </Box>
  )
}
