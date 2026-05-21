import { NavRail } from '@tdsk/components'
import { SidebarTree } from '@TTH/components/Sidebar/SidebarTree'
import { SidebarFooter } from '@TTH/components/Sidebar/SidebarFooter'
import { SidebarHeader } from '@TTH/components/Sidebar/SidebarHeader'
import { MobileSidebar } from '@TTH/components/Sidebar/MobileSidebar'

export type TSidebar = {
  isMobile?: boolean
}

export const Sidebar = (props: TSidebar) => {
  const { isMobile } = props

  if (isMobile) return <MobileSidebar />

  return (
    <NavRail
      header={<SidebarHeader />}
      footer={<SidebarFooter />}
    >
      <SidebarTree />
    </NavRail>
  )
}
