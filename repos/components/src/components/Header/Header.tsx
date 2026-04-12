import type { ReactNode, MouseEvent } from 'react'
import type { THeaderMenuItem } from '@TSC/types'

import Box from '@mui/material/Box'
import { AppLogo } from '@TSC/components/Header/AppLogo'
import { UserMenu } from '@TSC/components/Header/UserMenu'
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeIcon from '@mui/icons-material/LightModeOutlined'
import { useStateReset } from '@TSC/hooks/components/useStateReset'

import { AppHeader, HeaderToolbar, ToggleThemeAction } from './Header.styled'

const iconStyle = { height: `20px`, width: `20px` }

export type THeader = {
  breadcrumbs?: ReactNode
  user?: { name?: string; email?: string; image?: string }
  menuItems?: THeaderMenuItem[]
  themeType?: string
  onThemeToggle?: () => void
  onNavigateHome?: () => void
}

export const Header = (props: THeader) => {
  const {
    breadcrumbs,
    user,
    menuItems = [],
    themeType,
    onThemeToggle,
    onNavigateHome,
  } = props

  const [anchorEl, __, resetAnchor, updateAnchor] = useStateReset<
    null | HTMLElement,
    MouseEvent<HTMLElement>
  >(null, null, `currentTarget`)

  return (
    <AppHeader
      elevation={0}
      position='sticky'
      className='tsdk-app-header'
    >
      <HeaderToolbar>
        <AppLogo
          full
          onNavigate={onNavigateHome}
        />
        {breadcrumbs}
        <Box flex={1} />
        {onThemeToggle && (
          <ToggleThemeAction
            onClick={() => onThemeToggle()}
            tooltip='Toggle theme to light or dark'
          >
            {themeType === `light` ? (
              <LightModeIcon style={iconStyle} />
            ) : (
              <DarkModeIcon style={iconStyle} />
            )}
          </ToggleThemeAction>
        )}
        {menuItems.length > 0 && (
          <UserMenu
            user={user}
            menuItems={menuItems}
            anchorEl={anchorEl}
            onOpen={updateAnchor}
            onClose={resetAnchor}
          />
        )}
      </HeaderToolbar>
    </AppHeader>
  )
}
