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
const OrgApiKeys = lazy(() => import('@TAF/pages/Orgs/OrgApiKeys'))
const OrgsLoader = lazy(() => import('@TAF/pages/Orgs/OrgsLoader'))
const OrgSecrets = lazy(() => import('@TAF/pages/Orgs/OrgSecrets'))
const OrgDomains = lazy(() => import('@TAF/pages/Orgs/OrgDomains'))
const OrgSettings = lazy(() => import('@TAF/pages/Orgs/OrgSettings'))
const OrgProviders = lazy(() => import('@TAF/pages/Orgs/OrgProviders'))

// Project pages
const Project = lazy(() => import('@TAF/pages/Projects/Project'))
const Projects = lazy(() => import('@TAF/pages/Projects/Projects'))
const ProjectAgents = lazy(() => import('@TAF/pages/Projects/ProjectAgents'))
const ProjectsLoader = lazy(() => import('@TAF/pages/Projects/ProjectsLoader'))
const ProjectSecrets = lazy(() => import('@TAF/pages/Projects/ProjectSecrets'))
const ProjectDomains = lazy(() => import('@TAF/pages/Projects/ProjectDomains'))
const ProjectThreads = lazy(() => import('@TAF/pages/Projects/ProjectThreads'))
const ProjectSettings = lazy(() => import('@TAF/pages/Projects/ProjectSettings'))
const ProjectProviders = lazy(() => import('@TAF/pages/Projects/ProjectProviders'))
const ProjectFunctions = lazy(() => import('@TAF/pages/Projects/ProjectFunctions'))
const ProjectEndpoints = lazy(() => import('@TAF/pages/Projects/ProjectEndpoints'))

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
            path: ERoutePath.Users,
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
            path: ERoutePath.Settings,
            Component: () => <SuspensePage Component={OrgSettings} />,
          },
          {
            path: ERoutePath.Usage,
            Component: () => <SuspensePage Component={OrgUsage} />,
          },
          {
            path: ERoutePath.ApiKeys,
            Component: () => <SuspensePage Component={OrgApiKeys} />,
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
                path: ERoutePath.Secrets,
                Component: () => <SuspensePage Component={ProjectSecrets} />,
              },
              {
                path: ERoutePath.Domains,
                Component: () => <SuspensePage Component={ProjectDomains} />,
              },
              {
                path: ERoutePath.Providers,
                Component: () => <SuspensePage Component={ProjectProviders} />,
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
                path: ERoutePath.Threads,
                Component: () => <SuspensePage Component={ProjectThreads} />,
              },
              {
                path: ERoutePath.Settings,
                Component: () => <SuspensePage Component={ProjectSettings} />,
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
