import type { THocTooltip } from '@TSC/hocs/TooltipHoc'
import type { ComponentProps, ComponentType, ForwardedRef, ReactNode } from 'react'

import { forwardRef } from 'react'
import { inherit } from '@TSC/theme'
import MuiIconBtn from '@mui/material/IconButton'
import { TooltipHoc } from '@TSC/hocs/TooltipHoc'
import CircularProgress from '@mui/material/CircularProgress'
import { RenderIcon } from '@TSC/components/RenderType/RenderIcon'

export type TIconButton = Omit<ComponentProps<typeof MuiIconBtn>, `color`> & {
  color?: string
  variant?: string
  text?: ReactNode
  loading?: boolean
  loadingSize?: string | number
  tooltip?: THocTooltip | string
  iconProps?: ComponentProps<any>
  Icon?: ComponentType<any> | ReactNode
}

export const IconButton = TooltipHoc<TIconButton, HTMLButtonElement>(
  forwardRef((props: TIconButton, ref: ForwardedRef<HTMLButtonElement>) => {
    const {
      Icon,
      text,
      color,
      loading,
      variant,
      tooltip,
      children,
      iconProps,
      loadingSize = `1rem`,
      ...rest
    } = props

    return (
      <MuiIconBtn
        ref={ref}
        {...rest}
        color={color as any}
      >
        {loading ? (
          <CircularProgress
            size={loadingSize}
            color={color as any}
            {...iconProps}
            sx={[inherit, iconProps?.sx]}
          />
        ) : Icon ? (
          <RenderIcon
            {...iconProps}
            Icon={Icon}
          />
        ) : (
          children
        )}
      </MuiIconBtn>
    )
  })
)
