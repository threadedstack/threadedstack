import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'
import { Card, CardContent, Typography, Button, Box } from '@mui/material'

export type TEmptyState = {
  message: string
  sx?: SxProps<Theme>
  actionLabel?: string
  onAction?: () => void
  actionIcon?: ReactNode
  actionVariant?: 'contained' | 'outlined' | 'text'
}

export const EmptyState = (props: TEmptyState) => {
  const {
    sx,
    message,
    onAction,
    actionIcon,
    actionLabel,
    actionVariant = 'outlined',
  } = props

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
              onClick={onAction}
              startIcon={actionIcon}
              variant={actionVariant}
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
