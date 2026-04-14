import type { Project, Sandbox } from '@tdsk/domain'

import { useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import { colors, cmx } from '@tdsk/components'
import { useProjects, useSandboxes, useOrgId } from '@TTH/state/selectors'
import { NavProjectItem } from '@TTH/components/Sidebar/NavProjectItem'
import { NavSandboxItem } from '@TTH/components/Sidebar/NavSandboxItem'

type TProjectGroup = {
  project: Project
  sandboxes: Sandbox[]
}

/**
 * Groups sandboxes by their parent project(s).
 * A sandbox belongs to projects it is linked to via sandbox.projects.
 * Sandboxes without any project go into an ungrouped list.
 */
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

export const NavTree = () => {
  const projects = useProjects()
  const sandboxes = useSandboxes()
  const orgId = useOrgId()

  const { groups } = useMemo(
    () => groupSandboxesByProject(projects, sandboxes),
    [projects, sandboxes]
  )

  if (!sandboxes.length) return null

  return (
    <Box
      component='nav'
      sx={{ py: 0.5 }}
    >
      {groups.map(({ project, sandboxes: projectSandboxes }) => (
        <NavProjectItem
          orgId={orgId}
          key={project.id}
          project={project}
          sandboxes={projectSandboxes}
        />
      ))}
    </Box>
  )
}
