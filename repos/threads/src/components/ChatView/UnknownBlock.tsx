import type { TParsedEvent } from '@tdsk/domain'

import { Box, Typography } from '@mui/material'

export type TUnknownBlock = {
  event: Extract<TParsedEvent, { type: 'unknown' }>
}

export const UnknownBlock = (props: TUnknownBlock) => {
  const { event } = props

  return (
    <Box
      sx={{
        backgroundColor: `action.hover`,
        px: 2,
        py: 1,
        borderRadius: 1,
      }}
    >
      <Typography
        variant='body2'
        sx={{
          fontFamily: `'JetBrains Mono', monospace`,
          fontSize: `0.8rem`,
          whiteSpace: `pre-wrap`,
          color: `text.secondary`,
        }}
      >
        {event.raw}
      </Typography>
    </Box>
  )
}
