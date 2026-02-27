import type { TNavCtx, TNavItem, TRailSection, TSubNavGroup } from '@TAF/types'

import { ERoutePath } from '@TAF/types'
import { nav } from '@TAF/services/nav'
import { RobotIcon } from '@tdsk/components'
import { buildRoute } from '@TAF/utils/nav/buildRoute'
import { OrgIcon } from '@TAF/components/Orgs/OrgIcon'
import { signout } from '@TAF/actions/auth/local/signout'
import { ProjectIcon } from '@TAF/components/Projects/ProjectIcon'
import {
  Dns as DnsIcon,
  Api as ApiIcon,
  Home as HomeIcon,
  Lock as SecretIcon,
  Api as EndpointIcon,
  Person as PersonIcon,
  Code as FunctionIcon,
  Logout as LogoutIcon,
  BarChart as UsageIcon,
  Settings as SettingsIcon,
  CreditCard as BillingIcon,
  CloudQueue as ProviderIcon,
} from '@mui/icons-material'

const OrgSubNav: Record<string, TNavItem> = {
  Projects: {
    text: `Projects`,
    to: buildRoute(ERoutePath.OrgProjects),
    Icon: <ProjectIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  Agents: {
    text: `Agents`,
    to: buildRoute(ERoutePath.OrgAgents),
    Icon: <RobotIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  Members: {
    text: `Members`,
    to: buildRoute(ERoutePath.OrgMembers),
    Icon: <PersonIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  Secrets: {
    text: `Secrets`,
    to: buildRoute(ERoutePath.OrgSecrets),
    Icon: <SecretIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  Providers: {
    text: `Providers`,
    to: buildRoute(ERoutePath.OrgProviders),
    Icon: <ProviderIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  Domains: {
    text: `Domains`,
    to: buildRoute(ERoutePath.OrgDomains),
    Icon: <DnsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  APIKeys: {
    text: `API Keys`,
    Icon: <ApiIcon />,
    to: buildRoute(ERoutePath.OrgApiKeys),
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  Usage: {
    text: `Usage`,
    to: buildRoute(ERoutePath.OrgUsage),
    Icon: <UsageIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  Settings: {
    text: `Settings`,
    to: buildRoute(ERoutePath.OrgSettings),
    Icon: <SettingsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
}

const ProjectSubNav: Record<string, TNavItem> = {
  Endpoints: {
    text: `Endpoints`,
    to: buildRoute(ERoutePath.ProjectEndpoints),
    Icon: <EndpointIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  Functions: {
    text: `Functions`,
    to: buildRoute(ERoutePath.ProjectFunctions),
    Icon: <FunctionIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  Secrets: {
    text: `Secrets`,
    to: buildRoute(ERoutePath.ProjectSecrets),
    Icon: <SecretIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  Agents: {
    text: `Agents`,
    Icon: <RobotIcon />,
    to: buildRoute(ERoutePath.ProjectAgents),
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  Members: {
    text: `Members`,
    Icon: <PersonIcon />,
    to: buildRoute(ERoutePath.ProjectMembers),
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
  Domains: {
    text: `Domains`,
    to: buildRoute(ERoutePath.ProjectDomains),
    Icon: <DnsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  Settings: {
    text: `Settings`,
    to: buildRoute(ERoutePath.ProjectSettings),
    Icon: <SettingsIcon />,
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
}

// Steps for the Quick Start section
export const QSSteps = [`AI Provider`, `Project & Agent`, `Review & Create`]

export const HeaderSettingsItems = [
  {
    label: `Profile`,
    Icon: PersonIcon,
    id: `tdsk-settings-nav-settings`,
    onClick: async () => nav.to(`/${ERoutePath.Profile}`),
  },
  {
    label: `Billing`,
    Icon: BillingIcon,
    id: `tdsk-settings-nav-billing`,
    onClick: async () => nav.to(`/${ERoutePath.Billing}`),
  },
  {
    divider: true,
    label: `Sign Out`,
    Icon: LogoutIcon,
    id: `tdsk-settings-nav-sign-out-user`,
    onClick: async () => await signout(),
  },
]

export const OrgNavItems: TNavItem[] = Object.values(OrgSubNav)
export const ProjectNavItems: TNavItem[] = Object.values(ProjectSubNav)

export const GlobalNavItems: TNavItem[] = [
  { to: `/${ERoutePath.Billing}`, text: `Billing`, Icon: <BillingIcon /> },
  { to: `/${ERoutePath.Profile}`, text: `Profile`, Icon: <PersonIcon /> },
]

export const HomeSubNavGroups: TSubNavGroup[] = [
  {
    label: `Navigation`,
    items: GlobalNavItems,
  },
]

export const OrgSubNavGroups: TSubNavGroup[] = [
  {
    label: `Resources`,
    items: [OrgSubNav.Projects, OrgSubNav.Members, OrgSubNav.Providers, OrgSubNav.Agents],
  },
  {
    label: `Security`,
    items: [OrgSubNav.Secrets, OrgSubNav.APIKeys, OrgSubNav.Domains],
  },
  {
    label: `Management`,
    items: [OrgSubNav.Usage, OrgSubNav.Settings],
  },
]

export const ProjectSubNavGroups: TSubNavGroup[] = [
  {
    label: `Development`,
    items: [ProjectSubNav.Endpoints, ProjectSubNav.Functions, ProjectSubNav.Agents],
  },
  {
    label: `Security`,
    items: [ProjectSubNav.Secrets, ProjectSubNav.Domains],
  },
  {
    label: `Management`,
    items: [ProjectSubNav.Members, ProjectSubNav.Settings],
  },
]

// Bottom navigation items (always visible)
export const BottomNavItems: TNavItem[] = [
  { to: `/${ERoutePath.Settings}`, text: `Settings`, Icon: <SettingsIcon /> },
]

export const RailNavSections: Record<string, TRailSection> = {
  Home: {
    id: `home`,
    label: `Home`,
    header: `Home`,
    Icon: <HomeIcon />,
    groups: HomeSubNavGroups,
  },
  Org: {
    id: `org`,
    Icon: <OrgIcon />,
    label: `Organization`,
    header: `Organization`,
    groups: OrgSubNavGroups,
    to: buildRoute(ERoutePath.Org),
    visible: (ctx: TNavCtx) => !!ctx.orgId,
  },
  Project: {
    groups: [],
    id: `project`,
    label: `Project`,
    header: `Project`,
    Icon: <ProjectIcon />,
    to: buildRoute(ERoutePath.OrgProject),
    visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
  },
}
