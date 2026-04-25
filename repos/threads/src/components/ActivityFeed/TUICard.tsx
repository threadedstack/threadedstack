import type { TFeedEvent } from '@TTH/types'

import { Box, Typography } from '@mui/material'
import { renderDocument } from '@TTH/services/gui/visitors'

type TTUIEvent = Extract<TFeedEvent, { kind: 'tui' }>

export type TTUICardProps = {
  event: TTUIEvent
}

export const TUICard = (props: TTUICardProps) => {
  const { event } = props

  if (event.status === `exited`) {
    return (
      <Box sx={{ py: 0.75, px: 1 }}>
        <Typography
          variant='body2'
          sx={{ fontStyle: `italic`, color: `text.disabled` }}
        >
          TUI session ended
        </Typography>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        width: `100%`,
        height: `100%`,
        overflow: `hidden`,
        fontFamily: `monospace`,
      }}
    >
      {renderDocument(event.regionTree)}
    </Box>
  )
}
