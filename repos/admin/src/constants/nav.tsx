import type { TNavItem, TNavCtx } from '@TAF/types'

import { ERoutePath } from '@TAF/types'
import { nav } from '@TAF/services/nav'
import { buildRoute } from '@TAF/utils/nav/buildRoute'
import { signout } from '@TAF/actions/auth/local/signout'
import { ProjectIcon } from '@TAF/components/Projects/ProjectIcon'

import {
  Dns as DnsIcon,
  Build as ToolIcon,
  Lock as SecretIcon,
  Api as EndpointIcon,
  Person as PersonIcon,
  Code as FunctionIcon,
  Logout as LogoutIcon,
  BarChart as UsageIcon,
  Settings as SettingsIcon,
  CreditCard as BillingIcon,
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
    label: `Billing`,
    Icon: BillingIcon,
    id: `tdsk-settings-nav-billing`,
    onClick: async () => nav.to(ERoutePath.Billing),
  },
  {
    divider: true,
    label: `Sign Out`,
    Icon: LogoutIcon,
    id: `tdsk-settings-nav-sign-out-user`,
    onClick: async () => await signout(),
  },
]

// Org-scoped navigation items
export const OrgNavItems: TNavItem[] = [
  {
    text: `Projects`,
    to: buildRoute(ERoutePath.OrgProjects),
    Icon: <ProjectIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  {
    text: `Users`,
    to: buildRoute(ERoutePath.OrgUsers),
    Icon: <PersonIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  {
    text: `Secrets`,
    to: buildRoute(ERoutePath.OrgSecrets),
    Icon: <SecretIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  {
    text: `Providers`,
    to: buildRoute(ERoutePath.OrgProviders),
    Icon: <ProviderIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  {
    text: `Domains`,
    to: buildRoute(ERoutePath.OrgDomains),
    Icon: <DnsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  {
    text: `Usage`,
    to: buildRoute(ERoutePath.OrgUsage),
    Icon: <UsageIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  {
    text: `Settings`,
    to: buildRoute(ERoutePath.OrgSettings),
    Icon: <SettingsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
]

// Project-scoped navigation items
export const ProjectNavItems: TNavItem[] = [
  {
    text: `Endpoints`,
    to: buildRoute(ERoutePath.ProjectEndpoints),
    Icon: <EndpointIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  {
    text: `Functions`,
    to: buildRoute(ERoutePath.ProjectFunctions),
    Icon: <FunctionIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  {
    text: `Secrets`,
    to: buildRoute(ERoutePath.ProjectSecrets),
    Icon: <SecretIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  {
    text: `Providers`,
    to: buildRoute(ERoutePath.ProjectProviders),
    Icon: <ProviderIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  {
    text: `Agents`,
    to: buildRoute(ERoutePath.ProjectAgents),
    Icon: <AutoAwesomeIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  {
    text: `Threads`,
    to: buildRoute(ERoutePath.ProjectThreads),
    Icon: <AutoAwesomeIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  {
    text: `Domains`,
    to: buildRoute(ERoutePath.ProjectDomains),
    Icon: <DnsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  {
    text: `Settings`,
    to: buildRoute(ERoutePath.ProjectSettings),
    Icon: <SettingsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
]

// Bottom navigation items (always visible)
export const BottomNavItems: TNavItem[] = [
  { to: ERoutePath.Settings, text: `Settings`, Icon: <SettingsIcon /> },
]
