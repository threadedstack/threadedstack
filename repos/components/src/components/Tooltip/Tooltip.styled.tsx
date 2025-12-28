import type { TooltipProps } from '@mui/material/Tooltip'

import Tooltip, { tooltipClasses } from '@mui/material/Tooltip'
import { styled } from '@mui/material/styles'

export type TTooltipProps = TooltipProps & {
  fontSize?: string
}

export const MuiTooltip = styled(({ className, fontSize, ...props }: TTooltipProps) => (
  <Tooltip
    {...props}
    classes={{ popper: className }}
  />
))(({ theme, fontSize = 14 }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    fontSize,
    boxShadow: theme.shadows[3],
  },
}))
