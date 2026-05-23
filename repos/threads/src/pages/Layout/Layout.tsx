import type { PropsWithChildren } from 'react'

import { useCallback } from 'react'
import { Box } from '@mui/material'
import { nav } from '@TTH/services/nav'
import { styled } from '@mui/material/styles'
import { Outlet, useLocation } from 'react-router'
import { HeaderSettingsItems } from '@TTH/constants/nav'
import { Sidebar } from '@TTH/components/Sidebar/Sidebar'
import { FileTree } from '@TTH/components/FileTree/FileTree'
import { Breadcrumbs } from '@TTH/components/Breadcrumbs'
import { toggleTheme } from '@TTH/actions/theme/toggleTheme'
import { openSidebar } from '@TTH/actions/sidebar/toggleSidebar'
import { useTheme, useMediaQuery, IconButton } from '@mui/material'
import { openEditorFile } from '@TTH/actions/editor/openEditorFile'
import { SignedIn, RedirectToSignIn } from '@neondatabase/neon-js/auth/react'
import { Header, usePostHogIdentify, usePostHogPageView } from '@tdsk/components'
import { Search, Menu as MenuIcon, NotificationsNone } from '@mui/icons-material'
import {
  useUser,
  useOrgId,
  useThemeType,
  useFileTreeOpen,
  useOpenEditorFiles,
  useActiveEditorFile,
} from '@TTH/state/selectors'

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
  width: 100%;
  flex: 1;
  display: flex;
  overflow: hidden;
`

const MainArea = styled(Box)`
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  overflow: hidden;
  flex-direction: column;
`

const MobileToggle = styled(IconButton)(({ theme }) => {
  return `
    z-index: 1200;
    position: fixed;
    left: ${theme.gutter.px};
    bottom: ${theme.gutter.px};
    box-shadow: ${theme.shadows[3]};
    background-color: ${theme.palette.primary.main};
    color: ${theme.palette.primary.contrastText};

    &:hover {
      background-color: ${theme.palette.primary.dark};
    }
  `
})

const Layout = (props: PropsWithChildren) => {
  const theme = useTheme()
  const [user] = useUser()
  const [orgId] = useOrgId()
  const location = useLocation()
  const [themeType] = useThemeType()
  const [fileTreeOpen] = useFileTreeOpen()
  const [openFiles] = useOpenEditorFiles()
  const [activeFile] = useActiveEditorFile()
  const isMobile = useMediaQuery(theme.breakpoints.down(`md`))
  const isCompact = useMediaQuery(theme.breakpoints.down(`lg`))

  const isSessionRoute = location.pathname.includes('/session/')

  const handleOpenFile = useCallback((path: string) => {
    openEditorFile(path)
  }, [])

  usePostHogIdentify({
    orgId,
    userId: user?.id,
    email: user?.email,
    name: user?.displayName,
  })
  usePostHogPageView(location.pathname, location.search)

  const showFileTree = isSessionRoute && fileTreeOpen && !isCompact

  const sidebarRegion = isSessionRoute ? (
    <Box sx={{ display: 'flex', position: 'relative', height: '100%' }}>
      <Sidebar isMobile={isMobile} />
      <FileTree
        hidden={!showFileTree}
        onOpen={handleOpenFile}
        activeFile={activeFile}
        openFiles={openFiles}
      />
    </Box>
  ) : (
    <Sidebar isMobile={isMobile} />
  )

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
            actions={
              <>
                <IconButton
                  size='small'
                  disabled
                  title='Coming soon'
                >
                  <Search sx={{ fontSize: 20 }} />
                </IconButton>
                <IconButton
                  size='small'
                  disabled
                  title='Coming soon'
                >
                  <NotificationsNone sx={{ fontSize: 20 }} />
                </IconButton>
              </>
            }
          />
          <LayoutContent className='tdsk-page-content'>
            {sidebarRegion}
            <MainArea>
              <Outlet />
              {props.children}
            </MainArea>
          </LayoutContent>
          {isMobile && (
            <MobileToggle onClick={openSidebar}>
              <MenuIcon />
            </MobileToggle>
          )}
        </LayoutContainer>
      </SignedIn>
      <RedirectToSignIn />
    </>
  )
}

export default Layout
