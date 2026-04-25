import { MobileSidebar } from '@TTH/components/Sidebar/MobileSidebar'
import { DesktopSidebar } from '@TTH/components/Sidebar/DesktopSidebar'

export type TSidebar = {
  isMobile?: boolean
}

export const Sidebar = (props: TSidebar) => {
  const { isMobile } = props

  return isMobile ? <MobileSidebar /> : <DesktopSidebar />
}
