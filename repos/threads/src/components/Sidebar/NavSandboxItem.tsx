import type { Sandbox, TSandboxSession } from '@tdsk/domain'
import type { TViewportMode } from '@TTH/types/ast.types'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Box, Typography, Collapse, Chip, useTheme } from '@mui/material'
import { Terminal, ChevronRight } from '@mui/icons-material'
import { colors, cmx, dims } from '@tdsk/components'
import { StorageKeyPrefix } from '@TTH/constants/storage'
import { fetchSandboxSessions, classifySessions } from '@TTH/actions/sessions'
import { NavSessionItem } from '@TTH/components/Sidebar/NavSessionItem'
import {
  useUser,
  useSandboxHasSession,
  useSandboxMode,
  useSessionsForSandbox,
} from '@TTH/state/selectors'

export type TNavSandboxItem = {
  sandbox: Sandbox
  orgId: string
  projectId?: string
  indent?: number
}

const storageKey = (sandboxId: string) => `${StorageKeyPrefix}nav-sandbox-${sandboxId}`

const getInitialExpanded = (sandboxId: string): boolean => {
  try {
    const stored = localStorage.getItem(storageKey(sandboxId))
    return stored === `true`
  } catch {
    return false
  }
}

type PaletteColor = { main: string }

const statusDotColor = (
  hasSession: boolean,
  mode: TViewportMode,
  palette: { success: PaletteColor; warning: PaletteColor }
) => {
  if (!hasSession) return colors.grey[500]
  switch (mode) {
    case `streaming`:
      return palette.success.main
    case `interactive`:
      return palette.warning.main
    case `tui`:
    case `idle`:
    default:
      return colors.grey[500]
  }
}

export const NavSandboxItem = (props: TNavSandboxItem) => {
  const { sandbox, orgId, projectId, indent = 0 } = props

  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const [user] = useUser()
  const hasSession = useSandboxHasSession(sandbox.id)
  const sandboxMode = useSandboxMode(sandbox.id)
  const sessions = useSessionsForSandbox(sandbox.id)

  const [expanded, setExpanded] = useState(() => getInitialExpanded(sandbox.id))
  const [backendSessions, setBackendSessions] = useState<TSandboxSession[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const loadedRef = useRef(false)
  const cancelRef = useRef<(() => void) | undefined>(undefined)

  const runtime = sandbox.config?.runtime || `custom`
  const resolvedProjectId = projectId || sandbox.projects?.[0]?.id || ``
  const isActive =
    location.pathname === `/sandbox/${sandbox.id}` ||
    sessions.some((s) => location.pathname === `/session/${s.sessionId}`)

  const classifiedSessions = useMemo(
    () => classifySessions(backendSessions, sessions, user?.id),
    [backendSessions, sessions, user?.id]
  )

  const loadSessions = useCallback(() => {
    if (!orgId || !resolvedProjectId) return
    cancelRef.current?.()
    let cancelled = false
    cancelRef.current = () => {
      cancelled = true
    }
    loadedRef.current = true
    setLoading(true)
    setLoadError(false)
    fetchSandboxSessions({ orgId, sandboxId: sandbox.id, projectId: resolvedProjectId })
      .then((res) => {
        if (cancelled) return
        if (res.data) setBackendSessions(res.data)
        else if (res.error) setLoadError(true)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setLoadError(true)
        setLoading(false)
      })
  }, [orgId, sandbox.id, resolvedProjectId])

  const onToggle = useCallback(
    (evt: React.MouseEvent) => {
      evt.stopPropagation()
      const next = !expanded
      setExpanded(next)
      if (next && !loadedRef.current) loadSessions()
      if (!next) {
        cancelRef.current?.()
        loadedRef.current = false
      }
      try {
        localStorage.setItem(storageKey(sandbox.id), String(next))
      } catch {
        /* storage full */
      }
    },
    [sandbox.id, loadSessions, expanded]
  )

  useEffect(() => {
    if (expanded && !loadedRef.current && orgId && resolvedProjectId) {
      loadSessions()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const onNavigate = useCallback(() => {
    navigate(`/sandbox/${sandbox.id}`)
  }, [navigate, sandbox.id])

  return (
    <Box>
      <Box
        onClick={onNavigate}
        sx={{
          display: `flex`,
          alignItems: `center`,
          gap: `6px`,
          pl: `${indent + 12}px`,
          pr: `12px`,
          py: `5px`,
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
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: `50%`,
            flexShrink: 0,
            backgroundColor: statusDotColor(hasSession, sandboxMode, theme.palette),
            transition: `background-color 0.3s ease`,
          }}
        />

        <Terminal
          sx={{
            fontSize: 16,
            color: isActive ? colors.primary.main : colors.grey[500],
            flexShrink: 0,
          }}
        />

        <Typography
          noWrap
          sx={{
            flex: 1,
            fontSize: `13px`,
            fontWeight: 400,
            color: isActive ? colors.primary.main : `text.primary`,
            lineHeight: 1.4,
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
            fontSize: `10px`,
            flexShrink: 0,
            '& .MuiChip-label': { px: `5px` },
          }}
        />

        <Box
          onClick={onToggle}
          sx={{
            display: `flex`,
            alignItems: `center`,
            justifyContent: `center`,
            width: 20,
            height: 20,
            flexShrink: 0,
            borderRadius: `4px`,
            cursor: `pointer`,
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
        {loading ? (
          <Typography
            variant='caption'
            sx={{
              py: `4px`,
              display: `block`,
              color: colors.grey[500],
              pl: `${indent + 48 + 12}px`,
            }}
          >
            Loading...
          </Typography>
        ) : classifiedSessions.length > 0 ? (
          classifiedSessions.map((cs) => (
            <NavSessionItem
              session={cs}
              orgId={orgId}
              key={cs.sessionId}
              indent={indent + 24}
              sandboxId={sandbox.id}
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
              color: loadError ? theme.palette.error.main : colors.grey[500],
              pl: `${indent + 48 + 12}px`,
            }}
          >
            {loadError ? `Failed to load` : `No sessions`}
          </Typography>
        )}
      </Collapse>
    </Box>
  )
}
