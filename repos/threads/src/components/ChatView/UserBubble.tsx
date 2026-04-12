import type { TParsedEvent } from '@tdsk/domain'

import { Box, Typography } from '@mui/material'

export type TUserBubble = {
  event: Extract<TParsedEvent, { type: 'input' }>
}

export const UserBubble = (props: TUserBubble) => {
  const { event } = props

  return (
    <Box
      display='flex'
      justifyContent='flex-end'
    >
      <Box
        sx={{
          maxWidth: `75%`,
          px: 2,
          py: 1,
          borderRadius: 2,
          backgroundColor: `primary.light`,
          color: `primary.contrastText`,
        }}
      >
        <Typography
          variant='body2'
          sx={{ fontFamily: `'JetBrains Mono', monospace`, whiteSpace: `pre-wrap` }}
        >
          {event.content}
        </Typography>
      </Box>
    </Box>
  )
}
