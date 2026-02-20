import type { SxProps, Theme } from '@mui/material'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import { gutter } from '@TSC/theme/gutter'

export type TMenuContext = {
  sx?: SxProps<Theme>
  children: ReactNode
}

export const MenuContext = ({ sx, children }: TMenuContext) => {
  return (
    <Box
      padding={gutter.hpx}
      sx={sx}
    >
      {children}
    </Box>
  )
}
