import { useMemo } from 'react'
import { Box } from '@mui/material'
import { hasMinRole } from '@tdsk/domain'
import { styled } from '@mui/material/styles'
import { Outlet, useLocation } from 'react-router'
import { Header } from '@TAF/components/Header/Header'
import { Menu as MenuIcon } from '@mui/icons-material'
import { HeaderSettingsItems } from '@TAF/constants/nav'
import { Sidebar } from '@TAF/components/Sidebar/Sidebar'
import { resolveRole } from '@TAF/utils/permissions/resolveRole'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { SignedIn, RedirectToSignIn } from '@neondatabase/neon-js/auth/react'
import { useTheme, useMediaQuery, IconButton, Typography } from '@mui/material'
import {
  PermissionsProvider,
  usePostHogIdentify,
  usePostHogPageView,
} from '@tdsk/components'
import {
  useSidebarOpen,
  useUser,
  useActiveOrgRole,
  useActiveOrgId,
} from '@TAF/state/selectors'

const LayoutContainer = styled(Box)(({ theme }) => {
  return `
    width: 100vw;
    height: 100vh;
    display: flex;
    overflow-x: hidden;
    flex-direction: column;
    max-height: -webkit-fill-available;
    background-color: ${theme.palette.background.default};
  `
})

const LayoutContent = styled(Box)`
  width: 100vw;
  height: 100vh;
  display: flex;
  overflow-x: hidden;
  max-height: -webkit-fill-available;
`

const MobileToggle = styled(IconButton)(({ theme }) => {
  return `
    z-index: 1200;
    box-shadow: ${theme.shadows[3]};
    position: fixed;
    left: ${theme.gutter.px};
    bottom: ${theme.gutter.px};
    background-color: ${theme.palette.primary.main};
    color: ${theme.palette.primary.contrastText};

    &:hover {
      background-color: ${theme.palette.primary.dark};
    }
  `
})

const Layout = (props: any) => {
  const theme = useTheme()
  const [user] = useUser()
  const location = useLocation()
  const [activeOrgId] = useActiveOrgId()
  const [activeOrgRole] = useActiveOrgRole()
  const [, setSidebarOpen] = useSidebarOpen()
  const isMobile = useMediaQuery(theme.breakpoints.down(`md`))

  usePostHogIdentify({
    userId: user?.id,
    email: user?.email,
    orgId: activeOrgId,
    name: user?.displayName,
  })
  usePostHogPageView(location.pathname, location.search)

  const role = resolveRole(user?.role, activeOrgRole)
  const { has, role: resolvedRole } = usePermissions()

  const filteredHeaderItems = useMemo(
    () =>
      HeaderSettingsItems.filter(
        (item) => !item.minRole || hasMinRole(role, item.minRole)
      ),
    [role]
  )

  return (
    <>
      <SignedIn>
        <PermissionsProvider role={role}>
          <LayoutContainer className='tdsk-layout-container'>
            <Header navItems={filteredHeaderItems} />
            {resolvedRole === null ? (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            ) : !has('adminPanel:read') ? (
              <Box
                sx={{
                  display: 'flex',
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <Typography variant='h5'>Access Denied</Typography>
                <Typography
                  variant='body1'
                  color='text.secondary'
                >
                  You do not have permission to access the admin panel.
                </Typography>
              </Box>
            ) : (
              <LayoutContent className='tdsk-page-content'>
                <Sidebar isMobile={isMobile} />
                <Outlet />
                {props?.children}
                {isMobile && (
                  <MobileToggle onClick={() => setSidebarOpen(true)}>
                    <MenuIcon />
                  </MobileToggle>
                )}
              </LayoutContent>
            )}
          </LayoutContainer>
        </PermissionsProvider>
      </SignedIn>
      <RedirectToSignIn />
    </>
  )
}

export default Layout
