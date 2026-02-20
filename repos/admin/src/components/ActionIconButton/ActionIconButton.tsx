import type { ReactNode } from 'react'
import { IconButton, Tooltip } from '@mui/material'
import type { IconButtonProps } from '@mui/material'

export type TActionIconButton = Omit<IconButtonProps, 'children'> & {
  tooltip: string
  icon: ReactNode
  disabledTooltip?: string
}

export const ActionIconButton = ({
  icon,
  onClick,
  tooltip,
  disabled,
  disabledTooltip,
  ...props
}: TActionIconButton) => {
  const tooltipText = disabled && disabledTooltip ? disabledTooltip : tooltip

  // Wrap in span when disabled to allow tooltip to show
  const { sx, ...rest } = props

  const button = (
    <IconButton
      {...rest}
      onClick={onClick}
      disabled={disabled}
      sx={[{ minHeight: 44, minWidth: 44 }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      {icon}
    </IconButton>
  )

  return (
    <Tooltip title={tooltipText}>{disabled ? <span>{button}</span> : button}</Tooltip>
  )
}

export default ActionIconButton
