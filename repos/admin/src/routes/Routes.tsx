import { ERoutePath } from '@TAF/types'
import { Loading } from '@tdsk/components'
import Layout from '@TAF/pages/Layout/Layout'
import { useMemo, lazy, Suspense } from 'react'
import { RouterProvider } from 'react-router/dom'
import { ERoleType, isFeatureEnabled } from '@tdsk/domain'
import { AppError } from '@TAF/components/AppError/AppError'
import { RequireRole } from '@TAF/components/Permissions/RequireRole'
import { Navigate, createBrowserRouter, useRouteError } from 'react-router'
import {
  rootLoader,
  billingLoader,
  orgScopeLoader,
  orgUsageLoader,
  orgAgentsLoader,
  orgDetailLoader,
  orgSkillsLoader,
  orgSkillProposalsLoader,
  orgTaskProposalsLoader,
  orgSecretsLoader,
  orgDomainsLoader,
  orgMembersLoader,
  orgApiKeysLoader,
  agentDetailLoader,
  orgProvidersLoader,
  orgSandboxesLoader,
  projectScopeLoader,
  threadDetailLoader,
  projectAgentsLoader,
  projectSecretsLoader,
  projectDomainsLoader,
  projectMembersLoader,
  projectApiKeysLoader,
  endpointDetailLoader,
  projectThreadsLoader,
  orgPermissionsLoader,
  projectSchedulesLoader,
  projectSandboxesLoader,
  projectEndpointsLoader,
  projectFunctionsLoader,
} from '@TAF/routes/loaders'

// Global pages
const Home = lazy(() => import('@TAF/pages/Home/Home'))
const Login = lazy(() => import('@TAF/pages/Login/Login'))
const Account = lazy(() => import('@TAF/pages/Account/Account'))
const Profile = lazy(() => import('@TAF/pages/Profile/Profile'))
const Billing = lazy(() => import('@TAF/pages/Billing/Billing'))
const Settings = lazy(() => import('@TAF/pages/Settings/Settings'))

// Org pages
const Org = lazy(() => import('@TAF/pages/Orgs/Org'))
const Orgs = lazy(() => import('@TAF/pages/Orgs/Orgs'))
const OrgUsers = lazy(() => import('@TAF/pages/Orgs/OrgUsers'))
const OrgUsage = lazy(() => import('@TAF/pages/Orgs/OrgUsage'))
const OrgAgents = lazy(() => import('@TAF/pages/Orgs/OrgAgents'))
const OrgApiKeys = lazy(() => import('@TAF/pages/Orgs/OrgApiKeys'))
const OrgSecrets = lazy(() => import('@TAF/pages/Orgs/OrgSecrets'))
const OrgDomains = lazy(() => import('@TAF/pages/Orgs/OrgDomains'))
const OrgSettings = lazy(() => import('@TAF/pages/Orgs/OrgSettings'))
const OrgSkills = lazy(() => import('@TAF/pages/Orgs/OrgSkills'))
const OrgSkillProposals = lazy(() => import('@TAF/pages/Orgs/OrgSkillProposals'))
const OrgTaskProposals = lazy(() => import('@TAF/pages/Orgs/OrgTaskProposals'))
const ProjectSchedules = lazy(() => import('@TAF/pages/Projects/ProjectSchedules'))
const OrgProviders = lazy(() => import('@TAF/pages/Orgs/OrgProviders'))
const OrgPermissions = lazy(() => import('@TAF/pages/Orgs/OrgPermissions'))
const OrgSandboxes = lazy(() => import('@TAF/pages/Orgs/OrgSandboxes'))

// Project pages
const Project = lazy(() => import('@TAF/pages/Projects/Project'))
const Projects = lazy(() => import('@TAF/pages/Projects/Projects'))
const ProjectAgents = lazy(() => import('@TAF/pages/Projects/ProjectAgents'))
const ProjectSecrets = lazy(() => import('@TAF/pages/Projects/ProjectSecrets'))
const ProjectDomains = lazy(() => import('@TAF/pages/Projects/ProjectDomains'))
const ProjectThreads = lazy(() => import('@TAF/pages/Projects/ProjectThreads'))
const ProjectMembers = lazy(() => import('@TAF/pages/Projects/ProjectMembers'))
const ProjectApiKeys = lazy(() => import('@TAF/pages/Projects/ProjectApiKeys'))
const ProjectSettings = lazy(() => import('@TAF/pages/Projects/ProjectSettings'))
const ProjectFunctions = lazy(() => import('@TAF/pages/Projects/ProjectFunctions'))
const ProjectEndpoints = lazy(() => import('@TAF/pages/Projects/ProjectEndpoints'))
const ProjectSandboxes = lazy(() => import('@TAF/pages/Projects/ProjectSandboxes'))
const ProjectThreadChat = lazy(() => import('@TAF/pages/Projects/ProjectThreadChat'))
const ProjectThreadDetail = lazy(() => import('@TAF/pages/Projects/ProjectThreadDetail'))

// TODO: Fix this, components should not be used as pages
const AgentChat = lazy(() => import('@TAF/components/AI/ChatView'))
const AgentLayout = lazy(() => import('@TAF/components/Agents/AgentLayout'))
const AgentDetailTab = lazy(() => import('@TAF/components/Agents/AgentDetailTab'))
const SkillsTab = lazy(() => import('@TAF/components/Skills/Skills'))
const EndpointLayout = lazy(() => import('@TAF/components/Endpoints/EndpointLayout'))
const EndpointTab = lazy(() => import('@TAF/components/Endpoints/Tabs/EndpointTab'))
const EndpointTestTab = lazy(
  () => import('@TAF/components/Endpoints/Tabs/EndpointTestTab')
)
const EndpointConfigTab = lazy(
  () => import('@TAF/components/Endpoints/Tabs/EndpointConfigTab')
)

const SuspensePage = ({ Component }: { Component: React.ComponentType }) => (
  <Suspense
    fallback={
      <Loading
        fixed
        full
      />
    }
  >
    <Component />
  </Suspense>
)

// Route error boundary that surfaces loader errors via AppError
const RouteError = () => {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : String(error)
  return <AppError message={message} />
}

export const createRoutes = () =>
  createBrowserRouter([
    {
      id: ERoutePath.Home,
      path: ERoutePath.Home,
      hydrateFallbackElement: (
        <Loading
          fixed
          full
        />
      ),
      loader: rootLoader,
      errorElement: <SuspensePage Component={RouteError} />,
      Component: () => <SuspensePage Component={Layout} />,
      children: [
        {
          index: true,
          Component: () => <SuspensePage Component={Home} />,
        },
        {
          path: 'orgs',
          Component: () => <SuspensePage Component={Orgs} />,
        },
        {
          path: 'billing',
          loader: billingLoader,
          Component: () => <SuspensePage Component={Billing} />,
        },
        {
          path: 'orgs/:orgId',
          loader: orgScopeLoader,
          children: [
            {
              index: true,
              loader: orgDetailLoader,
              Component: () => <SuspensePage Component={Org} />,
            },
            {
              path: ERoutePath.Members,
              loader: orgMembersLoader,
              Component: () => <SuspensePage Component={OrgUsers} />,
            },
            {
              path: ERoutePath.Secrets,
              loader: orgSecretsLoader,
              Component: () => <SuspensePage Component={OrgSecrets} />,
            },
            {
              path: ERoutePath.Domains,
              loader: orgDomainsLoader,
              Component: () => <SuspensePage Component={OrgDomains} />,
            },
            {
              path: ERoutePath.Providers,
              loader: orgProvidersLoader,
              Component: () => <SuspensePage Component={OrgProviders} />,
            },
            {
              path: ERoutePath.Sandboxes,
              loader: orgSandboxesLoader,
              Component: () => <SuspensePage Component={OrgSandboxes} />,
            },
            {
              path: ERoutePath.Settings,
              Component: () => (
                <RequireRole
                  minRole={ERoleType.admin}
                  Component={OrgSettings}
                />
              ),
            },
            {
              path: ERoutePath.Usage,
              loader: orgUsageLoader,
              Component: () => <SuspensePage Component={OrgUsage} />,
            },
            ...(isFeatureEnabled(`skills`)
              ? [
                  {
                    path: ERoutePath.Skills,
                    loader: orgSkillsLoader,
                    Component: () => <SuspensePage Component={OrgSkills} />,
                  },
                ]
              : []),
            {
              path: ERoutePath.SkillProposals,
              loader: orgSkillProposalsLoader,
              Component: () => <SuspensePage Component={OrgSkillProposals} />,
            },
            {
              path: ERoutePath.TaskProposals,
              loader: orgTaskProposalsLoader,
              Component: () => <SuspensePage Component={OrgTaskProposals} />,
            },
            {
              path: ERoutePath.ApiKeys,
              loader: orgApiKeysLoader,
              Component: () => (
                <RequireRole
                  minRole={ERoleType.admin}
                  Component={OrgApiKeys}
                />
              ),
            },
            {
              path: ERoutePath.Permissions,
              loader: orgPermissionsLoader,
              Component: () => (
                <RequireRole
                  minRole={ERoleType.admin}
                  Component={OrgPermissions}
                />
              ),
            },
            ...(isFeatureEnabled(`agents`)
              ? [
                  {
                    path: ERoutePath.Agents,
                    loader: orgAgentsLoader,
                    Component: () => <SuspensePage Component={OrgAgents} />,
                  },
                ]
              : []),
            {
              path: ERoutePath.Projects,
              Component: () => <SuspensePage Component={Projects} />,
            },
            {
              path: ERoutePath.ProjectId,
              loader: projectScopeLoader,
              children: [
                {
                  index: true,
                  loader: projectSandboxesLoader,
                  Component: () => <SuspensePage Component={Project} />,
                },
                {
                  path: ERoutePath.Endpoints,
                  loader: projectEndpointsLoader,
                  Component: () => <SuspensePage Component={ProjectEndpoints} />,
                },
                {
                  path: ERoutePath.Endpoint,
                  loader: endpointDetailLoader,
                  Component: () => <SuspensePage Component={EndpointLayout} />,
                  children: [
                    {
                      index: true,
                      Component: () => <SuspensePage Component={EndpointTab} />,
                    },
                    {
                      path: `config`,
                      Component: () => <SuspensePage Component={EndpointConfigTab} />,
                    },
                    {
                      path: `test`,
                      Component: () => <SuspensePage Component={EndpointTestTab} />,
                    },
                  ],
                },
                {
                  path: ERoutePath.Secrets,
                  loader: projectSecretsLoader,
                  Component: () => <SuspensePage Component={ProjectSecrets} />,
                },
                {
                  path: ERoutePath.Domains,
                  loader: projectDomainsLoader,
                  Component: () => <SuspensePage Component={ProjectDomains} />,
                },
                {
                  path: ERoutePath.Functions,
                  loader: projectFunctionsLoader,
                  Component: () => <SuspensePage Component={ProjectFunctions} />,
                },
                ...(isFeatureEnabled(`agents`)
                  ? [
                      {
                        path: ERoutePath.Agents,
                        loader: projectAgentsLoader,
                        Component: () => <SuspensePage Component={ProjectAgents} />,
                      },
                    ]
                  : []),
                {
                  path: ERoutePath.Sandboxes,
                  loader: projectSandboxesLoader,
                  Component: () => <SuspensePage Component={ProjectSandboxes} />,
                },
                ...(isFeatureEnabled(`schedules`)
                  ? [
                      {
                        path: ERoutePath.Schedules,
                        loader: projectSchedulesLoader,
                        Component: () => <SuspensePage Component={ProjectSchedules} />,
                      },
                    ]
                  : []),
                ...(isFeatureEnabled(`agents`)
                  ? [
                      {
                        path: ERoutePath.Agent,
                        loader: agentDetailLoader,
                        Component: () => <SuspensePage Component={AgentLayout} />,
                        children: [
                          {
                            index: true,
                            Component: () => <SuspensePage Component={AgentDetailTab} />,
                          },
                          {
                            path: `threads`,
                            loader: projectThreadsLoader,
                            Component: () => <SuspensePage Component={ProjectThreads} />,
                          },
                          {
                            path: `chat`,
                            Component: () => <SuspensePage Component={AgentChat} />,
                          },
                          {
                            path: ERoutePath.AgentThreadDetail,
                            loader: threadDetailLoader,
                            Component: () => (
                              <SuspensePage Component={ProjectThreadDetail} />
                            ),
                          },
                          {
                            path: ERoutePath.AgentThreadChat,
                            loader: threadDetailLoader,
                            Component: () => (
                              <SuspensePage Component={ProjectThreadChat} />
                            ),
                          },
                          ...(isFeatureEnabled(`skills`)
                            ? [
                                {
                                  path: `skills`,
                                  Component: () => <SuspensePage Component={SkillsTab} />,
                                },
                              ]
                            : []),
                        ],
                      },
                    ]
                  : []),
                {
                  path: ERoutePath.ApiKeys,
                  loader: projectApiKeysLoader,
                  Component: () => (
                    <RequireRole
                      minRole={ERoleType.admin}
                      Component={ProjectApiKeys}
                    />
                  ),
                },
                {
                  path: ERoutePath.Settings,
                  Component: () => (
                    <RequireRole
                      minRole={ERoleType.admin}
                      Component={ProjectSettings}
                    />
                  ),
                },
                {
                  path: ERoutePath.Members,
                  loader: projectMembersLoader,
                  Component: () => <SuspensePage Component={ProjectMembers} />,
                },
              ],
            },
          ],
        },
        // Global settings route
        {
          path: ERoutePath.Settings,
          Component: () => <SuspensePage Component={Settings} />,
        },
        // Profile route
        {
          path: ERoutePath.Profile,
          Component: () => <SuspensePage Component={Profile} />,
        },
      ],
    },
    {
      id: ERoutePath.AuthPage,
      path: ERoutePath.AuthPage,
      Component: () => <SuspensePage Component={Login} />,
    },
    {
      id: ERoutePath.Account,
      path: ERoutePath.Account,
      Component: () => <SuspensePage Component={Account} />,
    },
    {
      id: ERoutePath.Star,
      path: ERoutePath.Star,
      Component: () => (
        <Navigate
          replace
          to={ERoutePath.Home}
        />
      ),
    },
  ])

export const Router = () => {
  const router = useMemo(() => createRoutes(), [])
  return <RouterProvider router={router} />
}
