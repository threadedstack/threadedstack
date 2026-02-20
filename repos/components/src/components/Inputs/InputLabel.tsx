import type { NotificationCountProps } from '@TSC/types'
import type { SxProps, Theme } from '@mui/material'
import type { ReactNode, ElementType } from 'react'

import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import { Label } from '@TSC/components/Inputs/Inputs.styles'
import { NotificationCount } from '@TSC/components/NotificationCount'
import Info from '@mui/icons-material/Info'
import { cls } from '@keg-hub/jsutils/cls'

type InputLabelProps = {
  id?: string
  tooltip?: string
  className?: string
  required?: boolean
  noLabelDim?: boolean
  children?: ReactNode
  label?: string | number
  component?: ElementType<any>
  sx?: SxProps<Theme>
  notificationsProps?: NotificationCountProps
}

const InputLabel = (props: InputLabelProps) => {
  const {
    id,
    sx,
    label,
    tooltip,
    children,
    required,
    component,
    className,
    noLabelDim,
    notificationsProps,
  } = props

  return (
    <Box
      width='100%'
      display='flex'
      className={className}
      justifyContent='space-between'
    >
      <Box
        display='flex'
        gap={0.5}
        alignItems='center'
      >
        <Label
          sx={sx}
          htmlFor={id}
          required={required}
          component={component}
          className={cls(noLabelDim && `no-label-dim`)}
        >
          {label || children}
        </Label>
        {tooltip ? (
          <Tooltip title={tooltip}>
            <Info sx={{ fontSize: 12, color: 'grey.600' }} />
          </Tooltip>
        ) : null}
      </Box>
      {notificationsProps ? <NotificationCount {...notificationsProps} /> : null}
    </Box>
  )
}

export { InputLabel }
