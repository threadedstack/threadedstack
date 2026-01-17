import { Toolbar, Divider } from '@mui/material'
import { dims } from '@tdsk/components'
import { SBLogo } from '@TAF/components/Sidebar/SBLogo'
import { SBSection } from '@TAF/components/Sidebar/SBSection'
import { useDynamicNav } from '@TAF/hooks/nav/useDynamicNav'
import { SBNavList } from '@TAF/components/Sidebar/SBNavList'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import { useActiveOrgId, useSidebarOpen } from '@TAF/state/selectors'
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
  const { config, context } = useDynamicNav()

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

          {config.sections.map((section) => {
            if (section.visible && !section.visible(context)) return null

            return (
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
            )
          })}

          <SBNavListSpacer />
          <Divider />

          <SBNavList
            open={open}
            context={context}
            items={config.bottomItems}
          />
        </SideDrawer>
      </>
    )) ||
    null
  )
}
