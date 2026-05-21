import type { MouseEvent } from 'react'

import { nav } from '@TTH/services/nav'
import { useState, useCallback } from 'react'
import { selectProject } from '@TTH/actions/projects/selectProject'
import { Avatar, ProjectIcon, SelectorButton, SelectorMenu } from '@tdsk/components'
import {
  useOrgId,
  useProjects,
  useActiveProject,
  useActiveProjectId,
} from '@TTH/state/selectors'

export const ProjectSelector = () => {
  const [orgId] = useOrgId()
  const [projects] = useProjects()
  const [query, setQuery] = useState(``)
  const [activeProject] = useActiveProject()
  const [activeProjectId] = useActiveProjectId()
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const open = Boolean(anchorEl)

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const onClose = () => {
    setAnchorEl(null)
    setQuery('')
  }

  const onSelect = useCallback(
    (item: { id: string }) => {
      selectProject(item.id)
      onClose()
      nav.project(orgId, item.id)
    },
    [orgId]
  )

  const items = projects.map((p) => ({
    id: p.id,
    name: p.name || p.id,
    description: p.branch ? `Branch: ${p.branch}` : undefined,
  }))

  if (!orgId) return null

  return (
    <>
      <SelectorButton
        open={open}
        onClick={onClick}
        text={activeProject?.name}
        placeholder='Select Project'
        className='tdsk-project-selector'
        icon={
          activeProject?.name && activeProjectId ? (
            <Avatar
              name={activeProject?.name}
              identifier={activeProjectId}
              size='sm'
            />
          ) : (
            <ProjectIcon
              text
              sx={{ fontSize: 18 }}
            />
          )
        }
      />
      <SelectorMenu
        open={open}
        items={items}
        query={query}
        onClose={onClose}
        onSelect={onSelect}
        anchorEl={anchorEl}
        setQuery={setQuery}
        activeId={activeProjectId}
        emptyMessage='No projects found'
        searchPlaceholder='Search projects...'
      />
    </>
  )
}
