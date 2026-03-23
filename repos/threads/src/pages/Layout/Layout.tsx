import { Box } from '@mui/material'
import { Outlet } from 'react-router'
import { styled } from '@mui/material/styles'
import { Menu as MenuIcon } from '@mui/icons-material'
import { useSidebarOpen } from '@TTH/state/selectors'
import { Sidebar } from '@TTH/components/Sidebar/Sidebar'
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
  const [, setSidebarOpen] = useSidebarOpen()
  const isMobile = useMediaQuery(theme.breakpoints.down(`md`))

  return (
    <>
      <SignedIn>
        <LayoutContainer className='tdsk-layout-container'>
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
        </LayoutContainer>
      </SignedIn>
      <RedirectToSignIn />
    </>
  )
}

export default Layout
