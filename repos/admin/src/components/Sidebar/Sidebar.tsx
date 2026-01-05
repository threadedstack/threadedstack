import { dims } from '@tdsk/components'
import { useSidebarOpen } from '@TAF/state/selectors'
import { SBLogo } from '@TAF/components/Sidebar/SBLogo'
import { SBNavList } from '@TAF/components/Sidebar/SBNavList'
import { NavItems, BottomNavItems } from '@TAF/constants/nav'
import {
  Toolbar,
  Divider,
} from '@mui/material'
import {
  ChevronLeft,
  ChevronRight,
} from '@mui/icons-material'
import {
  SideDrawer,
  SBToggleBox,
  SBToggleBtn,
  SBNavListSpacer,
} from '@TAF/components/Sidebar/Sidebar.styles'


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
        <SBNavList open={open} items={NavItems} />
        <SBNavListSpacer />
        <Divider />
        <SBNavList open={open} items={BottomNavItems} />
      </SideDrawer>
      <SBToggleBox>
        <SBToggleBtn onClick={() => setOpen(!open)}>
          {open ? <ChevronLeft /> : <ChevronRight />}
        </SBToggleBtn>
      </SBToggleBox>
    </>
  )
}
