import type { TFeedEvent } from '@TTH/types/ast.types'

import { Box, Typography } from '@mui/material'

type TInputEvent = Extract<TFeedEvent, { kind: 'input' }>

export type TUserInputCardProps = {
  event: TInputEvent
}

export const UserInputCard = (props: TUserInputCardProps) => {
  const { event } = props

  return (
    <Box
      sx={{
        py: 0.75,
        px: 1,
        borderRadius: 1,
        backgroundColor: `action.hover`,
        alignSelf: `flex-end`,
        maxWidth: `80%`,
      }}
    >
      <Typography
        variant='body2'
        sx={{
          fontFamily: `monospace`,
          color: `primary.main`,
          whiteSpace: `pre-wrap`,
          wordBreak: `break-word`,
        }}
      >
        {event.text}
      </Typography>
    </Box>
  )
}
