import { SidebarContainer } from '@TTH/components/Sidebar/Sidebar.styles'

export type TDesktopSidebar = {
  drawerOpen: boolean
  toggleDrawer: (status?: boolean) => any
}

export const DesktopSidebar = (props: TDesktopSidebar) => {
  return (
    <SidebarContainer className='tdsk-admin-sidebar'>Threads Sidebar</SidebarContainer>
  )
}
