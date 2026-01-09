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

// Team pages
const TeamSelect = lazy(() => import('@TAF/pages/Teams/Teams'))
const Team = lazy(() => import('@TAF/pages/Teams/Team'))
const TeamUsers = lazy(() => import('@TAF/pages/Teams/TeamUsers'))
const TeamSecrets = lazy(() => import('@TAF/pages/Teams/TeamSecrets'))
const TeamProviders = lazy(() => import('@TAF/pages/Teams/TeamProviders'))
const TeamSettings = lazy(() => import('@TAF/pages/Teams/TeamSettings'))
const TeamRepos = lazy(() => import('@TAF/pages/Teams/TeamRepos'))

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
      // Home route - Team selection at root
      {
        index: true,
        Component: () => <SuspensePage Component={Home} />,
      },
      // Team selection route
      {
        path: 'teams',
        Component: () => <SuspensePage Component={TeamSelect} />,
      },
      // Nested team routes
      {
        path: 'teams/:teamId',
        children: [
          // Team dashboard
          {
            index: true,
            Component: () => <SuspensePage Component={Team} />,
          },
          // Team sub-pages
          {
            path: 'users',
            Component: () => <SuspensePage Component={TeamUsers} />,
          },
          {
            path: 'secrets',
            Component: () => <SuspensePage Component={TeamSecrets} />,
          },
          {
            path: 'providers',
            Component: () => <SuspensePage Component={TeamProviders} />,
          },
          {
            path: 'settings',
            Component: () => <SuspensePage Component={TeamSettings} />,
          },
          // Repo selection for this team
          {
            path: 'repos',
            Component: () => <SuspensePage Component={TeamRepos} />,
          },
          // Nested repo routes under team
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
