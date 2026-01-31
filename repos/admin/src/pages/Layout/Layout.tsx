import { Outlet } from 'react-router'
import { Sidebar } from '@TAF/components/Sidebar/Sidebar'
import { SignedIn, RedirectToSignIn } from '@neondatabase/neon-js/auth/react'
import { LayoutContainer, LayoutContent } from '@TAF/pages/Layout/Layout.styles'

const Layout = (props: any) => {
  return (
    <>
      <SignedIn>
        <LayoutContainer className='tdsk-layout-container'>
          <LayoutContent className='tdsk-page-content'>
            <Sidebar />
            <Outlet />
            {props?.children}
          </LayoutContent>
        </LayoutContainer>
      </SignedIn>
      <RedirectToSignIn />
    </>
  )
}

export default Layout
