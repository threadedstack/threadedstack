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
    to: ERoutePath.Org,
    text: `Home`,
    Icon: <HomeIcon />,
  },
  {
    to: ERoutePath.AI,
    text: `AI`,
    Icon: <AutoAwesomeIcon />,
  },
]

// Org-scoped navigation items
export const OrgNavItems: TNavItem[] = [
  {
    text: `Users`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId) return '#'
      return `/orgs/${ctx.orgId}/users`
    },
    Icon: <PersonIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  {
    text: `Repos`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId) return '#'
      return `/orgs/${ctx.orgId}/repos`
    },
    Icon: <AppsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  {
    text: `Secrets`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId) return '#'
      return `/orgs/${ctx.orgId}/secrets`
    },
    Icon: <SecretIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  {
    text: `Providers`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId) return '#'
      return `/orgs/${ctx.orgId}/providers`
    },
    Icon: <ProviderIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  {
    text: `Org Settings`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId) return '#'
      return `/orgs/${ctx.orgId}/settings`
    },
    Icon: <SettingsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
]

// Repo-scoped navigation items
export const RepoNavItems: TNavItem[] = [
  {
    text: `Endpoints`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId || !ctx.repoId) return '#'
      return `/orgs/${ctx.orgId}/repos/${ctx.repoId}/endpoints`
    },
    Icon: <EndpointIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.repoId,
  },
  {
    text: `Functions`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId || !ctx.repoId) return '#'
      return `/orgs/${ctx.orgId}/repos/${ctx.repoId}/functions`
    },
    Icon: <FunctionIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.repoId,
  },
  {
    text: `Secrets`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId || !ctx.repoId) return '#'
      return `/orgs/${ctx.orgId}/repos/${ctx.repoId}/secrets`
    },
    Icon: <SecretIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.repoId,
  },
  {
    text: `Providers`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId || !ctx.repoId) return '#'
      return `/orgs/${ctx.orgId}/repos/${ctx.repoId}/providers`
    },
    Icon: <ProviderIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.repoId,
  },
  {
    text: `Repo Settings`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId || !ctx.repoId) return '#'
      return `/orgs/${ctx.orgId}/repos/${ctx.repoId}/settings`
    },
    Icon: <SettingsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.repoId,
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
