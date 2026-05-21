import type { ReactNode } from 'react'

import Box from '@mui/material/Box'
import { RailWrapper, RailBox } from '@TSC/components/NavRail/NavRail.styles'

export type TNavRail = {
  header?: ReactNode
  footer?: ReactNode
  children?: ReactNode
  className?: string
}

export const NavRail = (props: TNavRail) => {
  const { header, footer, children, className } = props

  return (
    <RailWrapper className={`tdsk-nav-rail ${className ?? ``}`}>
      <RailBox
        className='tdsk-nav-rail-box'
        sx={{
          '&:hover': {
            '--rail-tooltip-display': `none`,
          },
        }}
      >
        {header && (
          <Box
            className='tdsk-nav-rail-header'
            sx={{ width: `100%`, flexShrink: 0 }}
          >
            {header}
          </Box>
        )}
        <Box
          className='tdsk-nav-rail-content'
          sx={{ width: `100%`, flex: 1, overflowY: `auto`, overflowX: `hidden` }}
        >
          {children}
        </Box>
        {footer && (
          <Box
            className='tdsk-nav-rail-footer'
            sx={{ width: `100%`, flexShrink: 0 }}
          >
            {footer}
          </Box>
        )}
      </RailBox>
    </RailWrapper>
  )
}
