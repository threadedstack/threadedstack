import type { Sandbox, TSandboxInstance } from '@tdsk/domain'
import type { TViewportMode } from '@TTH/types/ast.types'

import { nav } from '@TTH/services/nav'
import { ESandboxMode } from '@TTH/types'
import { useLocation } from 'react-router'
import { storage } from '@TTH/services/storage'
import { sandboxApi } from '@TTH/services/sandboxApi'
import { colors, cmx, dims } from '@tdsk/components'
import { Terminal, ChevronRight } from '@mui/icons-material'
import { useMemo, useState, useCallback, useEffect } from 'react'
import { useSandboxMode } from '@TTH/hooks/sandbox/useSandboxMode'
import { useUser, useBackendSessions } from '@TTH/state/selectors'
import { classifySessions } from '@TTH/utils/sessions/classifySessions'
import { NavInstanceItem } from '@TTH/components/Sidebar/NavInstanceItem'
import { Box, Typography, Collapse, Chip, useTheme } from '@mui/material'
import { useSandboxSessions } from '@TTH/hooks/sandbox/useSandboxSessions'
import { useSandboxHasSession } from '@TTH/hooks/sandbox/useSandboxHasSession'

export type TNavSandboxItem = {
  sandbox: Sandbox
  orgId: string
  projectId?: string
  indent?: number
}

type PaletteColor = { main: string }

const statusDotColor = (
  hasSession: boolean,
  mode: TViewportMode,
  palette: { success: PaletteColor; warning: PaletteColor }
) => {
  if (!hasSession) return colors.grey[500]
  switch (mode) {
    case ESandboxMode.streaming:
      return palette.success.main
    case ESandboxMode.interactive:
      return palette.warning.main
    case ESandboxMode.tui:
    case ESandboxMode.idle:
    default:
      return colors.grey[500]
  }
}

export const NavSandboxItem = (props: TNavSandboxItem) => {
  const { sandbox, orgId, projectId, indent = 0 } = props

  const theme = useTheme()
  const [user] = useUser()
  const location = useLocation()
  const sandboxMode = useSandboxMode(sandbox.id)
  const [instances, setInstances] = useState<TSandboxInstance[]>([])
  const [backendSessionsMap] = useBackendSessions()
  const hasSession = useSandboxHasSession(sandbox.id)
  const localSessions = useSandboxSessions(sandbox.id)
  const [expanded, setExpanded] = useState(() => storage.getSBExpanded(sandbox.id))

  const runtime = sandbox.config?.runtime || `custom`
  const resolvedProjectId = projectId || sandbox.projects?.[0]?.id || ``

  const isActive =
    location.pathname === nav.path.sandbox(orgId, resolvedProjectId, sandbox.id) ||
    localSessions.some(
      (s) => location.pathname === nav.path.session(orgId, resolvedProjectId, s.sessionId)
    )

  const backendSessions = backendSessionsMap.get(sandbox.id) ?? []

  const classifiedSessions = useMemo(
    () => classifySessions(backendSessions, localSessions, user?.id),
    [backendSessions, localSessions, user?.id]
  )

  const instanceGroups = useMemo(() => {
    const groups = new Map<string, typeof classifiedSessions>()
    const sessionPodMap = new Map<string, string>()
    for (const bs of backendSessions) {
      if (bs.instanceId) sessionPodMap.set(bs.sessionId, bs.instanceId)
    }
    for (const cs of classifiedSessions) {
      const instanceId = sessionPodMap.get(cs.sessionId) || `unknown`
      if (!groups.has(instanceId)) groups.set(instanceId, [])
      groups.get(instanceId)!.push(cs)
    }
    for (const inst of instances) {
      if (!groups.has(inst.instanceId)) groups.set(inst.instanceId, [])
    }
    return groups
  }, [classifiedSessions, backendSessions, instances])

  const loadInstances = useCallback(() => {
    if (!orgId || !resolvedProjectId) return
    sandboxApi
      .listInstances(orgId, resolvedProjectId, sandbox.id)
      .then((resp) => {
        if (resp.data) setInstances(resp.data.instances)
      })
      .catch((err) => {
        console.warn(`[NavSandboxItem] loadInstances failed for ${sandbox.id}:`, err)
      })
  }, [orgId, sandbox.id, resolvedProjectId])

  useEffect(() => {
    loadInstances()
  }, [loadInstances])

  useEffect(() => {
    if (backendSessions.length > 0) loadInstances()
  }, [backendSessions.length, loadInstances])

  const onToggle = useCallback(
    (evt: React.MouseEvent) => {
      evt.stopPropagation()
      const next = !expanded
      setExpanded(next)
      storage.setSBExpanded(sandbox.id, next)
    },
    [sandbox.id, expanded]
  )

  const onNavigate = useCallback(() => {
    nav.sandbox(orgId, resolvedProjectId, sandbox.id)
  }, [orgId, resolvedProjectId, sandbox.id])

  return (
    <Box>
      <Box
        onClick={onNavigate}
        sx={{
          gap: `6px`,
          py: `5px`,
          pr: `12px`,
          display: `flex`,
          cursor: `pointer`,
          userSelect: `none`,
          alignItems: `center`,
          pl: `${indent + 12}px`,
          borderRadius: dims.border.smpx,
          borderLeft: isActive
            ? `3px solid ${colors.primary.main}`
            : `3px solid transparent`,
          backgroundColor: isActive ? cmx(colors.primary.main, 8) : `transparent`,
          transition: `background-color 0.15s ease, border-color 0.15s ease`,
          '&:hover': {
            backgroundColor: cmx(colors.grey[500], 5),
          },
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            flexShrink: 0,
            borderRadius: `50%`,
            transition: `background-color 0.3s ease`,
            backgroundColor: statusDotColor(hasSession, sandboxMode, theme.palette),
          }}
        />

        <Terminal
          sx={{
            fontSize: 16,
            flexShrink: 0,
            color: isActive ? colors.primary.main : colors.grey[500],
          }}
        />

        <Typography
          noWrap
          sx={{
            flex: 1,
            fontSize: `13px`,
            fontWeight: 400,
            lineHeight: 1.4,
            color: isActive ? colors.primary.main : `text.primary`,
          }}
        >
          {sandbox.name}
        </Typography>

        <Chip
          label={runtime}
          size='small'
          variant='outlined'
          sx={{
            height: 18,
            flexShrink: 0,
            fontSize: `10px`,
            '& .MuiChip-label': { px: `5px` },
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
        {instanceGroups.size > 0 ? (
          Array.from(instanceGroups.entries()).map(([instanceId, podSessions], idx) => (
            <NavInstanceItem
              key={instanceId}
              orgId={orgId}
              index={idx + 1}
              indent={indent + 24}
              sandboxId={sandbox.id}
              sessions={podSessions}
              instanceId={instanceId}
              projectId={resolvedProjectId}
            />
          ))
        ) : (
          <Typography
            variant='caption'
            sx={{
              py: `4px`,
              display: `block`,
              fontStyle: `italic`,
              pl: `${indent + 48 + 12}px`,
              color: colors.grey[500],
            }}
          >
            No instances
          </Typography>
        )}
      </Collapse>
    </Box>
  )
}
