import { Fragment, useMemo } from 'react'
import { dims } from '@tdsk/components'
import {
  useSidebarOpen,
  useTeams,
  useRepos,
  useActiveTeamId,
  useActiveRepoId,
} from '@TAF/state/selectors'
import { SBLogo } from '@TAF/components/Sidebar/SBLogo'
import { SBNavList } from '@TAF/components/Sidebar/SBNavList'
import { getDynamicNavConfig } from '@TAF/constants/nav'
import { Toolbar, Divider } from '@mui/material'
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
  const [teams] = useTeams()
  const [repos] = useRepos()
  const [activeTeamId] = useActiveTeamId()
  const [activeRepoId] = useActiveRepoId()

  // Build context
  const navContext = useMemo(
    () => ({
      teamId: activeTeamId,
      teamName: activeTeamId && teams?.[activeTeamId]?.name,
      repoId: activeRepoId,
      repoName: activeRepoId && repos?.[activeRepoId]?.name,
    }),
    [activeTeamId, activeRepoId, teams, repos]
  )

  // Get dynamic nav config
  const navConfig = useMemo(() => getDynamicNavConfig(navContext), [navContext])

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

        {/* Render dynamic sections */}
        {navConfig.sections.map((section) => {
          if (section.visible && !section.visible(navContext)) return null

          return (
            <Fragment key={section.id}>
              {section.header && open && (
                <SBSectionHeader>
                  {typeof section.header === 'function'
                    ? section.header(navContext)
                    : section.header}
                </SBSectionHeader>
              )}
              <SBNavList
                open={open}
                items={section.items}
                context={navContext}
              />
            </Fragment>
          )
        })}

        <SBNavListSpacer />
        <Divider />

        {/* Bottom nav */}
        <SBNavList
          open={open}
          items={navConfig.bottomItems}
          context={navContext}
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
