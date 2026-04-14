import { Box, Divider } from '@mui/material'
import { OrgSelector } from '@TTH/components/OrgSelector'
import { NavTree } from '@TTH/components/Sidebar/NavTree'
import { SidebarContainer } from '@TTH/components/Sidebar/Sidebar.styles'
import { useOrgId, useOrgs } from '@TTH/state/selectors'

export type TDesktopSidebar = {
  drawerOpen: boolean
  toggleDrawer: (status?: boolean) => any
}

export const DesktopSidebar = (props: TDesktopSidebar) => {
  const orgs = useOrgs()
  const orgId = useOrgId()

  return (
    <SidebarContainer className='tdsk-admin-sidebar'>
      <Box
        sx={{
          width: 240,
          height: `100%`,
          display: `flex`,
          overflow: `hidden`,
          flexDirection: `column`,
        }}
      >
        <Box
          sx={{
            flex: 1,
            overflow: `auto`,
            px: 0.5,
            py: 0.5,
          }}
        >
          {orgId && <NavTree />}
        </Box>
      </Box>
    </SidebarContainer>
  )
}
