import { Card, CardContent, Typography, Button, Box } from '@mui/material'
import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'

export type TEmptyState = {
  message: string
  actionLabel?: string
  actionIcon?: ReactNode
  onAction?: () => void
  sx?: SxProps<Theme>
}

export const EmptyState = ({
  message,
  actionLabel,
  actionIcon,
  onAction,
  sx,
}: TEmptyState) => {
  return (
    <Card sx={sx}>
      <CardContent>
        <Typography
          color='text.secondary'
          align='center'
        >
          {message}
        </Typography>
        {actionLabel && onAction && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button
              variant='outlined'
              startIcon={actionIcon}
              onClick={onAction}
            >
              {actionLabel}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

export default EmptyState
