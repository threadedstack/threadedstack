import type { ReactNode } from 'react'
import { IconButton, Tooltip } from '@mui/material'
import type { IconButtonProps } from '@mui/material'

export type TActionIconButton = Omit<IconButtonProps, 'children'> & {
  tooltip: string
  icon: ReactNode
  disabledTooltip?: string
}

export const ActionIconButton = ({
  tooltip,
  icon,
  disabled,
  disabledTooltip,
  onClick,
  ...props
}: TActionIconButton) => {
  const tooltipText = disabled && disabledTooltip ? disabledTooltip : tooltip

  // Wrap in span when disabled to allow tooltip to show
  const button = (
    <IconButton
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {icon}
    </IconButton>
  )

  return (
    <Tooltip title={tooltipText}>{disabled ? <span>{button}</span> : button}</Tooltip>
  )
}

export default ActionIconButton
