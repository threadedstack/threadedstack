import type { TParsedEvent } from '@tdsk/domain'

import { Card, CardContent, Box, Typography } from '@mui/material'
import { ErrorOutline } from '@mui/icons-material'

export type TErrorCard = {
  event: Extract<TParsedEvent, { type: 'error' }>
}

export const ErrorCard = (props: TErrorCard) => {
  const { event } = props

  return (
    <Card
      variant='outlined'
      sx={{
        borderColor: `error.main`,
        borderLeft: 4,
        borderLeftColor: `error.main`,
      }}
    >
      <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
        <Box
          display='flex'
          alignItems='center'
          gap={1}
        >
          <ErrorOutline
            color='error'
            sx={{ fontSize: 20 }}
          />
          <Typography
            variant='body2'
            color='error.main'
            sx={{ whiteSpace: `pre-wrap` }}
          >
            {event.message}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}
