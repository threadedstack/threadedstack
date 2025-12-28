import type { ReactNode, ComponentType, ComponentProps } from 'react'

import { inherit } from '@TSC/theme/helpers'
import { RenderType } from '@TSC/components/RenderType/RenderType'

export type TRenderIcon = ComponentProps<any> & {
  Icon?:ReactNode|ComponentType<any>
}

export const RenderIcon = (props:TRenderIcon) => {

  const {
    Icon,
    ...rest
  } = props

  return (
    <RenderType
      sx={inherit}
      Component={Icon}
      props={rest}
    />
  )
  
}
