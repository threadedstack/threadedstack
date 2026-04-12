import type { MouseEvent } from 'react'

import { useState } from 'react'
import { ProjectIcon, SelectorButton, SelectorMenu } from '@tdsk/components'
import { setProjectActive } from '@TAF/actions/projects/local/setProjectActive'
import {
  useProjects,
  useActiveOrgId,
  useActiveProject,
  useActiveProjectId,
} from '@TAF/state/selectors'

export type TProjectSelector = {
  className?: string
  onCreateProject?: () => void
}

export const ProjectSelector = (props: TProjectSelector) => {
  const { className, onCreateProject } = props

  const [activeOrgId] = useActiveOrgId()
  const [activeProject] = useActiveProject()
  const [activeProjectId] = useActiveProjectId()
  const [projects] = useProjects()
  const [query, setQuery] = useState('')
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const open = Boolean(anchorEl)

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const onClose = () => {
    setAnchorEl(null)
    setQuery('')
  }

  const items = projects
    ? Object.values(projects).map((p) => ({
        id: p.id,
        name: p.name || p.id,
        description: p.branch ? `Branch: ${p.branch}` : undefined,
      }))
    : []

  if (!activeOrgId) return null

  return (
    <>
      <SelectorButton
        open={open}
        onClick={onClick}
        className={className}
        text={activeProject?.name}
        placeholder='Select Project'
        icon={
          <ProjectIcon
            text
            sx={{ fontSize: 18 }}
          />
        }
      />
      <SelectorMenu
        open={open}
        items={items}
        query={query}
        setQuery={setQuery}
        anchorEl={anchorEl}
        activeId={activeProjectId}
        onSelect={(item) => {
          setProjectActive(item.id)
        }}
        onClose={onClose}
        onCreate={onCreateProject}
        createLabel='Create Project'
        emptyMessage='No projects found'
        searchPlaceholder='Search projects...'
      />
    </>
  )
}
