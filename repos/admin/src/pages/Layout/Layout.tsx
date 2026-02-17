import { useEffect } from 'react'
import { Outlet } from 'react-router'
import { Menu as MenuIcon } from '@mui/icons-material'
import { useTheme, useMediaQuery, IconButton } from '@mui/material'
import { Sidebar } from '@TAF/components/Sidebar/Sidebar'
import { useActiveOrgId, useSidebarOpen } from '@TAF/state/selectors'
import { fetchProjects } from '@TAF/actions/projects/api/fetchProjects'
import { SignedIn, RedirectToSignIn } from '@neondatabase/neon-js/auth/react'
import { LayoutContainer, LayoutContent } from '@TAF/pages/Layout/Layout.styles'

const Layout = (props: any) => {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [, setSidebarOpen] = useSidebarOpen()
  const [orgId] = useActiveOrgId()

  // BUG #6: Pre-fetch projects when orgId is available so breadcrumb project selector works
  // TODO: look into other ways to accomplish this. Like adding a Project loader HOC
  useEffect(() => {
    if (orgId) fetchProjects({ orgId }).catch(() => {})
  }, [orgId])

  return (
    <>
      <SignedIn>
        <LayoutContainer className='tdsk-layout-container'>
          <LayoutContent className='tdsk-page-content'>
            <Sidebar isMobile={isMobile} />
            <Outlet />
            {props?.children}
            {isMobile && (
              <IconButton
                onClick={() => setSidebarOpen(true)}
                sx={{
                  bottom: 16,
                  left: 16,
                  zIndex: 1200,
                  boxShadow: 3,
                  position: 'fixed',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                <MenuIcon />
              </IconButton>
            )}
          </LayoutContent>
        </LayoutContainer>
      </SignedIn>
      <RedirectToSignIn />
    </>
  )
}

export default Layout
