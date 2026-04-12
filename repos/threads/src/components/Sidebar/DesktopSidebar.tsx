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
  const showOrgSelector = orgs.length > 1 || !orgId

  return (
    <SidebarContainer className='tdsk-admin-sidebar'>
      <Box
        sx={{
          width: 240,
          display: `flex`,
          flexDirection: `column`,
          height: `100%`,
          overflow: `hidden`,
        }}
      >
        {showOrgSelector && <OrgSelector />}
        {showOrgSelector && orgId && <Divider />}
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
