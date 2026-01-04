import type { MouseEvent } from 'react'
import type { TSettingNavItem } from '@TAF/types'

import Box from '@mui/material/Box'
import { EThemeType } from '@TAF/types'
import { Settings } from '@TAF/components/Header/Settings'
import { useStateReset } from '@TAF/hooks/components/useReset'
import { useThemeToggle } from '@TAF/hooks/theme/useThemeToggle'
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeIcon from '@mui/icons-material/LightModeOutlined'

import {
  AppHeader,
  HeaderToolbar,
  ToggleThemeAction,
} from '@TAF/components/Header/Header.styled'


type THeaderProps = {
  navItems?: TSettingNavItem[]
}

const styles = {
  icon: { height: `20px`, width: `20px` }
}

export const Header = (props:THeaderProps) => {
  const navItems = props.navItems || []

  const {
    themeType,
    onThemeToggle
  } = useThemeToggle()

  const [
    anchorEl,
    __,
    resetAnchor,
    updateAnchor,
  ] = useStateReset<null | HTMLElement, MouseEvent<HTMLElement>>(null, null, `currentTarget`)

  return (
    <AppHeader position="sticky" className='tsdk-app-header' >
      <HeaderToolbar>
        <Box flex={1} />
        <ToggleThemeAction
          onClick={() => onThemeToggle()}
          tooltip='Toggle theme to light or dark'
        >
        {
          themeType === EThemeType.light
            ? (<LightModeIcon style={styles.icon} />)
            : (<DarkModeIcon style={styles.icon} />)
        }
        </ToggleThemeAction>
        <Settings
          navItems={navItems}
          anchorEl={anchorEl}
          onOpenSettings={updateAnchor}
          onCloseSettings={resetAnchor}
        />
      </HeaderToolbar>
    </AppHeader>
  )
}

