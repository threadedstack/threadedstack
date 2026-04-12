import type { THeaderMenuItem, TAnyCB } from '@TSC/types'

import Link from '@mui/material/Link'
import { dims } from '@TSC/theme/dims'
import Avatar from '@mui/material/Avatar'
import Divider from '@mui/material/Divider'
import { useCallback, useMemo } from 'react'
import MuiMenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import { getInitials } from '@TSC/utils/getInitials'
import { IconButton } from '@TSC/components/Buttons'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import { HeaderMenu, SettingsContainer } from '@TSC/components/Header/Header.styled'

export type TUserMenu = {
  user?: { name?: string; email?: string; image?: string }
  menuItems: THeaderMenuItem[]
  anchorEl: HTMLElement | null
  onOpen: TAnyCB
  onClose: TAnyCB
  tooltip?: string
}

type THeaderMenuItemRow = THeaderMenuItem & {
  onClose?: TAnyCB
}

const MenuItemRow = (props: THeaderMenuItemRow) => {
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
      <MuiMenuItem
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
              href={`/${(path || label || ``).toLowerCase()}`}
              {...linkProps}
            >
              <Typography {...textProps}>{label}</Typography>
            </Link>
          )}
        </ListItemText>
      </MuiMenuItem>
    </>
  )
}

const avatarStyle = {
  width: `${dims.header.avatar.size}px`,
  height: `${dims.header.avatar.size}px`,
}

const useUserAvatar = (user: Partial<TUserMenu['user']> = {}) => {
  return useMemo(() => {
    if (!user?.name && !user?.image) return {}

    const displayName = user?.name || user?.email?.split?.(`@`)[0] || `Anon User`

    return user?.image
      ? {
          sx: avatarStyle,
          src: user?.image,
          alt: displayName,
        }
      : {
          sx: avatarStyle,
          alt: displayName,
          children: getInitials(displayName),
        }
  }, [user?.name, user?.email, user?.image])
}

export const UserMenu = (props: TUserMenu) => {
  const { user, menuItems, anchorEl, onOpen, onClose, tooltip = `Settings` } = props

  const avatarProps = useUserAvatar(user)

  return (
    <SettingsContainer>
      <IconButton
        tooltip={tooltip}
        onClick={onOpen}
        sx={{ p: 0 }}
      >
        <Avatar {...avatarProps} />
      </IconButton>
      <HeaderMenu
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
        onClose={onClose}
      >
        {menuItems.map((item) => (
          <MenuItemRow
            onClose={onClose}
            key={item.id || item.label || item.path}
            {...item}
          />
        ))}
      </HeaderMenu>
    </SettingsContainer>
  )
}
