import { Box } from '@mui/material'
import { Outlet } from 'react-router'
import { styled } from '@mui/material/styles'
import { Header } from '@tdsk/components'
import { Menu as MenuIcon } from '@mui/icons-material'
import { nav } from '@TTH/services/nav'
import { Breadcrumbs } from '@TTH/components/Breadcrumbs'
import { HeaderSettingsItems } from '@TTH/constants/nav'
import { useSidebarOpen, useUser, useOpenSessions } from '@TTH/state/selectors'
import { useThemeToggle } from '@TTH/hooks/theme/useThemeToggle'
import { Sidebar } from '@TTH/components/Sidebar/Sidebar'
import { SessionTabs } from '@TTH/components/SessionTabs/SessionTabs'
import { useTheme, useMediaQuery, IconButton } from '@mui/material'
import { SignedIn, RedirectToSignIn } from '@neondatabase/neon-js/auth/react'

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
  const [, setSidebarOpen] = useSidebarOpen()
  const { themeType, onThemeToggle } = useThemeToggle()
  const isMobile = useMediaQuery(theme.breakpoints.down(`md`))
  const openSessions = useOpenSessions()
  const hasOpenSessions = openSessions.size > 0

  return (
    <>
      <SignedIn>
        <LayoutContainer className='tdsk-layout-container'>
          <Header
            breadcrumbs={<Breadcrumbs />}
            user={user}
            menuItems={HeaderSettingsItems}
            themeType={themeType}
            onThemeToggle={onThemeToggle}
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
              <MobileToggle onClick={() => setSidebarOpen(true)}>
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
