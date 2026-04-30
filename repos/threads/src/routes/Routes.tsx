import { lazy, Suspense } from 'react'
import { ERoutePath } from '@TTH/types'
import { Loading } from '@tdsk/components'
import Layout from '@TTH/pages/Layout/Layout'
import { Navigate, createBrowserRouter } from 'react-router'
import {
  rootLoader,
  sandboxLoader,
  orgScopeLoader,
  projectScopeLoader,
} from '@TTH/routes/loaders'

// Global pages
const Home = lazy(() => import('@TTH/pages/Home/Home'))
const Orgs = lazy(() => import('@TTH/pages/Orgs/Orgs'))
const Login = lazy(() => import('@TTH/pages/Login/Login'))
const Project = lazy(() => import('@TTH/pages/Project/Project'))
const Session = lazy(() => import('@TTH/pages/Session/Session'))
const Sandbox = lazy(() => import('@TTH/pages/Sandbox/Sandbox'))
const CliAuth = lazy(() => import('@TTH/pages/CliAuth/CliAuth'))
const Settings = lazy(() => import('@TTH/pages/Settings/Settings'))
const Projects = lazy(() => import('@TTH/pages/Projects/Projects'))

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
    loader: rootLoader,
    id: ERoutePath.Home,
    path: ERoutePath.Home,
    hydrateFallbackElement: (
      <Loading
        fixed
        full
      />
    ),
    Component: () => <SuspensePage Component={() => <Layout />} />,
    children: [
      {
        index: true,
        Component: () => <SuspensePage Component={Home} />,
      },
      {
        path: ERoutePath.Settings,
        Component: () => <SuspensePage Component={Settings} />,
      },
      {
        path: ERoutePath.Orgs,
        Component: () => <SuspensePage Component={Orgs} />,
      },
      {
        path: ERoutePath.OrgScope,
        loader: orgScopeLoader,
        children: [
          {
            index: true,
            Component: () => (
              <Navigate
                replace
                to='projects'
              />
            ),
          },
          {
            path: ERoutePath.Projects,
            Component: () => <SuspensePage Component={Projects} />,
          },
          {
            path: ERoutePath.ProjectScope,
            loader: projectScopeLoader,
            children: [
              {
                index: true,
                Component: () => <SuspensePage Component={Project} />,
              },
              {
                loader: sandboxLoader,
                path: ERoutePath.Sandbox,
                Component: () => <SuspensePage Component={Sandbox} />,
              },
              {
                path: ERoutePath.Session,
                Component: () => <SuspensePage Component={Session} />,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: ERoutePath.CliAuth,
    path: ERoutePath.CliAuth,
    Component: () => <SuspensePage Component={CliAuth} />,
  },
  {
    id: ERoutePath.AuthPage,
    path: ERoutePath.AuthPage,
    Component: () => <SuspensePage Component={Login} />,
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
