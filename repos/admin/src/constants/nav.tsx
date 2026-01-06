import type { TNavItem } from '@TAF/types'
import { ERoutePath } from '@TAF/types'
import { nav } from '@TAF/services/nav'
import { signout } from '@TAF/actions/auth/local/signout'
import {
  Apps as AppsIcon,
  Group as TeamIcon,
  Build as ToolIcon,
  Lock as SecretIcon,
  VpnKey as TokenIcon,
  Api as EndpointIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  CloudQueue as ProviderIcon,
  AutoAwesome as AutoAwesomeIcon,
} from '@mui/icons-material'

export const HeaderSettingsItems = [
  {
    label: `Profile`,
    Icon: PersonIcon,
    id: `tdsk-settings-nav-settings`,
    onClick: async () => nav.to(ERoutePath.Profile),
  },
  {
    divider: true,
    label: `Sign Out`,
    Icon: LogoutIcon,
    id: `tdsk-settings-nav-sign-out-user`,
    onClick: async () => await signout(),
  },
]

export const NavItems: TNavItem[] = [
  {
    to: ERoutePath.Teams,
    text: `Teams`,
    Icon: <TeamIcon />,
  },
  {
    to: ERoutePath.Repos,
    text: `Repos`,
    Icon: <AppsIcon />,
  },
  { to: ERoutePath.Providers, text: `Providers`, Icon: <ProviderIcon /> },
  {
    to: ERoutePath.AI,
    text: `AI`,
    Icon: <AutoAwesomeIcon />,
  },
]

export const BottomNavItems: TNavItem[] = [
  { to: ERoutePath.Settings, text: `Settings`, Icon: <SettingsIcon /> },
]

export const RepoNavItems: TNavItem[] = [
  { to: ERoutePath.Endpoints, text: `Endpoints`, Icon: <EndpointIcon /> },
  { to: ERoutePath.Secrets, text: `Secrets`, Icon: <SecretIcon /> },
  { to: ERoutePath.ApiTokens, text: `API Tokens`, Icon: <TokenIcon /> },
]

export const AINavItems: TNavItem[] = [
  { to: ERoutePath.AIAgents, text: `AI Agents`, Icon: <AutoAwesomeIcon /> },
  { to: ERoutePath.MCPTools, text: `MCP Tools`, Icon: <ToolIcon /> },
]
