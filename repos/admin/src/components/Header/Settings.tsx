import type { User } from '@tdsk/domain'
import type { TSettingNavItem, TAnyCB } from '@TAF/types'

import Link from '@mui/material/Link'
import Avatar from '@mui/material/Avatar'
import Divider from '@mui/material/Divider'
import { useCallback, useMemo } from 'react'
import MenuItem from '@mui/material/MenuItem'
import { useUser } from '@TAF/state/selectors'
import { IconButton, dims } from '@tdsk/components'
import { Link as RouterLink } from 'react-router'
import Typography from '@mui/material/Typography'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import { Menu } from '@TAF/components/Header/Header.styled'

import { SettingsContainer } from './Settings.styled'

type TSettings = {
  anchorEl: null | HTMLElement
  onOpenSettings: TAnyCB
  onCloseSettings: TAnyCB
  navItems: TSettingNavItem[]
}

type TSettingItem = TSettingNavItem & {
  onClose?: TAnyCB
}

const SettingItem = (props: TSettingItem) => {
  const {
    Icon,
    path,
    divider,
    label,
    onClick,
    onClose,
    iconProps,
    itemProps,
    textProps,
    linkProps,
  } = props

  const onMenuClose = useCallback(
    (...args: any[]) => {
      onClick?.(...args)
      onClose?.(...args)
    },
    [onClick, onClose]
  )

  return (
    <>
      {divider && <Divider />}
      <MenuItem
        onClick={onMenuClose}
        autoFocus
        {...itemProps}
      >
        <ListItemIcon>
          <Icon
            fontSize='small'
            {...iconProps}
          />
        </ListItemIcon>
        <ListItemText>
          {onClick ? (
            <Typography {...textProps}>{label}</Typography>
          ) : (
            <Link
              underline='none'
              component={RouterLink}
              to={`/${(path || label || ``).toLowerCase()}`}
              {...linkProps}
            >
              <Typography {...textProps}>{label}</Typography>
            </Link>
          )}
        </ListItemText>
      </MenuItem>
    </>
  )
}

const SettingMenu = (props: TSettings & { user: User }) => {
  const { user, anchorEl, navItems, onCloseSettings } = props

  return (
    <Menu
      elevation={0}
      sx={{ mt: '6px' }}
      id='tdsk-account-menu'
      anchorEl={anchorEl}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      keepMounted
      transformOrigin={{
        vertical: 'top',
        horizontal: 'right',
      }}
      open={Boolean(anchorEl)}
      onClose={onCloseSettings}
    >
      {navItems.map((setting) => {
        return (
          <SettingItem
            onClose={onCloseSettings}
            key={setting.id || setting.label || setting.path}
            {...setting}
          />
        )
      })}
    </Menu>
  )
}

const style = {
  width: `${dims.header.avatar.size}px`,
  height: `${dims.header.avatar.size}px`,
}

const getUserInitials = (displayName?: string, username?: string) => {
  if (!displayName && !username) return {}

  if (displayName) {
    const split = displayName.split(` `)
    const first = split.shift() || ``
    const last = split.pop() || ``
    return { children: `${first[0] || ''}${last[0] || ''}`.trim().toUpperCase() }
  }
  if (username) return { children: `${username[0]}${username[1]}`.trim().toUpperCase() }
}

const useAvatar = (user: Partial<User> = {}) => {
  return useMemo(() => {
    if (!user?.name && !user.image) return {}

    const displayName = user?.name || user.email?.split?.(`@`)[0] || `Anon User`

    return user?.image
      ? {
          sx: style,
          src: user?.image,
          alt: displayName,
        }
      : {
          sx: style,
          alt: displayName,
          ...getUserInitials(displayName),
        }
  }, [user?.name, user?.email, user?.image])
}

export const Settings = (props: TSettings) => {
  const { onOpenSettings } = props
  const [user] = useUser()
  const avatarProps = useAvatar(user)

  return (
    <SettingsContainer>
      <IconButton
        tooltip='Admin Settings'
        onClick={onOpenSettings}
        sx={{ p: 0 }}
      >
        <Avatar {...avatarProps} />
      </IconButton>
      <SettingMenu
        {...props}
        user={user}
      />
    </SettingsContainer>
  )
}
