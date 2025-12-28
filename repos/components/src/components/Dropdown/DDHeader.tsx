import type { CSSProperties, ReactNode } from 'react'

import { cls } from '@keg-hub/jsutils/cls'
import {
  DDHeaderText,
  DDHeaderIcon,
  DDHeaderContent,
  DDHeaderContainer
} from '@TSC/components/Dropdown/DDHeader.styles'

export type TDDHeader = {
  className?:string
  text?:ReactNode
  Icon?:ReactNode
  textSx?:CSSProperties
  iconSx?:CSSProperties
  contentSx?:CSSProperties
  containerSx?:CSSProperties
}

export const DDHeader = (props:TDDHeader) => {
  const {
    text,
    Icon,
    textSx,
    iconSx,
    className,
    contentSx,
    containerSx,
  } = props

  return (
    <DDHeaderContainer
      className={cls(`tdsk-dd-header-container`, className)}
      sx={containerSx}
    >
      <DDHeaderContent
        className="tdsk-dd-header-content"
        sx={contentSx}
      >
      {Icon && (
        <DDHeaderIcon
          className="tdsk-dd-header-icon"
          sx={iconSx}
        >
          {Icon}
        </DDHeaderIcon>
      )}
      {text && (
        <DDHeaderText
          className="tdsk-dd-header-text"
          sx={textSx}
        >
          {text}
        </DDHeaderText>
      )}
      </DDHeaderContent>
    </DDHeaderContainer>
  )
}
