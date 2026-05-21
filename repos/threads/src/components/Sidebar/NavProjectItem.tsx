import type { Project, Sandbox } from '@tdsk/domain'

import { nav } from '@TTH/services/nav'
import { useLocation } from 'react-router'
import { useState, useCallback } from 'react'
import { NavRailItem } from '@tdsk/components'
import { Workspaces } from '@mui/icons-material'
import { Box, Chip, Collapse } from '@mui/material'
import { StorageKeyPrefix } from '@TTH/constants/storage'
import { NavSandboxItem } from '@TTH/components/Sidebar/NavSandboxItem'

export type TNavProjectItem = {
  project: Project
  sandboxes: Sandbox[]
  orgId: string
}

const storageKey = (projectId: string) => `${StorageKeyPrefix}nav-project-${projectId}`

const getInitialExpanded = (projectId: string): boolean => {
  try {
    const stored = localStorage.getItem(storageKey(projectId))
    return stored === null ? true : stored === `true`
  } catch {
    return true
  }
}

export const NavProjectItem = (props: TNavProjectItem) => {
  const { project, sandboxes, orgId } = props

  const location = useLocation()

  const [expanded, setExpanded] = useState(() => getInitialExpanded(project.id))

  const isActive = location.pathname === nav.path.project(orgId, project.id)

  const onToggle = useCallback(
    (evt: React.MouseEvent) => {
      evt.stopPropagation()
      setExpanded((prev) => {
        const next = !prev
        try {
          localStorage.setItem(storageKey(project.id), String(next))
        } catch {}
        return next
      })
    },
    [project.id]
  )

  return (
    <Box>
      <NavRailItem
        active={isActive}
        label={project.name}
        icon={<Workspaces />}
        className='tdsk-nav-project-item'
        hasChildren={sandboxes.length > 0}
        onClick={() => nav.project(orgId, project.id)}
        open={expanded}
        onToggle={onToggle}
        trail={
          <Chip
            label={sandboxes.length}
            size='small'
            className='tdsk-rail-item-text'
            sx={{
              height: 20,
              minWidth: 20,
              flexShrink: 0,
              fontSize: `11px`,
              fontWeight: 600,
              '& .MuiChip-label': { px: `6px` },
            }}
          />
        }
      />

      <Box className='tdsk-rail-child-items'>
        <Collapse
          in={expanded}
          timeout='auto'
          unmountOnExit
        >
          {sandboxes.map((sandbox) => (
            <NavSandboxItem
              indent={12}
              orgId={orgId}
              key={sandbox.id}
              sandbox={sandbox}
              projectId={project.id}
            />
          ))}
        </Collapse>
      </Box>
    </Box>
  )
}
