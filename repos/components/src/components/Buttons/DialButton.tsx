import type { FabProps } from '@mui/material/Fab'
import type { THocTooltip } from '@TSC/hocs/TooltipHoc'
import type { ComponentProps, ComponentType, ForwardedRef, ReactNode } from 'react'

import { forwardRef } from 'react'
import Fab from '@mui/material/Fab'
import { inherit } from '@TSC/theme'
import { TooltipHoc } from '@TSC/hocs/TooltipHoc'
import { isValidFuncComp } from '@TSC/utils/isValidFuncComp'

export type TDialButton = FabProps & {
  label?: string
  text?: ReactNode
  variant?: string
  children?: ReactNode
  tooltip?: THocTooltip | string
  iconProps?: ComponentProps<any>
  Icon?: ComponentType<any> | ReactNode | JSX.Element
}

export const DialButton = TooltipHoc<TDialButton, HTMLButtonElement>(
  forwardRef((props: TDialButton, ref: ForwardedRef<HTMLButtonElement>) => {
    const { Icon, text, variant, tooltip, children, label, iconProps, ...rest } = props

    return (
      <Fab
        ref={ref}
        aria-label={label}
        {...rest}
      >
        {Icon ? (
          isValidFuncComp(Icon) ? (
            <Icon
              {...iconProps}
              sx={[inherit, iconProps?.sx]}
            />
          ) : (
            Icon
          )
        ) : null}
        {children || text}
      </Fab>
    )
  })
)
