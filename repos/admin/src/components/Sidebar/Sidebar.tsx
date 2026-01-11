import { Fragment } from 'react'
import { dims } from '@tdsk/components'
import { Toolbar, Divider } from '@mui/material'
import { useSidebarOpen } from '@TAF/state/selectors'
import { SBLogo } from '@TAF/components/Sidebar/SBLogo'
import { useDynamicNav } from '@TAF/hooks/nav/useDynamicNav'
import { SBNavList } from '@TAF/components/Sidebar/SBNavList'
import { ChevronLeft, ChevronRight } from '@mui/icons-material'
import {
  SideDrawer,
  SBToggleBox,
  SBToggleBtn,
  SBNavListSpacer,
  SBSectionHeader,
} from '@TAF/components/Sidebar/Sidebar.styles'

export type TSidebar = {}

export const Sidebar = (props: TSidebar) => {
  const [open, setOpen] = useSidebarOpen()
  const { config, context } = useDynamicNav()

  return (
    <>
      <SideDrawer
        open={open}
        variant='permanent'
        onClick={() => !open && setOpen(true)}
      >
        <Toolbar
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
        </Toolbar>

        {config.sections.map((section) => {
          if (section.visible && !section.visible(context)) return null

          return (
            <Fragment key={section.id}>
              {section.header && open && (
                <SBSectionHeader>
                  {typeof section.header === 'function'
                    ? section.header(context)
                    : section.header}
                </SBSectionHeader>
              )}
              <SBNavList
                open={open}
                context={context}
                items={section.items}
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
      </SideDrawer>
      <SBToggleBox>
        <SBToggleBtn onClick={() => setOpen(!open)}>
          {open ? <ChevronLeft /> : <ChevronRight />}
        </SBToggleBtn>
      </SBToggleBox>
    </>
  )
}
