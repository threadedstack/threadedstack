import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'

import { Box, Typography, Button } from '@mui/material'
import { pluralize } from '@TAF/utils/text/pluralize'

export type TPageHeader = {
  title: string
  count?: number
  sx?: SxProps<Theme>
  countLabel?: string
  actionLabel?: string
  actionIcon?: ReactNode
  onAction?: () => void
  actionDisabled?: boolean
  variant?: 'h4' | 'h5' | 'h6'
}

export const PageHeader = (props: TPageHeader) => {
  const {
    sx,
    title,
    count,
    onAction,
    actionIcon,
    countLabel,
    actionLabel,
    variant = `h5`,
    actionDisabled = false,
  } = props

  const label = countLabel || title.toLowerCase().replace(/^org\s+|^project\s+/i, '')

  return (
    <Box
      sx={{
        mb: 3,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        ...sx,
      }}
    >
      <Box>
        <Typography
          component='h1'
          variant={variant}
        >
          {title}
        </Typography>
        {count !== undefined && (
          <Typography color='text.secondary'>
            {count} {pluralize(count, label)}
          </Typography>
        )}
      </Box>
      {actionLabel && onAction && (
        <Button
          color='primary'
          onClick={onAction}
          variant='contained'
          startIcon={actionIcon}
          disabled={actionDisabled}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  )
}

export default PageHeader
