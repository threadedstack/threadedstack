import type { Sandbox, Thread } from '@tdsk/domain'
import type { TToolState } from '@tdsk/domain'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Box, Typography, Collapse, Chip } from '@mui/material'
import { Terminal, ChevronRight } from '@mui/icons-material'
import { colors, cmx, dims } from '@tdsk/components'
import { StorageKeyPrefix } from '@TTH/constants/storage'
import {
  useSandboxHasSession,
  useSandboxToolState,
  useSessionsForSandbox,
} from '@TTH/state/selectors'
import { loadThreadHistory } from '@TTH/actions/threads'
import { NavThreadItem } from '@TTH/components/Sidebar/NavThreadItem'

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

const statusDotColor = (hasSession: boolean, toolState: TToolState) => {
  if (!hasSession) return colors.grey[500]
  switch (toolState) {
    case `working`:
      return `#4caf50`
    case `permission`:
      return `#ff9800`
    case `prompt`:
    case `idle`:
    default:
      return colors.grey[500]
  }
}

export const NavSandboxItem = (props: TNavSandboxItem) => {
  const { sandbox, orgId, projectId, indent = 0 } = props

  const navigate = useNavigate()
  const location = useLocation()
  const hasSession = useSandboxHasSession(sandbox.id)
  const toolState = useSandboxToolState(sandbox.id)
  const sessions = useSessionsForSandbox(sandbox.id)

  const [expanded, setExpanded] = useState(() => getInitialExpanded(sandbox.id))
  const [threads, setThreads] = useState<Thread[]>([])
  const [loading, setLoading] = useState(false)
  const loadedRef = useRef(false)

  const runtime = sandbox.config?.runtime || `custom`
  const isActive =
    location.pathname === `/sandbox/${sandbox.id}` ||
    sessions.some((s) => location.pathname === `/session/${s.sessionId}`)

  const handleToggle = useCallback(
    (evt: React.MouseEvent) => {
      evt.stopPropagation()
      setExpanded((prev) => {
        const next = !prev
        try {
          localStorage.setItem(storageKey(sandbox.id), String(next))
        } catch {
          /* storage full */
        }
        return next
      })
    },
    [sandbox.id]
  )

  const handleNavigate = useCallback(() => {
    if (sessions.length === 1) {
      navigate(`/session/${sessions[0].sessionId}`, {
        state: { sandboxId: sandbox.id, projectId },
      })
    } else {
      navigate(`/sandbox/${sandbox.id}`)
    }
  }, [navigate, sandbox.id, projectId, sessions])

  // Lazy-load threads when first expanded
  useEffect(() => {
    if (!expanded || loadedRef.current || !orgId) return

    loadedRef.current = true
    setLoading(true)

    let cancelled = false
    loadThreadHistory({ orgId, sandboxId: sandbox.id }).then((res) => {
      if (cancelled) return
      if (res.data) setThreads(res.data)
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [expanded, orgId, sandbox.id])

  return (
    <Box>
      <Box
        onClick={handleNavigate}
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
        {/* Status dot */}
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: `50%`,
            flexShrink: 0,
            backgroundColor: statusDotColor(hasSession, toolState),
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
          onClick={handleToggle}
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
              display: `block`,
              pl: `${indent + 48 + 12}px`,
              py: `4px`,
              color: colors.grey[500],
            }}
          >
            Loading...
          </Typography>
        ) : threads.length > 0 ? (
          threads.map((thread) => (
            <NavThreadItem
              key={thread.id}
              thread={thread}
              sandboxId={sandbox.id}
              indent={indent + 24}
            />
          ))
        ) : (
          <Typography
            variant='caption'
            sx={{
              display: `block`,
              pl: `${indent + 48 + 12}px`,
              py: `4px`,
              color: colors.grey[500],
              fontStyle: `italic`,
            }}
          >
            No sessions
          </Typography>
        )}
      </Collapse>
    </Box>
  )
}
