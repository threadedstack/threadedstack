import type { THocTooltip } from '@TSC/hocs/TooltipHoc'
import type { ToggleButtonGroupProps } from '@mui/material/ToggleButtonGroup'
import type { CSSProperties, ComponentProps, ComponentType, ForwardedRef, ReactNode } from 'react'

import { forwardRef } from 'react'
import { inherit } from '@TSC/theme'
import { cls } from '@keg-hub/jsutils/cls'
import { TooltipHoc } from '@TSC/hocs/TooltipHoc'
import ToggleButton from '@mui/material/ToggleButton'
import { isValidFuncComp } from '@TSC/utils/isValidFuncComp'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'

export type TGroupButton = {
  value?:any
  sx?:CSSProperties
  className?:string
  disabled?:boolean
  children?:ReactNode
  onClick?:(evt:any) => void
  tooltip?: THocTooltip | string
  iconProps?: ComponentProps<any>
  Icon?: ComponentType<any> | ReactNode
}

export type TButtonGroup = ToggleButtonGroupProps & {
  buttons?:TGroupButton[]
}

export const GroupButton = TooltipHoc<TGroupButton, HTMLButtonElement>(
  forwardRef((props: TGroupButton, ref: ForwardedRef<HTMLButtonElement>) => {

  const {
    Icon,
    value,
    onClick,
    disabled,
    children,
    iconProps,
    className,
  } = props
  
  return (
    <ToggleButton
      ref={ref}
      value={value}
      onClick={onClick}
      aria-label={value}
      disabled={disabled}
      className={cls(className, `tdsk-button-group-button`)}
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
      {children}
    </ToggleButton>
  )
}))

export const ButtonGroup = (props:TButtonGroup) => {
  const {
    buttons,
    children,
    className,
    ...rest
  } = props
  
  return (
      <ToggleButtonGroup
        {...rest}
        className={cls(className, `tdsk-button-group`)}
      >
        {buttons?.map(button => (<GroupButton {...button} />))}
        {children}
      </ToggleButtonGroup>
  )
  
}