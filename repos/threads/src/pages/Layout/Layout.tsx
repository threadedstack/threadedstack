import { Box } from '@mui/material'
import { nav } from '@TTH/services/nav'
import { styled } from '@mui/material/styles'
import { Outlet, useLocation } from 'react-router'
import { Menu as MenuIcon } from '@mui/icons-material'
import { HeaderSettingsItems } from '@TTH/constants/nav'
import { Sidebar } from '@TTH/components/Sidebar/Sidebar'
import { Breadcrumbs } from '@TTH/components/Breadcrumbs'
import { toggleTheme } from '@TTH/actions/theme/toggleTheme'
import { openSidebar } from '@TTH/actions/sidebar/toggleSidebar'
import { useTheme, useMediaQuery, IconButton } from '@mui/material'
import { SessionTabs } from '@TTH/components/SessionTabs/SessionTabs'
import { SignedIn, RedirectToSignIn } from '@neondatabase/neon-js/auth/react'
import { Header, usePostHogIdentify, usePostHogPageView } from '@tdsk/components'
import { useThemeType, useUser, useOrgId, useOpenSessions } from '@TTH/state/selectors'

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
  flex: 1;
  width: 100vw;
  display: flex;
  overflow: hidden;
`

const MainContent = styled(Box)`
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
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
  const [orgId] = useOrgId()
  const location = useLocation()
  const [themeType] = useThemeType()
  const [openSessions] = useOpenSessions()
  const hasOpenSessions = openSessions.size > 0
  const isMobile = useMediaQuery(theme.breakpoints.down(`md`))

  usePostHogIdentify({
    orgId,
    userId: user?.id,
    email: user?.email,
    name: user?.displayName,
  })
  usePostHogPageView(location.pathname, location.search)

  return (
    <>
      <SignedIn>
        <LayoutContainer className='tdsk-layout-container'>
          <Header
            user={user}
            themeType={themeType}
            onThemeToggle={toggleTheme}
            breadcrumbs={<Breadcrumbs />}
            menuItems={HeaderSettingsItems}
            onNavigateHome={() => nav.home()}
          />
          <LayoutContent className='tdsk-page-content'>
            <Sidebar isMobile={isMobile} />
            <MainContent>
              {!isMobile && hasOpenSessions && <SessionTabs />}
              <Outlet />
              {props?.children}
            </MainContent>
            {isMobile && (
              <MobileToggle onClick={openSidebar}>
                <MenuIcon />
              </MobileToggle>
            )}
          </LayoutContent>
        </LayoutContainer>
      </SignedIn>
      <RedirectToSignIn />
    </>
  )
}

export default Layout
