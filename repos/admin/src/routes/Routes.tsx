import { lazy, Suspense } from 'react'
import { ERoutePath } from '@TAF/types'
import { Loading } from '@tdsk/components'
import Layout from '@TAF/pages/Layout/Layout'
import { Navigate, createBrowserRouter } from 'react-router'

// Global pages
const Home = lazy(() => import('@TAF/pages/Home/Home'))
const Login = lazy(() => import('@TAF/pages/Login/Login'))
const Account = lazy(() => import('@TAF/pages/Account/Account'))
const Settings = lazy(() => import('@TAF/pages/Settings/Settings'))

// Org pages

const Org = lazy(() => import('@TAF/pages/Orgs/Org'))
const Orgs = lazy(() => import('@TAF/pages/Orgs/Orgs'))
const OrgUsers = lazy(() => import('@TAF/pages/Orgs/OrgUsers'))
const OrgsLoader = lazy(() => import('@TAF/pages/Orgs/OrgsLoader'))
const OrgSecrets = lazy(() => import('@TAF/pages/Orgs/OrgSecrets'))
const OrgProviders = lazy(() => import('@TAF/pages/Orgs/OrgProviders'))
const OrgSettings = lazy(() => import('@TAF/pages/Orgs/OrgSettings'))
const OrgProjects = lazy(() => import('@TAF/pages/Orgs/OrgProjects'))

// Project pages
const Project = lazy(() => import('@TAF/pages/Projects/Project'))
const ProjectsLoader = lazy(() => import('@TAF/pages/Projects/ProjectsLoader'))
const ProjectEndpoints = lazy(() => import('@TAF/pages/Projects/ProjectEndpoints'))
const ProjectSecrets = lazy(() => import('@TAF/pages/Projects/ProjectSecrets'))
const ProjectProviders = lazy(() => import('@TAF/pages/Projects/ProjectProviders'))
const ProjectFunctions = lazy(() => import('@TAF/pages/Projects/ProjectFunctions'))
const ProjectSettings = lazy(() => import('@TAF/pages/Projects/ProjectSettings'))

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
      // Home route - Org selection at root
      {
        index: true,
        Component: () => <SuspensePage Component={Home} />,
      },
      // Org selection route
      {
        path: 'orgs',
        Component: () => <SuspensePage Component={Orgs} />,
      },
      // Nested org routes
      {
        path: 'orgs/:orgId',
        children: [
          // Org dashboard
          {
            index: true,
            Component: () => <SuspensePage Component={Org} />,
          },
          // Org sub-pages
          {
            path: 'users',
            Component: () => <SuspensePage Component={OrgUsers} />,
          },
          {
            path: 'secrets',
            Component: () => <SuspensePage Component={OrgSecrets} />,
          },
          {
            path: 'providers',
            Component: () => <SuspensePage Component={OrgProviders} />,
          },
          {
            path: 'settings',
            Component: () => <SuspensePage Component={OrgSettings} />,
          },
          // Project selection for this org
          {
            path: 'projects',
            Component: () => (
              <SuspensePage
                Component={() => (
                  <ProjectsLoader>
                    <OrgProjects />
                  </ProjectsLoader>
                )}
              />
            ),
          },
          // Nested project routes under org
          {
            path: 'projects/:projectId',
            Component: () => <SuspensePage Component={ProjectsLoader} />,
            children: [
              // Project dashboard
              {
                index: true,
                Component: () => <SuspensePage Component={Project} />,
              },
              // Project sub-pages
              {
                path: 'endpoints',
                Component: () => <SuspensePage Component={ProjectEndpoints} />,
              },
              {
                path: 'secrets',
                Component: () => <SuspensePage Component={ProjectSecrets} />,
              },
              {
                path: 'providers',
                Component: () => <SuspensePage Component={ProjectProviders} />,
              },
              {
                path: 'functions',
                Component: () => <SuspensePage Component={ProjectFunctions} />,
              },
              {
                path: 'settings',
                Component: () => <SuspensePage Component={ProjectSettings} />,
              },
            ],
          },
        ],
      },
      // Global settings route
      {
        path: 'settings',
        Component: () => <SuspensePage Component={Settings} />,
      },
    ],
  },
  // Auth routes outside layout
  {
    id: ERoutePath.Login,
    path: ERoutePath.Login,
    Component: () => <SuspensePage Component={Login} />,
  },
  {
    id: ERoutePath.Account,
    path: ERoutePath.Account,
    Component: () => <SuspensePage Component={Account} />,
  },
  // Catch-all redirect
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
