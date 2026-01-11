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
const OrgSelect = lazy(() => import('@TAF/pages/Orgs/Orgs'))
const Org = lazy(() => import('@TAF/pages/Orgs/Org'))
const OrgUsers = lazy(() => import('@TAF/pages/Orgs/OrgUsers'))
const OrgSecrets = lazy(() => import('@TAF/pages/Orgs/OrgSecrets'))
const OrgProviders = lazy(() => import('@TAF/pages/Orgs/OrgProviders'))
const OrgSettings = lazy(() => import('@TAF/pages/Orgs/OrgSettings'))
const OrgRepos = lazy(() => import('@TAF/pages/Orgs/OrgRepos'))

// Repo pages
const Repo = lazy(() => import('@TAF/pages/Repos/Repo'))
const RepoEndpoints = lazy(() => import('@TAF/pages/Repos/RepoEndpoints'))
const RepoSecrets = lazy(() => import('@TAF/pages/Repos/RepoSecrets'))
const RepoProviders = lazy(() => import('@TAF/pages/Repos/RepoProviders'))
const RepoFunctions = lazy(() => import('@TAF/pages/Repos/RepoFunctions'))
const RepoSettings = lazy(() => import('@TAF/pages/Repos/RepoSettings'))

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
      <Suspense
        fallback={
          <Loading
            fixed
            full
          />
        }
      >
        <Layout />
      </Suspense>
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
        Component: () => <SuspensePage Component={OrgSelect} />,
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
          // Repo selection for this org
          {
            path: 'repos',
            Component: () => <SuspensePage Component={OrgRepos} />,
          },
          // Nested repo routes under org
          {
            path: 'repos/:repoId',
            children: [
              // Repo dashboard
              {
                index: true,
                Component: () => <SuspensePage Component={Repo} />,
              },
              // Repo sub-pages
              {
                path: 'endpoints',
                Component: () => <SuspensePage Component={RepoEndpoints} />,
              },
              {
                path: 'secrets',
                Component: () => <SuspensePage Component={RepoSecrets} />,
              },
              {
                path: 'providers',
                Component: () => <SuspensePage Component={RepoProviders} />,
              },
              {
                path: 'functions',
                Component: () => <SuspensePage Component={RepoFunctions} />,
              },
              {
                path: 'settings',
                Component: () => <SuspensePage Component={RepoSettings} />,
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
