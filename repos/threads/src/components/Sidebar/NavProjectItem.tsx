import type { Project, Sandbox } from '@tdsk/domain'

import { nav } from '@TTH/services/nav'
import { useLocation } from 'react-router'
import { useState, useCallback } from 'react'
import { colors, cmx, dims } from '@tdsk/components'
import { StorageKeyPrefix } from '@TTH/constants/storage'
import { Box, Typography, Collapse, Chip } from '@mui/material'
import { FolderOutlined, ChevronRight } from '@mui/icons-material'
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
      <Box
        onClick={() => nav.project(orgId, project.id)}
        sx={{
          display: `flex`,
          alignItems: `center`,
          gap: `6px`,
          px: `12px`,
          py: `6px`,
          cursor: `pointer`,
          borderRadius: dims.border.smpx,
          borderLeft: isActive
            ? `3px solid ${colors.primary.main}`
            : `3px solid transparent`,
          backgroundColor: isActive ? cmx(colors.primary.main, 8) : `transparent`,
          transition: `background-color 0.15s ease, border-color 0.15s ease`,
          '&:hover': {
            backgroundColor: cmx(colors.grey[500], 5),
          },
          userSelect: `none`,
        }}
      >
        <FolderOutlined
          sx={{
            fontSize: 18,
            flexShrink: 0,
            color: isActive ? colors.primary.main : colors.grey[500],
          }}
        />
        <Typography
          noWrap
          sx={{
            flex: 1,
            fontSize: `14px`,
            fontWeight: 500,
            lineHeight: 1.4,
            color: isActive ? colors.primary.main : `text.primary`,
          }}
        >
          {project.name}
        </Typography>
        <Chip
          label={sandboxes.length}
          size='small'
          sx={{
            height: 20,
            minWidth: 20,
            flexShrink: 0,
            fontSize: `11px`,
            fontWeight: 600,
            '& .MuiChip-label': { px: `6px` },
          }}
        />
        <Box
          onClick={onToggle}
          sx={{
            width: 20,
            height: 20,
            flexShrink: 0,
            display: `flex`,
            cursor: `pointer`,
            borderRadius: `4px`,
            alignItems: `center`,
            justifyContent: `center`,
            transition: `background-color 0.15s ease`,
            '&:hover': {
              backgroundColor: cmx(colors.grey[500], 10),
            },
          }}
        >
          <ChevronRight
            sx={{
              fontSize: 16,
              color: colors.grey[500],
              transition: `transform 0.2s ease`,
              transform: expanded ? `rotate(90deg)` : `rotate(0deg)`,
            }}
          />
        </Box>
      </Box>

      <Collapse
        in={expanded}
        timeout='auto'
        unmountOnExit
      >
        {sandboxes.map((sandbox) => (
          <NavSandboxItem
            indent={24}
            orgId={orgId}
            key={sandbox.id}
            sandbox={sandbox}
            projectId={project.id}
          />
        ))}
      </Collapse>
    </Box>
  )
}
