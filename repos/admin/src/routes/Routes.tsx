import { lazy, Suspense } from 'react'
import { ERoutePath } from '@TAF/types'
import { Loading } from '@tdsk/components'
import Layout from '@TAF/pages/Layout/Layout'
import { Navigate, createBrowserRouter } from 'react-router'

const Home = lazy(() => import('@TAF/pages/Home/Home'))
const Login = lazy(() => import('@TAF/pages/Login/Login'))
const Account = lazy(() => import('@TAF/pages/Account/Account'))
const Teams = lazy(() => import('@TAF/pages/Teams/Teams'))
const Team = lazy(() => import('@TAF/pages/Teams/Team'))
const Repos = lazy(() => import('@TAF/pages/Repos/Repos'))
const Repo = lazy(() => import('@TAF/pages/Repos/Repo'))
const Providers = lazy(() => import('@TAF/pages/Providers/Providers'))
const Settings = lazy(() => import('@TAF/pages/Settings/Settings'))

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
      {
        index: true,
        Component: () => (
          <Suspense
            fallback={
              <Loading
                fixed
                full
              />
            }
          >
            <Home />
          </Suspense>
        ),
      },
      {
        path: ERoutePath.Teams,
        Component: () => (
          <Suspense
            fallback={
              <Loading
                fixed
                full
              />
            }
          >
            <Teams />
          </Suspense>
        ),
      },
      {
        path: ERoutePath.Team,
        Component: () => (
          <Suspense
            fallback={
              <Loading
                fixed
                full
              />
            }
          >
            <Team />
          </Suspense>
        ),
      },
      {
        path: ERoutePath.Repos,
        Component: () => (
          <Suspense
            fallback={
              <Loading
                fixed
                full
              />
            }
          >
            <Repos />
          </Suspense>
        ),
      },
      {
        path: ERoutePath.Repo,
        Component: () => (
          <Suspense
            fallback={
              <Loading
                fixed
                full
              />
            }
          >
            <Repo />
          </Suspense>
        ),
      },
      {
        path: ERoutePath.Providers,
        Component: () => (
          <Suspense
            fallback={
              <Loading
                fixed
                full
              />
            }
          >
            <Providers />
          </Suspense>
        ),
      },
      {
        path: ERoutePath.Settings,
        Component: () => (
          <Suspense
            fallback={
              <Loading
                fixed
                full
              />
            }
          >
            <Settings />
          </Suspense>
        ),
      },
    ],
  },
  {
    id: ERoutePath.Login,
    path: ERoutePath.Login,
    Component: () => (
      <Suspense
        fallback={
          <Loading
            fixed
            full
          />
        }
      >
        <Login />
      </Suspense>
    ),
  },
  {
    id: ERoutePath.Account,
    path: ERoutePath.Account,
    Component: () => (
      <Suspense
        fallback={
          <Loading
            fixed
            full
          />
        }
      >
        <Account />
      </Suspense>
    ),
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
