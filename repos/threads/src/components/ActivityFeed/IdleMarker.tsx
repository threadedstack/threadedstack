import type { TFeedEvent } from '@TTH/types/ast.types'

import { Box, Divider, Typography } from '@mui/material'

type TIdleEvent = Extract<TFeedEvent, { kind: 'idle' }>

export type TIdleMarkerProps = {
  event: TIdleEvent
}

export const IdleMarker = (props: TIdleMarkerProps) => {
  const { event } = props
  const time = new Date(event.timestamp).toLocaleTimeString([], {
    hour: `2-digit`,
    minute: `2-digit`,
  })

  return (
    <Box sx={{ display: `flex`, alignItems: `center`, gap: 1, my: 0.5 }}>
      <Divider sx={{ flex: 1 }} />
      <Typography
        variant='caption'
        sx={{ color: `text.disabled`, whiteSpace: `nowrap`, px: 0.5 }}
      >
        {time}
      </Typography>
      <Divider sx={{ flex: 1 }} />
    </Box>
  )
}
