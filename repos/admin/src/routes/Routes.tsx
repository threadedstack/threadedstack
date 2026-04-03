import { lazy, Suspense } from 'react'
import { ERoutePath } from '@TAF/types'
import { Loading } from '@tdsk/components'
import Layout from '@TAF/pages/Layout/Layout'
import { Navigate, createBrowserRouter } from 'react-router'

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
const OrgsLoader = lazy(() => import('@TAF/pages/Orgs/OrgsLoader'))
const OrgSecrets = lazy(() => import('@TAF/pages/Orgs/OrgSecrets'))
const OrgDomains = lazy(() => import('@TAF/pages/Orgs/OrgDomains'))
const OrgSettings = lazy(() => import('@TAF/pages/Orgs/OrgSettings'))
const OrgSkills = lazy(() => import('@TAF/pages/Orgs/OrgSkills'))
const OrgSchedules = lazy(() => import('@TAF/pages/Orgs/OrgSchedules'))
const OrgProviders = lazy(() => import('@TAF/pages/Orgs/OrgProviders'))
const OrgSandboxes = lazy(() => import('@TAF/pages/Orgs/OrgSandboxes'))

// Project pages
const Project = lazy(() => import('@TAF/pages/Projects/Project'))
const Projects = lazy(() => import('@TAF/pages/Projects/Projects'))
const ProjectAgents = lazy(() => import('@TAF/pages/Projects/ProjectAgents'))
const ProjectsLoader = lazy(() => import('@TAF/pages/Projects/ProjectsLoader'))
const ProjectSecrets = lazy(() => import('@TAF/pages/Projects/ProjectSecrets'))
const ProjectDomains = lazy(() => import('@TAF/pages/Projects/ProjectDomains'))
const ProjectThreads = lazy(() => import('@TAF/pages/Projects/ProjectThreads'))
const ProjectMembers = lazy(() => import('@TAF/pages/Projects/ProjectMembers'))
const ProjectApiKeys = lazy(() => import('@TAF/pages/Projects/ProjectApiKeys'))
const ProjectSettings = lazy(() => import('@TAF/pages/Projects/ProjectSettings'))
const ProjectFunctions = lazy(() => import('@TAF/pages/Projects/ProjectFunctions'))
const ProjectEndpoints = lazy(() => import('@TAF/pages/Projects/ProjectEndpoints'))
const ProjectThreadChat = lazy(() => import('@TAF/pages/Projects/ProjectThreadChat'))
const ProjectThreadDetail = lazy(() => import('@TAF/pages/Projects/ProjectThreadDetail'))

// TODO: Fix this, components should not be used as pages
const AgentChat = lazy(() => import('@TAF/components/AI/ChatView'))
const AgentLayout = lazy(() => import('@TAF/components/Agents/AgentLayout'))
const AgentDetailTab = lazy(() => import('@TAF/components/Agents/AgentDetailTab'))
const SkillsTab = lazy(() => import('@TAF/components/Skills/Skills'))
const SchedulesTab = lazy(() => import('@TAF/components/Schedules/Schedules'))
const EndpointLayout = lazy(() => import('@TAF/components/Endpoints/EndpointLayout'))
const EndpointTab = lazy(() => import('@TAF/components/Endpoints/Tabs/EndpointTab'))
const EndpointTestTab = lazy(
  () => import('@TAF/components/Endpoints/Tabs/EndpointTestTab')
)
const EndpointConfigTab = lazy(
  () => import('@TAF/components/Endpoints/Tabs/EndpointConfigTab')
)

// Helper component to wrap pages in Suspense
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

export const Routes = createBrowserRouter([
  {
    id: ERoutePath.Home,
    path: ERoutePath.Home,
    hydrateFallbackElement: (
      <Loading
        fixed
        full
      />
    ),
    Component: () => (
      <SuspensePage
        Component={() => (
          <OrgsLoader>
            <Layout />
          </OrgsLoader>
        )}
      />
    ),
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
        Component: () => <SuspensePage Component={Billing} />,
      },
      {
        path: 'orgs/:orgId',
        children: [
          {
            index: true,
            Component: () => <SuspensePage Component={Org} />,
          },
          {
            path: ERoutePath.Members,
            Component: () => <SuspensePage Component={OrgUsers} />,
          },
          {
            path: ERoutePath.Secrets,
            Component: () => <SuspensePage Component={OrgSecrets} />,
          },
          {
            path: ERoutePath.Domains,
            Component: () => <SuspensePage Component={OrgDomains} />,
          },
          {
            path: ERoutePath.Providers,
            Component: () => <SuspensePage Component={OrgProviders} />,
          },
          {
            path: ERoutePath.Sandboxes,
            Component: () => <SuspensePage Component={OrgSandboxes} />,
          },
          {
            path: ERoutePath.Settings,
            Component: () => <SuspensePage Component={OrgSettings} />,
          },
          {
            path: ERoutePath.Usage,
            Component: () => <SuspensePage Component={OrgUsage} />,
          },
          {
            path: ERoutePath.Skills,
            Component: () => <SuspensePage Component={OrgSkills} />,
          },
          {
            path: ERoutePath.Schedules,
            Component: () => <SuspensePage Component={OrgSchedules} />,
          },
          {
            path: ERoutePath.ApiKeys,
            Component: () => <SuspensePage Component={OrgApiKeys} />,
          },
          {
            path: ERoutePath.Agents,
            Component: () => <SuspensePage Component={OrgAgents} />,
          },
          {
            path: ERoutePath.Projects,
            Component: () => (
              <SuspensePage
                Component={() => (
                  <ProjectsLoader>
                    <Projects />
                  </ProjectsLoader>
                )}
              />
            ),
          },
          {
            path: ERoutePath.ProjectId,
            Component: () => <SuspensePage Component={ProjectsLoader} />,
            children: [
              {
                index: true,
                Component: () => <SuspensePage Component={Project} />,
              },
              {
                path: ERoutePath.Endpoints,
                Component: () => <SuspensePage Component={ProjectEndpoints} />,
              },
              {
                path: ERoutePath.Endpoint,
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
                Component: () => <SuspensePage Component={ProjectSecrets} />,
              },
              {
                path: ERoutePath.Domains,
                Component: () => <SuspensePage Component={ProjectDomains} />,
              },
              {
                path: ERoutePath.Functions,
                Component: () => <SuspensePage Component={ProjectFunctions} />,
              },
              {
                path: ERoutePath.Agents,
                Component: () => <SuspensePage Component={ProjectAgents} />,
              },
              {
                path: ERoutePath.Agent,
                Component: () => <SuspensePage Component={AgentLayout} />,
                children: [
                  {
                    index: true,
                    Component: () => <SuspensePage Component={AgentDetailTab} />,
                  },
                  {
                    path: `threads`,
                    Component: () => <SuspensePage Component={ProjectThreads} />,
                  },
                  {
                    path: `chat`,
                    Component: () => <SuspensePage Component={AgentChat} />,
                  },
                  {
                    path: ERoutePath.AgentThreadDetail,
                    Component: () => <SuspensePage Component={ProjectThreadDetail} />,
                  },
                  {
                    path: ERoutePath.AgentThreadChat,
                    Component: () => <SuspensePage Component={ProjectThreadChat} />,
                  },
                  {
                    path: `skills`,
                    Component: () => <SuspensePage Component={SkillsTab} />,
                  },
                  {
                    path: `schedules`,
                    Component: () => <SuspensePage Component={SchedulesTab} />,
                  },
                ],
              },
              {
                path: ERoutePath.ApiKeys,
                Component: () => <SuspensePage Component={ProjectApiKeys} />,
              },
              {
                path: ERoutePath.Settings,
                Component: () => <SuspensePage Component={ProjectSettings} />,
              },
              {
                path: ERoutePath.Members,
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
