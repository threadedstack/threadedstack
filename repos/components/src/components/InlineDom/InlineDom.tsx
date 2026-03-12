import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'

import Box from '@mui/material/Box'
import convert from 'react-from-dom'
import { useMemo } from 'react'

export type TInlineDom = {
  id?: string
  html: string
  className?: string
  sx?: SxProps<Theme>
}

export const InlineDom = (props: TInlineDom) => {
  const { sx, id, html, className } = props

  const converted = useMemo<ReactNode>(() => convert(html) as ReactNode, [html])

  return (
    <Box
      id={id}
      sx={sx}
      className={className}
    >
      {converted}
    </Box>
  )
}
