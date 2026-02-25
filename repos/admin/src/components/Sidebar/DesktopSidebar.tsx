import type { TRailSectionId } from '@TAF/types'

import { useNavigate } from 'react-router'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { useRailNav } from '@TAF/hooks/nav/useRailNav'
import { useActiveProjectId } from '@TAF/state/selectors'
import { NavRail } from '@TAF/components/Sidebar/NavRail'
import { SubNavPanel } from '@TAF/components/Sidebar/SubNavPanel'
import { useAutoRailSection } from '@TAF/hooks/nav/useAutoRailSection'
import { SidebarContainer } from '@TAF/components/Sidebar/Sidebar.styles'
import { CreateProjectDrawer } from '@TAF/components/Projects/CreateProjectDrawer'

export type TDesktopSidebar = {
  orgId: string
  drawerOpen: boolean
  toggleDrawer: (status?: boolean) => any
}

export const DesktopSidebar = (props: TDesktopSidebar) => {
  const { orgId, drawerOpen, toggleDrawer } = props

  const [projectId] = useActiveProjectId()

  const navigate = useNavigate()
  const { config, context } = useRailNav()
  const [active, setActive] = useAutoRailSection(orgId, projectId)
  const activeRail = config.sections.find((s) => s.id === active) ?? null

  const onSectionClick = (id: TRailSectionId) => {
    setActive(active === id ? null : id)

    const section = config.sections.find((s) => s.id === id)
    if (section?.to) {
      const resolved = isFunc(section.to) ? section.to(context) : section.to
      if (resolved) navigate(resolved)
    }
  }

  return (
    <SidebarContainer className='tdsk-admin-sidebar'>
      <NavRail
        context={context}
        activeSection={active}
        sections={config.sections}
        bottomItems={config.bottomItems}
        onSectionClick={onSectionClick}
      />
      <SubNavPanel
        context={context}
        section={activeRail}
        onCreateProject={() => toggleDrawer(true)}
      />
      {orgId && (
        <CreateProjectDrawer
          open={drawerOpen}
          onClose={() => toggleDrawer(false)}
        />
      )}
    </SidebarContainer>
  )
}
