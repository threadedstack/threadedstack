import type { ReactNode } from 'react'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { MonoFont } from '@TTH/constants/values'

export type TSectionHeader = {
  title: string
  count?: number
  actions?: ReactNode
}

export const SectionHeader = (props: TSectionHeader) => {
  const { title, count, actions } = props

  return (
    <Box
      sx={{
        display: `flex`,
        alignItems: `center`,
        gap: `12px`,
        margin: `8px 0 14px`,
      }}
    >
      <Typography
        component='h2'
        sx={{
          fontSize: `16px`,
          fontWeight: 600,
        }}
      >
        {title}
      </Typography>
      {count != null && (
        <Typography
          component='span'
          sx={{
            fontSize: `13px`,
            color: `text.secondary`,
            fontFamily: MonoFont,
          }}
        >
          ({count})
        </Typography>
      )}
      {actions && <Box sx={{ ml: `auto`, display: `flex`, gap: `8px` }}>{actions}</Box>}
    </Box>
  )
}
