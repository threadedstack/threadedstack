import { ERoutePath, TNavItem } from '@TAF/types'
import { nav } from '@TAF/services/nav'
import { signout } from '@TAF/actions/auth/local/signout'
import {
  Apps as AppsIcon,
  Group as TeamIcon,
  Build as ToolIcon,
  SmartToy as AiIcon,
  Lock as SecretIcon,
  VpnKey as TokenIcon,
  Api as EndpointIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  CloudQueue as ProviderIcon,
  Dashboard as DashboardIcon,
} from "@mui/icons-material"


export const HeaderSettingsItems = [
  {
    label: `Dashboard`,
    Icon: DashboardIcon,
    id: `tdsk-settings-nav-dashboard`,
    onClick: async () => nav.home(),
  },
  {
    label: `Settings`,
    Icon: SettingsIcon,
    id: `tdsk-settings-nav-settings`,
    onClick: async () => nav.to(ERoutePath.Settings),
  },
  {
    divider: true,
    label: `Sign Out`,
    Icon: LogoutIcon,
    id: `tdsk-settings-nav-sign-out-user`,
    onClick: async () => await signout(),
  }
]

export const AppNavItems:TNavItem[] = [
  { to: ERoutePath.Endpoints, text: `Endpoints`, Icon: <EndpointIcon /> },
]

export const AINavItems:TNavItem[] = [
  { to: ERoutePath.AIAgents, text: `AI Agents`, Icon: <AiIcon /> },
  { to: ERoutePath.MCPTools, text: `MCP Tools`, Icon: <ToolIcon /> },
]

export const NavItems: TNavItem[] = [
  { to: ERoutePath.Teams, text: `Teams`, Icon: <TeamIcon /> },
  {
      to: ERoutePath.Repos,
      text: `Repos`,
      Icon: <AppsIcon />,
    },
  { to: ERoutePath.Secrets, text: `Secrets`, Icon: <SecretIcon /> },
  { to: ERoutePath.ApiTokens, text: `API Tokens`, Icon: <TokenIcon /> },
  { to: ERoutePath.Providers, text: `Providers`, Icon: <ProviderIcon /> },
  {
    to: ERoutePath.AI,
    text: `AI`,
    Icon: <AiIcon />,
  },
  { to: ERoutePath.Settings, text: `Settings`, Icon: <SettingsIcon /> },
]


