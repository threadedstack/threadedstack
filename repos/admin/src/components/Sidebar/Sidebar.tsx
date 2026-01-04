import { dims } from '@tdsk/components'
import { NavItems } from '@TAF/constants/nav'
import { useSidebarOpen } from '@TAF/state/selectors'
import { SBLogo } from '@TAF/components/Sidebar/SBLogo'
import { SBNavList } from '@TAF/components/Sidebar/SBNavList'
import { SideDrawer, SBToggleBox, SBToggleBtn } from '@TAF/components/Sidebar/Sidebar.styles'
import {
  Toolbar,
  Divider,
} from '@mui/material'
import {
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material'


export type TSidebar = {}

export const Sidebar = (props:TSidebar) => {

  const [open, setOpen] = useSidebarOpen()

  return (
    <>
      <SideDrawer
        open={open}
        variant="permanent"
        onClick={() => !open && setOpen(true)}
      >
        <Toolbar
          sx={{
            display: `flex`,
            alignItems: `center`,
            height: dims.header.hpx,
            justifyContent: `space-between`,
            minHeight: `${dims.header.hpx} !important`,
            px: [0, 1],
          }}
        >
          <SBLogo full={open} />
        </Toolbar>
        <Divider />
        <SBNavList open={open} items={NavItems} />
      </SideDrawer>
      <SBToggleBox>
        <SBToggleBtn onClick={() => setOpen(!open)}>
          {open ? <ChevronLeft /> : <ChevronRight />}
        </SBToggleBtn>
      </SBToggleBox>
    </>
  )
}
