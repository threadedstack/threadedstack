import { SidebarWidthOpen } from '@TTH/constants/values'
import { NavTree } from '@TTH/components/Sidebar/NavTree'
import { OrgSelector } from '@TTH/components/OrgSelector'
import { Divider, Box, SwipeableDrawer } from '@mui/material'
import { useOrgId, useOrgs, useSidebarOpen } from '@TTH/state/selectors'
import { openSidebar, closeSidebar } from '@TTH/actions/sidebar/toggleSidebar'

export const MobileSidebar = () => {
  const [open] = useSidebarOpen()
  const [orgs] = useOrgs()
  const [orgId] = useOrgId()
  const showOrgSelector = orgs.length > 1 || !orgId

  return (
    <SwipeableDrawer
      open={open}
      variant='temporary'
      onOpen={openSidebar}
      onClose={closeSidebar}
      className='tdsk-threads-sidebar'
      ModalProps={{ keepMounted: true }}
      sx={{
        [`& .MuiDrawer-paper`]: {
          width: SidebarWidthOpen,
          boxSizing: `border-box`,
        },
      }}
    >
      {showOrgSelector && <OrgSelector />}
      {showOrgSelector && orgId && <Divider />}
      <Box
        sx={{
          flex: 1,
          px: 0.5,
          py: 0.5,
          overflow: `auto`,
        }}
      >
        {orgId && <NavTree />}
      </Box>
    </SwipeableDrawer>
  )
}
