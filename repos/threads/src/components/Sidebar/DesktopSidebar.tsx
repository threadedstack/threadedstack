import { Box, Divider } from '@mui/material'
import { useOrgId, useOrgs } from '@TTH/state/selectors'
import { OrgSelector } from '@TTH/components/OrgSelector'
import { NavTree } from '@TTH/components/Sidebar/NavTree'
import { SidebarContainer } from '@TTH/components/Sidebar/Sidebar.styles'

export const DesktopSidebar = () => {
  const [orgs] = useOrgs()
  const [orgId] = useOrgId()
  const showOrgSelector = orgs.length > 1 || !orgId

  return (
    <SidebarContainer className='tdsk-threads-sidebar'>
      <Box
        sx={{
          width: 240,
          height: `100%`,
          display: `flex`,
          overflow: `hidden`,
          flexDirection: `column`,
        }}
      >
        {showOrgSelector && <OrgSelector />}
        {showOrgSelector && orgId && <Divider />}
        <Box
          sx={{
            px: 0.5,
            py: 0.5,
            flex: 1,
            overflow: `auto`,
          }}
        >
          {orgId && <NavTree />}
        </Box>
      </Box>
    </SidebarContainer>
  )
}
