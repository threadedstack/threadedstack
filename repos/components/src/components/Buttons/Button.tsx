import type { TTooltip } from '@TSC/components/Tooltip'
import type { ComponentProps, ComponentType, ForwardedRef, ReactNode } from 'react'

import { forwardRef } from 'react'
import MuiBtn from '@mui/material/Button'
import { TooltipHoc } from '@TSC/hocs/TooltipHoc'
import { RenderIcon } from '@TSC/components/RenderType/RenderIcon'

export type TButton = ComponentProps<typeof MuiBtn> & {
  text?: ReactNode
  variant?: string
  tooltip?: TTooltip | string
  iconProps?: ComponentProps<any>
  endIconProps?: ComponentProps<any>
  startIconProps?: ComponentProps<any>
  Icon?: ComponentType<any> | ReactNode
  EndIcon?: ComponentType<any> | ReactNode
  StartIcon?: ComponentType<any> | ReactNode
}

export const Button = TooltipHoc<TButton, HTMLButtonElement>(
  forwardRef((props: TButton, ref: ForwardedRef<HTMLButtonElement>) => {
    const {
      Icon,
      text,
      variant,
      tooltip,
      EndIcon,
      children,
      iconProps,
      endIconProps,
      StartIcon = Icon,
      startIconProps = iconProps,
      ...rest
    } = props

    return (
      <MuiBtn
        ref={ref}
        {...rest}
        variant={variant}
        startIcon={
          <RenderIcon
            {...startIconProps}
            Icon={StartIcon}
          />
        }
        endIcon={
          <RenderIcon
            {...endIconProps}
            Icon={EndIcon}
          />
        }
      >
        {children || text}
      </MuiBtn>
    )
  })
)
