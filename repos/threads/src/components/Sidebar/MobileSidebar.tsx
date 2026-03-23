import { dims } from '@tdsk/components'
import { useSidebarOpen } from '@TTH/state/selectors'
import { SBLogo } from '@TTH/components/Sidebar/SBLogo'
import { SidebarWidthOpen } from '@TTH/constants/values'
import { Toolbar, Divider, Box, SwipeableDrawer } from '@mui/material'

export type TMobileSidebar = {
  drawerOpen: boolean
  toggleDrawer: (status?: boolean) => any
}

export const MobileSidebar = (props: TMobileSidebar) => {
  const { drawerOpen, toggleDrawer } = props

  const [open, setOpen] = useSidebarOpen()

  return (
    <SwipeableDrawer
      open={open}
      variant='temporary'
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      className='tdsk-admin-sidebar'
      ModalProps={{ keepMounted: true }}
      sx={{
        [`& .MuiDrawer-paper`]: {
          width: SidebarWidthOpen,
          boxSizing: 'border-box',
        },
      }}
    >
      <Toolbar
        className='tdsk-admin-toolbar'
        sx={{
          px: [0, 1],
          display: `flex`,
          alignItems: `center`,
          height: dims.header.hpx,
          justifyContent: `space-between`,
          minHeight: `${dims.header.hpx} !important`,
        }}
      >
        <SBLogo full={true} />
      </Toolbar>

      <Box flex={1} />
      <Divider />
    </SwipeableDrawer>
  )
}
