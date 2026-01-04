import { Toaster } from 'sonner'
import { Outlet } from 'react-router'
import { useTheme } from '@mui/material/styles'
import { Sidebar } from '@TAF/components/Sidebar/Sidebar'
import { SignedIn, RedirectToSignIn } from '@neondatabase/neon-js/auth/react'
import { LayoutContainer, LayoutContent } from '@TAF/pages/Layout/Layout.styles'

const Layout = (props: any) => {
  const theme = useTheme()

  return (
    <>
      <SignedIn>
        <LayoutContainer className='tdsk-layout-container' >
          <Toaster
            richColors
            closeButton
            position='bottom-left'
            className='tdsk-toast'
            theme={theme.palette.mode}
            toastOptions={{
              style: {
                color: theme.palette.text.primary,
                fontFamily: theme.typography.fontFamily,
                background: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`,
              },
            }}
          />
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
