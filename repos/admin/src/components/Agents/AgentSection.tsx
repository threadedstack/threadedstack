import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'

import { Box, Card, Divider, Typography, CardContent } from '@mui/material'

export type TAgentSection = {
  title: ReactNode
  sx?: SxProps<Theme>
  children?: ReactNode
  description?: ReactNode
}

export const AgentSection = (props: TAgentSection) => {
  const { sx, title, children, description } = props

  return (
    <Card sx={[{ mb: 3 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <CardContent>
        <Typography
          variant='h6'
          gutterBottom
        >
          {title}
        </Typography>

        <Divider sx={{ mb: 2 }} />

        {description && (
          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Description
            </Typography>
            <Typography variant='body1'>{description}</Typography>
          </Box>
        )}

        {children}
      </CardContent>
    </Card>
  )
}
