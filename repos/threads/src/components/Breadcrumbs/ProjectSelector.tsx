import type { MouseEvent } from 'react'

import { useState } from 'react'
import { ProjectIcon, SelectorButton, SelectorMenu } from '@tdsk/components'
import { setActiveProjectId } from '@TTH/state/accessors'
import {
  useOrgId,
  useProjects,
  useActiveProject,
  useActiveProjectId,
} from '@TTH/state/selectors'

export const ProjectSelector = () => {
  const orgId = useOrgId()
  const projects = useProjects()
  const activeProject = useActiveProject()
  const [activeProjectId] = useActiveProjectId()
  const [query, setQuery] = useState('')
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const open = Boolean(anchorEl)

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const onClose = () => {
    setAnchorEl(null)
    setQuery('')
  }

  const items = projects.map((p) => ({
    id: p.id,
    name: p.name || p.id,
    description: p.branch ? `Branch: ${p.branch}` : undefined,
  }))

  if (!orgId) return null

  return (
    <>
      <SelectorButton
        icon={
          <ProjectIcon
            text
            sx={{ fontSize: 18 }}
          />
        }
        text={activeProject?.name}
        open={open}
        onClick={onClick}
        className='tdsk-project-selector'
        placeholder='Select Project'
      />
      <SelectorMenu
        items={items}
        query={query}
        setQuery={setQuery}
        activeId={activeProjectId}
        open={open}
        anchorEl={anchorEl}
        onSelect={(item) => setActiveProjectId(item.id)}
        onClose={onClose}
        searchPlaceholder='Search projects...'
        emptyMessage='No projects found'
      />
    </>
  )
}
