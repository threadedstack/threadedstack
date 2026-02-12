import { Fragment, useState } from 'react'
import { dims } from '@tdsk/components'
import { Toolbar, Divider, Box } from '@mui/material'
import { SBLogo } from '@TAF/components/Sidebar/SBLogo'
import { useDynamicNav } from '@TAF/hooks/nav/useDynamicNav'
import { SBNavList } from '@TAF/components/Sidebar/SBNavList'
import { SBSection } from '@TAF/components/Sidebar/SBSection'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { useActiveOrgId, useSidebarOpen } from '@TAF/state/selectors'
import { useAgentsSidebarSync } from '@TAF/hooks/nav/useAgentsSidebarSync'
import { CreateProjectDrawer } from '@TAF/components/Projects/CreateProjectDrawer'
import {
  SideDrawer,
  SBToggleBox,
  SBToggleBtn,
  SBNavListSpacer,
} from '@TAF/components/Sidebar/Sidebar.styles'

export type TSidebar = {}

export const Sidebar = (props: TSidebar) => {
  const [orgId] = useActiveOrgId()
  const [open, setOpen] = useSidebarOpen()
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const { config, context } = useDynamicNav()
  useAgentsSidebarSync()

  const onCreateProject = () => setCreateProjectOpen(true)

  return (
    (orgId && (
      <>
        <SideDrawer
          open={open}
          variant='permanent'
          className='tdsk-admin-sidebar'
          onClick={() => !open && setOpen(true)}
        >
          <Toolbar
            className='tdsk-admin-toolbar'
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
            {(open && (
              <SBToggleBox className='tdsk-toggle-box'>
                <SBToggleBtn
                  className='tdsk-toggle-button'
                  onClick={() => setOpen(!open)}
                >
                  {open ? <ChevronLeft /> : <ChevronRight />}
                </SBToggleBtn>
              </SBToggleBox>
            )) ||
              null}
          </Toolbar>

          {config.sections.map((section, idx) => {
            if (section.visible && !section.visible(context)) return null

            return (
              <Fragment key={section.id}>
                {(idx && (
                  <Box sx={{ px: 0.5, my: 1 }}>{(!open && <Divider />) || null}</Box>
                )) ||
                  null}
                <SBSection
                  open={open}
                  id={section.id}
                  key={section.id}
                  context={context}
                  headerTo={section.to}
                  items={section.items}
                  defaultExpanded={true}
                  header={section.header}
                />
              </Fragment>
            )
          })}

          <SBNavListSpacer />
          <Divider />

          <SBNavList
            open={open}
            context={context}
            items={config.bottomItems}
          />

          {orgId && (
            <CreateProjectDrawer
              open={createProjectOpen}
              onClose={() => setCreateProjectOpen(false)}
            />
          )}
        </SideDrawer>
      </>
    )) ||
    null
  )
}
