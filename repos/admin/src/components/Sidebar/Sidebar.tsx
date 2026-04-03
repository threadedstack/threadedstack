import { useState } from 'react'
import { useActiveOrgId } from '@TAF/state/selectors'
import { MobileSidebar } from '@TAF/components/Sidebar/MobileSidebar'
import { DesktopSidebar } from '@TAF/components/Sidebar/DesktopSidebar'

export type TSidebar = {
  isMobile?: boolean
}

export const Sidebar = (props: TSidebar) => {
  const { isMobile } = props
  const [orgId] = useActiveOrgId()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return isMobile ? (
    <MobileSidebar
      orgId={orgId}
      drawerOpen={drawerOpen}
      toggleDrawer={setDrawerOpen}
    />
  ) : (
    <DesktopSidebar
      orgId={orgId}
      drawerOpen={drawerOpen}
      toggleDrawer={setDrawerOpen}
    />
  )
}
