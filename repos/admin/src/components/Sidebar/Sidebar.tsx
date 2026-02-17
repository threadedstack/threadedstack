import { Fragment, useState, useCallback } from 'react'

import { dims } from '@tdsk/components'
import { SBLogo } from '@TAF/components/Sidebar/SBLogo'
import { SidebarWidthOpen } from '@TAF/constants/values'
import { useDynamicNav } from '@TAF/hooks/nav/useDynamicNav'
import { SBNavList } from '@TAF/components/Sidebar/SBNavList'
import { SBSection } from '@TAF/components/Sidebar/SBSection'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { useActiveOrgId, useSidebarOpen } from '@TAF/state/selectors'
import { Toolbar, Divider, Box, SwipeableDrawer } from '@mui/material'
import { useAgentsSidebarSync } from '@TAF/hooks/nav/useAgentsSidebarSync'
import { CreateProjectDrawer } from '@TAF/components/Projects/CreateProjectDrawer'
import {
  SideDrawer,
  SBToggleBox,
  SBToggleBtn,
  SBNavListSpacer,
} from '@TAF/components/Sidebar/Sidebar.styles'

export type TSidebar = {
  isMobile?: boolean
}

export const Sidebar = (props: TSidebar) => {
  const { isMobile } = props
  const [orgId] = useActiveOrgId()
  const [open, setOpen] = useSidebarOpen()
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const { config, context } = useDynamicNav()
  useAgentsSidebarSync()

  const onCreateProject = () => setCreateProjectOpen(true)
  const onMobileOpen = useCallback(() => setOpen(true), [setOpen])
  const onMobileClose = useCallback(() => setOpen(false), [setOpen])

  const drawerContent = (
    <>
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
        <SBLogo full={isMobile || open} />
        {!isMobile &&
          ((open && (
            <SBToggleBox className='tdsk-toggle-box'>
              <SBToggleBtn
                className='tdsk-toggle-button'
                onClick={() => setOpen(!open)}
              >
                {open ? <ChevronLeft /> : <ChevronRight />}
              </SBToggleBtn>
            </SBToggleBox>
          )) ||
            null)}
      </Toolbar>

      {config.sections.map((section, idx) => {
        if (section.visible && !section.visible(context)) return null

        const sidebarOpen = isMobile || open

        return (
          <Fragment key={section.id}>
            {(idx && (
              <Box sx={{ px: 0.5, my: 1 }}>{(!sidebarOpen && <Divider />) || null}</Box>
            )) ||
              null}
            <SBSection
              id={section.id}
              key={section.id}
              context={context}
              open={sidebarOpen}
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
        open={isMobile || open}
        context={context}
        items={config.bottomItems}
      />

      {orgId && (
        <CreateProjectDrawer
          open={createProjectOpen}
          onClose={() => setCreateProjectOpen(false)}
        />
      )}
    </>
  )

  if (isMobile) {
    return (
      <SwipeableDrawer
        open={open}
        variant='temporary'
        onClose={onMobileClose}
        onOpen={onMobileOpen}
        className='tdsk-admin-sidebar'
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': {
            width: SidebarWidthOpen,
            boxSizing: 'border-box',
          },
        }}
      >
        {drawerContent}
      </SwipeableDrawer>
    )
  }

  return (
    <SideDrawer
      open={open}
      variant='permanent'
      className='tdsk-admin-sidebar'
      onClick={() => !open && setOpen(true)}
    >
      {drawerContent}
    </SideDrawer>
  )
}
