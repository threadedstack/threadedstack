import { lazy, Suspense } from 'react'
import { ERoutePath } from '@TTH/types'
import { Loading } from '@tdsk/components'
import Layout from '@TTH/pages/Layout/Layout'
import { Navigate, createBrowserRouter } from 'react-router'
import { rootLoader, sandboxLoader } from '@TTH/routes/loaders'

// Global pages
const Home = lazy(() => import('@TTH/pages/Home/Home'))
const Login = lazy(() => import('@TTH/pages/Login/Login'))
const Project = lazy(() => import('@TTH/pages/Project/Project'))
const Session = lazy(() => import('@TTH/pages/Session/Session'))
const Sandbox = lazy(() => import('@TTH/pages/Sandbox/Sandbox'))
const Settings = lazy(() => import('@TTH/pages/Settings/Settings'))

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
      // Global settings route
      {
        path: ERoutePath.Settings,
        Component: () => <SuspensePage Component={Settings} />,
      },
      {
        path: ERoutePath.Project,
        Component: () => <SuspensePage Component={Project} />,
      },
      {
        path: ERoutePath.Session,
        Component: () => <SuspensePage Component={Session} />,
      },
      {
        loader: sandboxLoader,
        path: ERoutePath.Sandbox,
        Component: () => <SuspensePage Component={Sandbox} />,
      },
    ],
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
