import type { CSSProperties, ReactNode } from 'react'
import Box from '@mui/material/Box'
import { gutter } from '@TSC/theme/gutter'

export type TMenuContext = {
  sx?:CSSProperties
  children: ReactNode
}

export const MenuContext = ({
  sx,
  children
}:TMenuContext) => {
  return (
    <Box
      padding={gutter.hpx}
      sx={sx}
    >
      {children}
    </Box>
  )
}