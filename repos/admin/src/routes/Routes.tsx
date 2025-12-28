import { lazy, Suspense } from 'react'
import { ERoutePath } from '@TAF/types'
import { Loading } from '@tdsk/components'
import Layout from '@TAF/pages/Layout/Layout'
import { Navigate, createBrowserRouter } from 'react-router'


const Home = lazy(() => import('@TAF/pages/Home/Home'))
const Login = lazy(() => import('@TAF/pages/Login/Login'))


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
    ]
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
