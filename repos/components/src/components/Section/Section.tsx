import type { TSectionAction } from '@TSC/types'
import type { ReactNode, CSSProperties, ComponentProps, ComponentType } from 'react'

import { cls } from '@keg-hub/jsutils/cls'
import { inherit } from '@TSC/theme/helpers'
import { isValidFuncComp } from '@TSC/utils/isValidFuncComp'
import { SectionActions } from '@TSC/components/Section/SectionActions'
import {
  SectionHeader,
  SectionStack,
  SectionContent,
  SectionContainer,
  SectionHeaderText,
  SectionHeaderContainer,
  SectionHeaderIconContainer,
} from '@TSC/components/Section/Section.styles'



export type TSection = {
  id?:string
  square?:boolean
  elevation?:number
  title?:ReactNode
  sx?:CSSProperties
  className?:string
  stackClass?:string
  children?:ReactNode
  contentClass?:string
  showHeader?: boolean
  actions?:TSectionAction[]
  iconProps?:ComponentProps<any>
  Icon?: ComponentType<any> | ReactNode
}

export const Section = (props:TSection) => {
  
  const {
    id,
    sx,
    Icon,
    title,
    square,
    actions,
    children,
    iconProps,
    className,
    stackClass,
    elevation=0,
    contentClass,
    showHeader=true,
  } = props
  
  return (
    <SectionContainer
      id={id}
      sx={sx}
      square={square}
      elevation={elevation}
      className={cls(`tdsk-section`, className)}
    >
      <SectionStack className={cls(stackClass, `tdsk-section-stack`)} >
        {showHeader && (
          <SectionHeader className='tdsk-section-header' >

            <SectionHeaderContainer className='tdsk-section-header-container' >
                {
                  Icon
                    ? (
                        <SectionHeaderIconContainer className='tdsk-section-header-icon-container' >
                          {
                            isValidFuncComp(Icon)
                              ? (
                                  <Icon
                                    {...iconProps}
                                    sx={[inherit, iconProps?.sx]}
                                  />
                                )
                              : (Icon)
                          }
                        </SectionHeaderIconContainer>
                      )
                    : null
                }

              <SectionHeaderText className='tdsk-section-header-text' >
                {title}
              </SectionHeaderText>

              {(actions?.length && (<SectionActions actions={actions} />)) || null}
            </SectionHeaderContainer>


          </SectionHeader>
        ) || null}

        <SectionContent className={cls(contentClass, `tdsk-section-content`)} >
          {children}
        </SectionContent>
      </SectionStack>

    </SectionContainer>
  )
  
}