import type { ReactNode } from 'react'

import { Box, Typography } from '@mui/material'

type TEmptyState = {
  icon: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export const EmptyState = (props: TEmptyState) => {
  const { icon, title, description, action } = props

  return (
    <Box
      sx={{
        py: 8,
        gap: 2,
        display: `flex`,
        alignItems: `center`,
        flexDirection: `column`,
        justifyContent: `center`,
      }}
    >
      <Box
        sx={{
          color: `text.secondary`,
          display: `flex`,
          '& .MuiSvgIcon-root': { fontSize: 64 },
        }}
      >
        {icon}
      </Box>
      <Typography variant='h6'>{title}</Typography>
      {description && (
        <Typography
          variant='body2'
          color='text.secondary'
        >
          {description}
        </Typography>
      )}
      {action}
    </Box>
  )
}
