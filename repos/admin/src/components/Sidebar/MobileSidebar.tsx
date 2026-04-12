import { Fragment } from 'react'
import { nav } from '@TAF/services/nav'
import { dims, AppLogo } from '@tdsk/components'
import { useSidebarOpen } from '@TAF/state/selectors'
import { SidebarWidthOpen } from '@TAF/constants/values'
import { useDynamicNav } from '@TAF/hooks/nav/useDynamicNav'
import { SBNavList } from '@TAF/components/Sidebar/SBNavList'
import { SBSection } from '@TAF/components/Sidebar/SBSection'
import { Toolbar, Divider, Box, SwipeableDrawer } from '@mui/material'
import { CreateProjectDrawer } from '@TAF/components/Projects/CreateProjectDrawer'

export type TMobileSidebar = {
  orgId: string
  drawerOpen: boolean
  toggleDrawer: (status?: boolean) => any
}

export const MobileSidebar = (props: TMobileSidebar) => {
  const { orgId, drawerOpen, toggleDrawer } = props

  const [open, setOpen] = useSidebarOpen()
  const { config, context } = useDynamicNav()

  return (
    <SwipeableDrawer
      open={open}
      variant='temporary'
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      className='tdsk-admin-sidebar'
      ModalProps={{ keepMounted: true }}
      sx={{
        [`& .MuiDrawer-paper`]: {
          width: SidebarWidthOpen,
          boxSizing: 'border-box',
        },
      }}
    >
      <Toolbar
        className='tdsk-admin-toolbar'
        sx={{
          px: [0, 1],
          display: `flex`,
          alignItems: `center`,
          height: dims.header.hpx,
          justifyContent: `space-between`,
          minHeight: `${dims.header.hpx} !important`,
        }}
      >
        <AppLogo
          full
          onNavigate={() => nav.home()}
        />
      </Toolbar>

      {config.sections.map((section, idx) => {
        if (section.visible && !section.visible(context)) return null

        return (
          <Fragment key={section.id}>
            {idx > 0 && (
              <Box sx={{ px: 0.5, my: 1 }}>
                <Divider />
              </Box>
            )}
            <SBSection
              open={true}
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

      <Box flex={1} />
      <Divider />

      <SBNavList
        open={true}
        context={context}
        items={config.bottomItems}
      />

      {orgId && (
        <CreateProjectDrawer
          open={drawerOpen}
          onClose={() => toggleDrawer(false)}
        />
      )}
    </SwipeableDrawer>
  )
}
