import type { ReactNode, ComponentType } from 'react'

import { Fragment } from 'react'
import { cls } from '@keg-hub/jsutils/cls'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import {
  MenuBackText,
  MenuBackButton,
  MenuBackContainer,
} from '@TSC/components/Menu/Menu.styles'

export type TMenuBack = {
  text?: string
  crumbs?: string[]
  className?: string
  divider?: ReactNode
  onBack?: () => any
  Icon?: ReactNode | ComponentType<any>
}

export const MenuBack = (props: TMenuBack) => {
  const {
    onBack,
    crumbs,
    className,
    text = `Back`,
    divider = `⟫`,
    Icon = ChevronLeftIcon,
  } = props

  return (
    <MenuBackContainer className={cls(`tdsk-menu-back-container`, className)}>
      <MenuBackButton
        text={text}
        Icon={Icon}
        onClick={onBack}
        className='tdsk-menu-back-button'
      />
      <MenuBackText className='tdsk-menu-back-crumbs'>
        {crumbs.map((crumb, idx) => {
          if (idx === crumbs?.length - 1) return crumb

          return (
            <Fragment key={`${idx}${crumb}`}>
              {crumb}
              {` `}
              {divider}
              {` `}
            </Fragment>
          )
        })}
      </MenuBackText>
    </MenuBackContainer>
  )
}
