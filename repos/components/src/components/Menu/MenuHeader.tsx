import type { ReactNode, ComponentType, ComponentProps } from 'react'

import { cls } from '@keg-hub/jsutils/cls'
import { RenderIcon } from '@TSC/components/RenderType/RenderIcon'
import {
  MenuHeaderIcon,
  MenuHeaderTitle,
  MenuHeaderContainer,
  MenuHeaderIconContainer
} from '@TSC/components/Menu/Menu.styles'

export type TMenuHeader = {
  title?:ReactNode
  className?:string
  iconProps?:ComponentProps<any>
  Icon?:ReactNode|ComponentType<any>
}

export const MenuHeader = (props:TMenuHeader) => {
  
  const {
    title,
    iconProps,
    className,
    Icon=MenuHeaderIcon,
  } = props

  return (
    <MenuHeaderContainer className={cls(`tdsk-menu-header-contaienr`, className)} >
      <MenuHeaderIconContainer className='tdsk-menu-header-icon' >
        <RenderIcon
          {...iconProps}
          Icon={Icon}
        />
      </MenuHeaderIconContainer>
      
      <MenuHeaderTitle className='tdsk-menu-header-title' >
        {title}
      </MenuHeaderTitle>
    </MenuHeaderContainer>
  )
  
}
