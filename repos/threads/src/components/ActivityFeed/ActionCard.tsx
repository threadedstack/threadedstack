import type { TFeedEvent } from '@TTH/types/ast.types'

import { useState } from 'react'
import { Box, Collapse, Typography } from '@mui/material'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import { renderDocument } from '@TTH/visitors'

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
        display: `flex`,
        flexDirection: `column`,
        gap: 0.5,
        py: 0.75,
        px: 1,
        borderRadius: 1,
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
            fontFamily: `monospace`,
            color: `text.secondary`,
            overflow: `hidden`,
            textOverflow: `ellipsis`,
            whiteSpace: `nowrap`,
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
