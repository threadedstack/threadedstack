import type {
  TNavCtx,
  TNavItem,
  TRailSection,
  TSubNavGroup,
  TSettingNavItem,
} from '@TAF/types'

import { ERoutePath } from '@TAF/types'
import { nav } from '@TAF/services/nav'
import { OrgIcon } from '@tdsk/components'
import { ERoleType, hasMinRole, isFeatureEnabled } from '@tdsk/domain'
import { buildRoute } from '@TAF/utils/nav/buildRoute'
import { signout } from '@TAF/actions/auth/local/signout'
import { RobotIcon, DrawingBoxIcon, ProjectIcon } from '@tdsk/components'
import {
  Dns as DnsIcon,
  Api as ApiIcon,
  Home as HomeIcon,
  Lock as SecretIcon,
  Timer as TimerIcon,
  Api as EndpointIcon,
  Person as PersonIcon,
  Code as FunctionIcon,
  Logout as LogoutIcon,
  BarChart as UsageIcon,
  Cloud as ProviderIcon,
  Security as SecurityIcon,
  Settings as SettingsIcon,
  CreditCard as BillingIcon,
  Extension as ExtensionIcon,
} from '@mui/icons-material'

const hasOrg = (ctx: TNavCtx) => !!ctx.orgId
const hasOrgAndProject = (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId
const hasOrgMember = (ctx: TNavCtx) =>
  hasOrg(ctx) && hasMinRole(ctx.role, ERoleType.member)
const hasOrgAdmin = (ctx: TNavCtx) => hasOrg(ctx) && hasMinRole(ctx.role, ERoleType.admin)
const hasProjectMember = (ctx: TNavCtx) =>
  hasOrgAndProject(ctx) && hasMinRole(ctx.role, ERoleType.member)
const hasProjectAdmin = (ctx: TNavCtx) =>
  hasOrgAndProject(ctx) && hasMinRole(ctx.role, ERoleType.admin)

const OrgSubNav: Record<string, TNavItem> = {
  Projects: {
    text: `Projects`,
    to: buildRoute(ERoutePath.OrgProjects),
    Icon: <ProjectIcon />,
    visible: hasOrg,
  },
  Agents: {
    text: `Agents`,
    to: buildRoute(ERoutePath.OrgAgents),
    Icon: <RobotIcon />,
    visible: (ctx) => hasOrgAdmin(ctx) && isFeatureEnabled(`agents`),
  },
  Sandboxes: {
    text: `Sandboxes`,
    to: buildRoute(ERoutePath.OrgSandboxes),
    Icon: <DrawingBoxIcon />,
    visible: hasOrgMember,
  },
  Members: {
    text: `Members`,
    to: buildRoute(ERoutePath.OrgMembers),
    Icon: <PersonIcon />,
    visible: hasOrg,
  },
  Secrets: {
    text: `Secrets`,
    to: buildRoute(ERoutePath.OrgSecrets),
    Icon: <SecretIcon />,
    visible: hasOrgMember,
  },
  Providers: {
    text: `Providers`,
    to: buildRoute(ERoutePath.OrgProviders),
    Icon: <ProviderIcon />,
    visible: hasOrgMember,
  },
  Domains: {
    text: `Domains`,
    to: buildRoute(ERoutePath.OrgDomains),
    Icon: <DnsIcon />,
    visible: hasOrgMember,
  },
  APIKeys: {
    text: `API Keys`,
    Icon: <ApiIcon />,
    to: buildRoute(ERoutePath.OrgApiKeys),
    visible: hasOrgAdmin,
  },
  Permissions: {
    text: `Permissions`,
    Icon: <SecurityIcon />,
    to: buildRoute(ERoutePath.OrgPermissions),
    visible: hasOrgAdmin,
  },
  Skills: {
    text: `Skills`,
    to: buildRoute(ERoutePath.OrgSkills),
    Icon: <ExtensionIcon />,
    visible: (ctx) => hasOrg(ctx) && isFeatureEnabled(`skills`),
  },
  Usage: {
    text: `Usage`,
    to: buildRoute(ERoutePath.OrgUsage),
    Icon: <UsageIcon />,
    visible: hasOrgMember,
  },
  Settings: {
    text: `Settings`,
    to: buildRoute(ERoutePath.OrgSettings),
    Icon: <SettingsIcon />,
    visible: hasOrgAdmin,
  },
}

const ProjectSubNav: Record<string, TNavItem> = {
  Endpoints: {
    text: `Endpoints`,
    to: buildRoute(ERoutePath.ProjectEndpoints),
    Icon: <EndpointIcon />,
    visible: hasOrgAndProject,
  },
  Functions: {
    text: `Functions`,
    to: buildRoute(ERoutePath.ProjectFunctions),
    Icon: <FunctionIcon />,
    visible: hasOrgAndProject,
  },
  Secrets: {
    text: `Secrets`,
    to: buildRoute(ERoutePath.ProjectSecrets),
    Icon: <SecretIcon />,
    visible: hasProjectMember,
  },
  Agents: {
    text: `Agents`,
    Icon: <RobotIcon />,
    to: buildRoute(ERoutePath.ProjectAgents),
    visible: (ctx) => hasOrgAndProject(ctx) && isFeatureEnabled(`agents`),
  },
  Sandboxes: {
    text: `Sandboxes`,
    to: buildRoute(ERoutePath.ProjectSandboxes),
    Icon: <DrawingBoxIcon />,
    visible: hasProjectMember,
  },
  Members: {
    text: `Members`,
    Icon: <PersonIcon />,
    to: buildRoute(ERoutePath.ProjectMembers),
    visible: hasOrgAndProject,
  },
  Domains: {
    text: `Domains`,
    to: buildRoute(ERoutePath.ProjectDomains),
    Icon: <DnsIcon />,
    visible: hasProjectMember,
  },
  APIKeys: {
    text: `API Keys`,
    Icon: <ApiIcon />,
    to: buildRoute(ERoutePath.ProjectApiKeys),
    visible: hasProjectAdmin,
  },
  Schedules: {
    text: `Schedules`,
    to: buildRoute(ERoutePath.ProjectSchedules),
    Icon: <TimerIcon />,
    visible: (ctx) => hasOrgAndProject(ctx) && isFeatureEnabled(`schedules`),
  },
  Settings: {
    text: `Settings`,
    to: buildRoute(ERoutePath.ProjectSettings),
    Icon: <SettingsIcon />,
    visible: hasProjectAdmin,
  },
}

export const HeaderSettingsItems: TSettingNavItem[] = [
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
  {
    to: ERoutePath.Orgs,
    text: `Organizations`,
    Icon: <OrgIcon />,
  },
  {
    to: `/${ERoutePath.Billing}`,
    text: `Billing`,
    Icon: <BillingIcon />,
  },
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
    items: [
      OrgSubNav.Projects,
      OrgSubNav.Sandboxes,
      OrgSubNav.Providers,
      OrgSubNav.Skills,
      OrgSubNav.Agents,
    ],
  },
  {
    label: `Security`,
    items: [
      OrgSubNav.Secrets,
      OrgSubNav.APIKeys,
      OrgSubNav.Permissions,
      OrgSubNav.Domains,
    ],
  },
  {
    label: `Management`,
    items: [OrgSubNav.Members, OrgSubNav.Usage, OrgSubNav.Settings],
  },
]

export const ProjectSubNavGroups: TSubNavGroup[] = [
  {
    label: `Development`,
    items: [
      ProjectSubNav.Sandboxes,
      ProjectSubNav.Schedules,
      ProjectSubNav.Endpoints,
      ProjectSubNav.Functions,
      ProjectSubNav.Agents,
    ],
  },
  {
    label: `Security`,
    items: [ProjectSubNav.Secrets, ProjectSubNav.APIKeys, ProjectSubNav.Domains],
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
    visible: hasOrg,
  },
  Project: {
    groups: [],
    id: `project`,
    label: `Project`,
    header: `Project`,
    Icon: <ProjectIcon />,
    to: buildRoute(ERoutePath.OrgProject),
    visible: hasOrgAndProject,
  },
}
