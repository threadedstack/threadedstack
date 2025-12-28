import type { TooltipProps } from '@mui/material/Tooltip'

import type { ComponentProps } from 'react'
import { MuiTooltip } from './Tooltip.styled'

export type TTooltip = ComponentProps<typeof MuiTooltip> & {
  loc?: TooltipProps['placement']
  tooltipDisabled?: boolean
}

export const Tooltip = (props: TTooltip) => {
  const {
    loc,
    children,
    placement = loc,
    enterDelay = 500,
    fontSize = `12px`,
    tooltipDisabled,
    ...rest
  } = props

  return tooltipDisabled ? (
    <>{children}</>
  ) : (
    <MuiTooltip
      {...rest}
      fontSize={fontSize}
      enterDelay={enterDelay}
      placement={placement || `bottom`}
    >
      {children}
    </MuiTooltip>
  )
}
