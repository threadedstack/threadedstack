import { useState } from 'react'
import { MobileSidebar } from '@TTH/components/Sidebar/MobileSidebar'
import { DesktopSidebar } from '@TTH/components/Sidebar/DesktopSidebar'

export type TSidebar = {
  isMobile?: boolean
}

export const Sidebar = (props: TSidebar) => {
  const { isMobile } = props
  const [drawerOpen, setDrawerOpen] = useState(false)

  return isMobile ? (
    <MobileSidebar
      drawerOpen={drawerOpen}
      toggleDrawer={setDrawerOpen}
    />
  ) : (
    <DesktopSidebar
      drawerOpen={drawerOpen}
      toggleDrawer={setDrawerOpen}
    />
  )
}
