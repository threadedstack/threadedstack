import type { ReactNode } from 'react'

import Box from '@mui/material/Box'
import { MonoFont } from '@TTH/constants/values'

export type TPillMono = {
  children: ReactNode
}

export const PillMono = (props: TPillMono) => {
  const { children } = props

  return (
    <Box
      component='span'
      sx={{
        display: `inline-block`,
        fontFamily: MonoFont,
        fontSize: `11px`,
        padding: `2px 6px`,
        bgcolor: `background.default`,
        border: 1,
        borderColor: `divider`,
        borderRadius: `4px`,
        color: `text.secondary`,
      }}
    >
      {children}
    </Box>
  )
}
