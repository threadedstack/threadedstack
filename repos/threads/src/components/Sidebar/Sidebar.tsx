import { NavRail } from '@tdsk/components'
import { SidebarTree } from '@TTH/components/Sidebar/SidebarTree'
import { MobileSidebar } from '@TTH/components/Sidebar/MobileSidebar'

export type TSidebar = {
  isMobile?: boolean
}

export const Sidebar = (props: TSidebar) => {
  const { isMobile } = props

  if (isMobile) return <MobileSidebar />

  return (
    <NavRail>
      <SidebarTree />
    </NavRail>
  )
}
