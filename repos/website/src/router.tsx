import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'

const Landing = lazy(() => import('@TAF/pages/Landing'))
const Pricing = lazy(() => import('@TAF/pages/Pricing'))
const UseCases = lazy(() => import('@TAF/pages/UseCases'))
const Features = lazy(() => import('@TAF/pages/Features'))
const DocsPage = lazy(() => import('@TAF/pages/docs/DocsPage'))
const DocsLayout = lazy(() => import('@TAF/layouts/DocsLayout'))
const MarketingLayout = lazy(() => import('@TAF/layouts/MarketingLayout'))

const S = ({ C }: { C: React.ComponentType }) => (
  <Suspense fallback={<div />}>
    <C />
  </Suspense>
)

export const router = createBrowserRouter([
  {
    path: `/`,
    Component: () => <S C={MarketingLayout} />,
    children: [
      { index: true, Component: () => <S C={Landing} /> },
      { path: `features`, Component: () => <S C={Features} /> },
      { path: `pricing`, Component: () => <S C={Pricing} /> },
      { path: `use-cases`, Component: () => <S C={UseCases} /> },
    ],
  },
  {
    path: `/docs`,
    Component: () => <S C={DocsLayout} />,
    children: [
      { index: true, Component: () => <S C={DocsPage} /> },
      { path: `*`, Component: () => <S C={DocsPage} /> },
    ],
  },
  {
    path: `*`,
    Component: () => (
      <Navigate
        replace
        to='/'
      />
    ),
  },
])
