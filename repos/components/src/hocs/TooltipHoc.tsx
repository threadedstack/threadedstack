import type { TTooltip } from '@TSC/components/Tooltip'
import type { ComponentProps, ComponentType, ReactNode, ForwardedRef } from 'react'

import { forwardRef } from 'react'
import { Tooltip } from '@TSC/components/Tooltip'
import { emptyObj, isStr } from '@keg-hub/jsutils'

export type THocTooltip = Omit<TTooltip, `children`>

export type THTooltip<T extends ComponentProps<any>> = T & {
  tooltip?: THocTooltip | ReactNode
}

export type THTooltipOpts = {
  disabledProp?: string
}

export const TooltipHoc = <
  T extends ComponentProps<any>,
  R extends HTMLElement=any
>(
  Component: ComponentType<any>,
  opts: THTooltipOpts = emptyObj
) => {
  const { disabledProp = `disabled` } = opts

  return forwardRef<R, THTooltip<T>>((props, ref) => {
    const { tooltip, ...rest } = props

    return tooltip && (rest as any)?.[disabledProp] !== true ? (
      <Tooltip {...(!isStr(tooltip) ? (tooltip as THocTooltip) : { title: tooltip })}>
        <Component {...rest} ref={ref} />
      </Tooltip>
    ) : (
      <Component {...rest} ref={ref} />
    )
  })
}
