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
export const GlobalNavItems: TNavItem[] = []

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
    text: `Projects`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId) return '#'
      return `/orgs/${ctx.orgId}/projects`
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
    text: `AI`,
    Icon: <AutoAwesomeIcon />,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId) return '#'
      return `/orgs/${ctx.orgId}/ai`
    },
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

// Project-scoped navigation items
export const ProjectNavItems: TNavItem[] = [
  {
    text: `Endpoints`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId || !ctx.projectId) return '#'
      return `/orgs/${ctx.orgId}/projects/${ctx.projectId}/endpoints`
    },
    Icon: <EndpointIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  {
    text: `Functions`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId || !ctx.projectId) return '#'
      return `/orgs/${ctx.orgId}/projects/${ctx.projectId}/functions`
    },
    Icon: <FunctionIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  {
    text: `Secrets`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId || !ctx.projectId) return '#'
      return `/orgs/${ctx.orgId}/projects/${ctx.projectId}/secrets`
    },
    Icon: <SecretIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  {
    text: `Providers`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId || !ctx.projectId) return '#'
      return `/orgs/${ctx.orgId}/projects/${ctx.projectId}/providers`
    },
    Icon: <ProviderIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  {
    text: `Project Settings`,
    to: (ctx: TNavCtx) => {
      if (!ctx.orgId || !ctx.projectId) return '#'
      return `/orgs/${ctx.orgId}/projects/${ctx.projectId}/settings`
    },
    Icon: <SettingsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
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
