import { lazy, Suspense } from 'react'
import { ERoutePath } from '@TTH/types'
import { Loading } from '@tdsk/components'
import Layout from '@TTH/pages/Layout/Layout'
import { Navigate, createBrowserRouter } from 'react-router'

// Global pages
const Home = lazy(() => import('@TTH/pages/Home/Home'))
const Login = lazy(() => import('@TTH/pages/Login/Login'))
const Settings = lazy(() => import('@TTH/pages/Settings/Settings'))

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
