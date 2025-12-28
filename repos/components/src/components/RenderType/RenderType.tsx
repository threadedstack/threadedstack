import type { SxProps } from '@mui/material'
import type { ComponentType, ReactNode, ComponentProps } from 'react'

import { useMemo } from 'react'
import { ensureArr } from '@keg-hub/jsutils/ensureArr'
import { isValidFuncComp } from '@TSC/utils/isValidFuncComp'

export type TRenderType = {
  sx?:SxProps
  props?:ComponentProps<any>
  Component: ComponentType<any>|ReactNode
}

export const RenderType = ({ Component, props, sx }:TRenderType) => {

  const joined = useMemo(
    () => ({...(!sx ? {} : { sx: props?.sx ? [sx, ...ensureArr(props.sx)] : sx })}),
    [props?.sx, sx]
  )

  return isValidFuncComp(Component)
    ? (<Component {...props} {...joined} />)
    : Component

}