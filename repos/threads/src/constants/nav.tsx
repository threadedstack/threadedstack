import type { THeaderMenuItem } from '@tdsk/components'

import { nav } from '@TTH/services/nav'
import { ERoutePath } from '@TTH/types'
import PersonIcon from '@mui/icons-material/Person'
import LogoutIcon from '@mui/icons-material/Logout'
import SettingsIcon from '@mui/icons-material/Settings'
import { signout } from '@TTH/actions/auth/local/signout'

export const SidebarNavIndent = 48

export const HeaderSettingsItems: THeaderMenuItem[] = [
  {
    label: `Profile`,
    Icon: PersonIcon,
    id: `tdsk-settings-nav-profile`,
    onClick: async () => nav.to(`/${ERoutePath.Profile}`),
  },
  {
    label: `Settings`,
    Icon: SettingsIcon,
    id: `tdsk-settings-nav-settings`,
    onClick: async () => nav.to(`/${ERoutePath.Settings}`),
  },
  {
    divider: true,
    label: `Sign Out`,
    Icon: LogoutIcon,
    id: `tdsk-settings-nav-sign-out-user`,
    onClick: async () => await signout(),
  },
]
