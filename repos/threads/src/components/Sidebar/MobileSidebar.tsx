import { useSidebarOpen, useOrgId, useOrgs } from '@TTH/state/selectors'
import { NavTree } from '@TTH/components/Sidebar/NavTree'
import { OrgSelector } from '@TTH/components/OrgSelector'
import { SidebarWidthOpen } from '@TTH/constants/values'
import { Divider, Box, SwipeableDrawer } from '@mui/material'

export type TMobileSidebar = {
  drawerOpen: boolean
  toggleDrawer: (status?: boolean) => any
}

export const MobileSidebar = (props: TMobileSidebar) => {
  const { drawerOpen, toggleDrawer } = props

  const [open, setOpen] = useSidebarOpen()
  const orgs = useOrgs()
  const orgId = useOrgId()
  const showOrgSelector = orgs.length > 1 || !orgId

  return (
    <SwipeableDrawer
      open={open}
      variant='temporary'
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
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
          overflow: `auto`,
          px: 0.5,
          py: 0.5,
        }}
      >
        {orgId && <NavTree />}
      </Box>
    </SwipeableDrawer>
  )
}
