import { useNavigate } from 'react-router'
import { ERoutePath } from '@TTH/types'
import { NavRail, NavRailItem } from '@tdsk/components'
import { SidebarTree } from '@TTH/components/Sidebar/SidebarTree'
import { MobileSidebar } from '@TTH/components/Sidebar/MobileSidebar'
import SettingsIcon from '@mui/icons-material/Settings'

export type TSidebar = {
  isMobile?: boolean
}

export const Sidebar = (props: TSidebar) => {
  const { isMobile } = props
  const navigate = useNavigate()

  if (isMobile) return <MobileSidebar />

  return (
    <NavRail
      footer={
        <NavRailItem
          label='Settings'
          icon={<SettingsIcon />}
          onClick={() => navigate(`/${ERoutePath.Settings}`)}
        />
      }
    >
      <SidebarTree />
    </NavRail>
  )
}
