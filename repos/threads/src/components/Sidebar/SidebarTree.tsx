import type { Project, Sandbox } from '@tdsk/domain'

import { Box } from '@mui/material'
import { useLocation } from 'react-router'
import { useMemo, useCallback } from 'react'
import { NavRailSection, NavRailItem } from '@tdsk/components'
import { toggleFileTree } from '@TTH/actions/sidebar/toggleFileTree'
import { NavProjectItem } from '@TTH/components/Sidebar/NavProjectItem'
import { Folder, FolderOpen, Search, History } from '@mui/icons-material'
import {
  useProjects,
  useSandboxes,
  useOrgId,
  useActiveOrg,
  useFileTreeOpen,
} from '@TTH/state/selectors'

type TProjectGroup = {
  project: Project
  sandboxes: Sandbox[]
}

const groupSandboxesByProject = (
  projects: Project[],
  sandboxes: Sandbox[]
): { groups: TProjectGroup[]; ungrouped: Sandbox[] } => {
  const projectMap = new Map<string, Sandbox[]>()
  const grouped = new Set<string>()

  for (const project of projects) {
    projectMap.set(project.id, [])
  }

  for (const sandbox of sandboxes) {
    if (sandbox.projects?.length) {
      for (const proj of sandbox.projects) {
        const list = projectMap.get(proj.id)
        if (list) {
          list.push(sandbox)
          grouped.add(sandbox.id)
        }
      }
    }
  }

  const groups: TProjectGroup[] = projects
    .filter((p) => {
      const list = projectMap.get(p.id)
      return list && list.length > 0
    })
    .map((project) => ({
      project,
      sandboxes: projectMap.get(project.id) || [],
    }))

  const ungrouped = sandboxes.filter((s) => !grouped.has(s.id))

  return { groups, ungrouped }
}

export const SidebarTree = () => {
  const [orgId] = useOrgId()
  const location = useLocation()
  const [projects] = useProjects()
  const [activeOrg] = useActiveOrg()
  const [sandboxes] = useSandboxes()
  const [fileTreeOpen] = useFileTreeOpen()

  const isSessionRoute = location.pathname.includes('/session/')

  const onToggleFileTree = useCallback(() => {
    toggleFileTree()
  }, [])

  const { groups } = useMemo(
    () => groupSandboxesByProject(projects, sandboxes),
    [projects, sandboxes]
  )

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, height: `100%` }}>
      {orgId && groups.length > 0 && (
        <Box
          sx={{
            px: 0.5,
            py: 0.5,
            flex: 1,
            overflow: `auto`,
          }}
        >
          <NavRailSection label={activeOrg?.name || `Projects`} />
          {groups.map(({ project, sandboxes: projectSandboxes }) => (
            <NavProjectItem
              orgId={orgId}
              key={project.id}
              project={project}
              sandboxes={projectSandboxes}
            />
          ))}
        </Box>
      )}

      {isSessionRoute && (
        <Box
          sx={{
            px: 0.5,
            py: 0.5,
            mt: `auto`,
            borderTop: 1,
            borderColor: `divider`,
          }}
        >
          <NavRailSection label='Session' />
          <NavRailItem
            active={fileTreeOpen}
            onClick={onToggleFileTree}
            icon={fileTreeOpen ? <FolderOpen /> : <Folder />}
            label={fileTreeOpen ? `Hide files` : `Show files`}
          />
          <NavRailItem
            icon={<Search />}
            label='Search files'
          />
          <NavRailItem
            icon={<History />}
            label='History'
          />
        </Box>
      )}
    </Box>
  )
}
