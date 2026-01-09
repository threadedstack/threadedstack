import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'

import { Box, Typography, Button } from '@mui/material'

export type TPageHeader = {
  title: string
  count?: number
  countLabel?: string
  actionLabel?: string
  actionIcon?: ReactNode
  onAction?: () => void
  actionDisabled?: boolean
  sx?: SxProps<Theme>
  variant?: 'h4' | 'h5' | 'h6'
}

// TODO: update to use jsutils function
const pluralize = (count: number, singular: string): string => {
  if (count === 1) return singular

  if (
    singular.endsWith('s') ||
    singular.endsWith('x') ||
    singular.endsWith('ch') ||
    singular.endsWith('sh')
  ) {
    return `${singular}es`
  }
  if (singular.endsWith('y') && !/[aeiou]y$/i.test(singular)) {
    return `${singular.slice(0, -1)}ies`
  }

  return `${singular}s`
}

export const PageHeader = ({
  title,
  count,
  countLabel,
  actionLabel,
  actionIcon,
  onAction,
  actionDisabled = false,
  sx,
  variant = 'h4',
}: TPageHeader) => {
  const label = countLabel || title.toLowerCase().replace(/^team\s+|^repo\s+/i, '')

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
          variant={variant}
          component='h1'
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
          variant='contained'
          color='primary'
          startIcon={actionIcon}
          onClick={onAction}
          disabled={actionDisabled}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  )
}

export default PageHeader
