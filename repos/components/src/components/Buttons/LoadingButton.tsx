import type { ButtonProps } from '@mui/material/Button'
import type { ComponentProps, ComponentType, ForwardedRef, ReactNode } from 'react'

import { forwardRef } from 'react'
import { inherit } from '@TSC/theme'
import Button from '@mui/material/Button'
import { TooltipHoc } from '@TSC/hocs/TooltipHoc'
import CircularProgress from '@mui/material/CircularProgress'
import { RenderIcon } from '@TSC/components/RenderType/RenderIcon'

export type TLoadingButton = ButtonProps & {
  text?: string
  loading?: boolean
  loadingSize?: string
  iconProps?: ComponentProps<any>
  endIconProps?: ComponentProps<any>
  startIconProps?: ComponentProps<any>
  Icon?: ComponentType<any> | ReactNode
  StartIcon?: ComponentType<any> | ReactNode
  LoadingIcon?: ComponentType<any> | ReactNode
  EndIcon?: ComponentType<any> | ReactNode
}

const LoadingButton = TooltipHoc<TLoadingButton, HTMLButtonElement>(
  forwardRef((props: TLoadingButton, ref: ForwardedRef<HTMLButtonElement>) => {
    const {
      Icon,
      text,
      loading,
      EndIcon,
      onClick,
      children,
      iconProps,
      LoadingIcon,
      endIconProps,
      StartIcon = Icon,
      loadingSize = `1rem`,
      startIconProps = iconProps,
      ...rest
    } = props

    return (
      <Button
        {...rest}
        ref={ref}
        onClick={(evt) => !loading && onClick(evt)}
        startIcon={
          loading ? (
            LoadingIcon ? (
              <RenderIcon
                {...iconProps}
                Icon={LoadingIcon}
              />
            ) : (
              <CircularProgress
                size={loadingSize}
                {...iconProps}
                sx={[inherit, iconProps?.sx]}
              />
            )
          ) : (
            <RenderIcon
              Icon={StartIcon}
              {...startIconProps}
            />
          )
        }
        endIcon={
          <RenderIcon
            {...endIconProps}
            Icon={EndIcon}
          />
        }
      >
        {children || text}
      </Button>
    )
  })
)

export { LoadingButton }
