import type { TNavItem, TNavCtx } from '@TAF/types'

import { ERoutePath } from '@TAF/types'
import { nav } from '@TAF/services/nav'
import { signout } from '@TAF/actions/auth/local/signout'
import {
  Apps as AppsIcon,
  Home as HomeIcon,
  Build as ToolIcon,
  Code as FunctionIcon,
  Lock as SecretIcon,
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

// Global navigation items (always visible)
export const GlobalNavItems: TNavItem[] = [
  {
    to: ERoutePath.Team,
    text: `Home`,
    Icon: <HomeIcon />,
  },
  {
    to: ERoutePath.AI,
    text: `AI`,
    Icon: <AutoAwesomeIcon />,
  },
]

// Team-scoped navigation items
export const TeamNavItems: TNavItem[] = [
  {
    text: `Users`,
    to: (ctx: TNavCtx) => {
      if (!ctx.teamId) return '#'
      return `/teams/${ctx.teamId}/users`
    },
    Icon: <PersonIcon />,
    visible: (ctx: TNavCtx) => !!ctx.teamId,
  },
  {
    text: `Repos`,
    to: (ctx: TNavCtx) => {
      if (!ctx.teamId) return '#'
      return `/teams/${ctx.teamId}/repos`
    },
    Icon: <AppsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.teamId,
  },
  {
    text: `Secrets`,
    to: (ctx: TNavCtx) => {
      if (!ctx.teamId) return '#'
      return `/teams/${ctx.teamId}/secrets`
    },
    Icon: <SecretIcon />,
    visible: (ctx: TNavCtx) => !!ctx.teamId,
  },
  {
    text: `Providers`,
    to: (ctx: TNavCtx) => {
      if (!ctx.teamId) return '#'
      return `/teams/${ctx.teamId}/providers`
    },
    Icon: <ProviderIcon />,
    visible: (ctx: TNavCtx) => !!ctx.teamId,
  },
  {
    text: `Team Settings`,
    to: (ctx: TNavCtx) => {
      if (!ctx.teamId) return '#'
      return `/teams/${ctx.teamId}/settings`
    },
    Icon: <SettingsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.teamId,
  },
]

// Repo-scoped navigation items
export const RepoNavItems: TNavItem[] = [
  {
    text: `Endpoints`,
    to: (ctx: TNavCtx) => {
      if (!ctx.teamId || !ctx.repoId) return '#'
      return `/teams/${ctx.teamId}/repos/${ctx.repoId}/endpoints`
    },
    Icon: <EndpointIcon />,
    visible: (ctx: TNavCtx) => !!ctx.teamId && !!ctx.repoId,
  },
  {
    text: `Functions`,
    to: (ctx: TNavCtx) => {
      if (!ctx.teamId || !ctx.repoId) return '#'
      return `/teams/${ctx.teamId}/repos/${ctx.repoId}/functions`
    },
    Icon: <FunctionIcon />,
    visible: (ctx: TNavCtx) => !!ctx.teamId && !!ctx.repoId,
  },
  {
    text: `Secrets`,
    to: (ctx: TNavCtx) => {
      if (!ctx.teamId || !ctx.repoId) return '#'
      return `/teams/${ctx.teamId}/repos/${ctx.repoId}/secrets`
    },
    Icon: <SecretIcon />,
    visible: (ctx: TNavCtx) => !!ctx.teamId && !!ctx.repoId,
  },
  {
    text: `Providers`,
    to: (ctx: TNavCtx) => {
      if (!ctx.teamId || !ctx.repoId) return '#'
      return `/teams/${ctx.teamId}/repos/${ctx.repoId}/providers`
    },
    Icon: <ProviderIcon />,
    visible: (ctx: TNavCtx) => !!ctx.teamId && !!ctx.repoId,
  },
  {
    text: `Repo Settings`,
    to: (ctx: TNavCtx) => {
      if (!ctx.teamId || !ctx.repoId) return '#'
      return `/teams/${ctx.teamId}/repos/${ctx.repoId}/settings`
    },
    Icon: <SettingsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.teamId && !!ctx.repoId,
  },
]

// Bottom navigation items (always visible)
export const BottomNavItems: TNavItem[] = [
  { to: ERoutePath.Settings, text: `Settings`, Icon: <SettingsIcon /> },
]

// AI navigation items
export const AINavItems: TNavItem[] = [
  { to: ERoutePath.AIAgents, text: `AI Agents`, Icon: <AutoAwesomeIcon /> },
  { to: ERoutePath.MCPTools, text: `MCP Tools`, Icon: <ToolIcon /> },
]
