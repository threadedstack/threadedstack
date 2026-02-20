import type { SxProps, Theme } from '@mui/material'
import type { ReactNode } from 'react'

import { cls } from '@keg-hub/jsutils/cls'
import {
  DDHeaderText,
  DDHeaderIcon,
  DDHeaderContent,
  DDHeaderContainer,
} from '@TSC/components/Dropdown/DDHeader.styles'

export type TDDHeader = {
  className?: string
  text?: ReactNode
  Icon?: ReactNode
  textSx?: SxProps<Theme>
  iconSx?: SxProps<Theme>
  contentSx?: SxProps<Theme>
  containerSx?: SxProps<Theme>
}

export const DDHeader = (props: TDDHeader) => {
  const { text, Icon, textSx, iconSx, className, contentSx, containerSx } = props

  return (
    <DDHeaderContainer
      className={cls(`tdsk-dd-header-container`, className)}
      sx={containerSx}
    >
      <DDHeaderContent
        className='tdsk-dd-header-content'
        sx={contentSx}
      >
        {Icon && (
          <DDHeaderIcon
            className='tdsk-dd-header-icon'
            sx={iconSx}
          >
            {Icon}
          </DDHeaderIcon>
        )}
        {text && (
          <DDHeaderText
            className='tdsk-dd-header-text'
            sx={textSx}
          >
            {text}
          </DDHeaderText>
        )}
      </DDHeaderContent>
    </DDHeaderContainer>
  )
}
