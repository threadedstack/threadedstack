import type { TNavItem, TNavContext, TDynamicNavConfig } from '@TAF/types'
import { ERoutePath } from '@TAF/types'
import { nav } from '@TAF/services/nav'
import { signout } from '@TAF/actions/auth/local/signout'
import {
  Apps as AppsIcon,
  Home as HomeIcon,
  Group as TeamIcon,
  Build as ToolIcon,
  Code as FunctionIcon,
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

// Global navigation items (always visible)
export const GlobalNavItems: TNavItem[] = [
  {
    to: ERoutePath.Teams,
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
    to: (ctx: TNavContext) => {
      if (!ctx.teamId) return '#'
      return `/teams/${ctx.teamId}/users`
    },
    Icon: <PersonIcon />,
    visible: (ctx: TNavContext) => !!ctx.teamId,
  },
  {
    text: `Repos`,
    to: (ctx: TNavContext) => {
      if (!ctx.teamId) return '#'
      return `/teams/${ctx.teamId}/repos`
    },
    Icon: <AppsIcon />,
    visible: (ctx: TNavContext) => !!ctx.teamId,
  },
  {
    text: `Secrets`,
    to: (ctx: TNavContext) => {
      if (!ctx.teamId) return '#'
      return `/teams/${ctx.teamId}/secrets`
    },
    Icon: <SecretIcon />,
    visible: (ctx: TNavContext) => !!ctx.teamId,
  },
  {
    text: `Providers`,
    to: (ctx: TNavContext) => {
      if (!ctx.teamId) return '#'
      return `/teams/${ctx.teamId}/providers`
    },
    Icon: <ProviderIcon />,
    visible: (ctx: TNavContext) => !!ctx.teamId,
  },
  {
    text: `Team Settings`,
    to: (ctx: TNavContext) => {
      if (!ctx.teamId) return '#'
      return `/teams/${ctx.teamId}/settings`
    },
    Icon: <SettingsIcon />,
    visible: (ctx: TNavContext) => !!ctx.teamId,
  },
]

// Repo-scoped navigation items
export const RepoNavItems: TNavItem[] = [
  {
    text: `Endpoints`,
    to: (ctx: TNavContext) => {
      if (!ctx.teamId || !ctx.repoId) return '#'
      return `/teams/${ctx.teamId}/repos/${ctx.repoId}/endpoints`
    },
    Icon: <EndpointIcon />,
    visible: (ctx: TNavContext) => !!ctx.teamId && !!ctx.repoId,
  },
  {
    text: `Functions`,
    to: (ctx: TNavContext) => {
      if (!ctx.teamId || !ctx.repoId) return '#'
      return `/teams/${ctx.teamId}/repos/${ctx.repoId}/functions`
    },
    Icon: <FunctionIcon />,
    visible: (ctx: TNavContext) => !!ctx.teamId && !!ctx.repoId,
  },
  {
    text: `Secrets`,
    to: (ctx: TNavContext) => {
      if (!ctx.teamId || !ctx.repoId) return '#'
      return `/teams/${ctx.teamId}/repos/${ctx.repoId}/secrets`
    },
    Icon: <SecretIcon />,
    visible: (ctx: TNavContext) => !!ctx.teamId && !!ctx.repoId,
  },
  {
    text: `Providers`,
    to: (ctx: TNavContext) => {
      if (!ctx.teamId || !ctx.repoId) return '#'
      return `/teams/${ctx.teamId}/repos/${ctx.repoId}/providers`
    },
    Icon: <ProviderIcon />,
    visible: (ctx: TNavContext) => !!ctx.teamId && !!ctx.repoId,
  },
  {
    text: `Repo Settings`,
    to: (ctx: TNavContext) => {
      if (!ctx.teamId || !ctx.repoId) return '#'
      return `/teams/${ctx.teamId}/repos/${ctx.repoId}/settings`
    },
    Icon: <SettingsIcon />,
    visible: (ctx: TNavContext) => !!ctx.teamId && !!ctx.repoId,
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

/**
 * Get dynamic navigation configuration based on context
 * @param context - Current navigation context (teamId, repoId, etc.)
 * @returns Dynamic navigation configuration with sections and bottom items
 */
export const getDynamicNavConfig = (context: TNavContext): TDynamicNavConfig => {
  const sections = []

  // Global section (always visible)
  sections.push({
    id: 'global',
    items: GlobalNavItems,
  })

  // Team section (visible when teamId is present)
  if (context.teamId) {
    sections.push({
      id: 'team',
      header: context.teamName || 'Team',
      items: TeamNavItems,
      visible: (ctx: TNavContext) => !!ctx.teamId,
    })
  }

  // Repo section (visible when teamId and repoId are present)
  if (context.teamId && context.repoId) {
    sections.push({
      id: 'repo',
      header: context.repoName || 'Repository',
      items: RepoNavItems,
      visible: (ctx: TNavContext) => !!ctx.teamId && !!ctx.repoId,
    })
  }

  return {
    sections,
    bottomItems: BottomNavItems,
  }
}

// Legacy exports for backward compatibility
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
