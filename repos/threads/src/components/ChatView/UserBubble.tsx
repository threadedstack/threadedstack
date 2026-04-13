import type { TParsedEvent } from '@tdsk/domain'

import { Box, Typography } from '@mui/material'

export type TUserBubble = {
  event: Extract<TParsedEvent, { type: 'input' }>
  isOwnInput: boolean
}

export const UserBubble = (props: TUserBubble) => {
  const { event, isOwnInput } = props

  return (
    <Box
      display='flex'
      justifyContent={isOwnInput ? `flex-end` : `flex-start`}
    >
      <Box
        sx={{
          maxWidth: `75%`,
          px: 2,
          py: 1,
          borderRadius: 2,
          backgroundColor: isOwnInput ? `primary.light` : `grey.700`,
          color: isOwnInput ? `primary.contrastText` : `grey.100`,
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
