import type { TClassifiedSession } from '@TTH/types'

import { toast } from 'sonner'
import { nav } from '@TTH/services/nav'
import { useLocation } from 'react-router'
import { EPermResource } from '@tdsk/domain'
import { openSession } from '@TTH/actions/sessions'
import { colors, cmx, dims } from '@tdsk/components'
import { usePermissions } from '@TTH/hooks/permissions'
import { useState, useCallback, useRef } from 'react'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'
import { PeopleOutline, VisibilityOutlined } from '@mui/icons-material'
import { Box, Typography, CircularProgress, useTheme } from '@mui/material'

export type TNavSessionItem = {
  orgId: string
  indent?: number
  sandboxId: string
  projectId: string
  instanceId?: string
  session: TClassifiedSession
}

const formatTimestamp = (date?: string): string => {
  if (!date) return ``
  const d = new Date(date)
  const diffMs = Date.now() - d.getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return `just now`
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString(undefined, { month: `short`, day: `numeric` })
}

type PaletteColor = { main: string }

const categoryDotColor = (
  session: TClassifiedSession,
  palette: { success: PaletteColor; warning: PaletteColor; info: PaletteColor }
) => {
  switch (session.category) {
    case `connected`:
      return palette.success.main
    case `disconnected`:
      return session.hasShellSession ? palette.warning.main : colors.grey[600]
    case `shared`:
      return palette.info.main
  }
}

const categoryLabel = (session: TClassifiedSession) => {
  switch (session.category) {
    case `connected`:
      return `Active`
    case `disconnected`:
      return session.hasShellSession ? `Idle` : `Expired`
    case `shared`:
      return `Shared`
  }
}

export const NavSessionItem = (props: TNavSessionItem) => {
  const { session, sandboxId, projectId, orgId, instanceId, indent = 48 } = props

  const location = useLocation()
  const theme = useTheme()
  const { canExec } = usePermissions()
  const canExecSandbox = canExec(EPermResource.sandbox)
  const [connecting, setConnecting] = useState(false)
  const connectingRef = useRef(false)

  const isSharedViewOnly = session.category === `shared` && !canExecSandbox
  const isActive =
    location.pathname === nav.path.session(orgId, projectId, session.sessionId)
  const shortId = session.sessionId.slice(0, 6)
  const timestamp = formatTimestamp(session.connectedAt)

  const onClick = useCallback(async () => {
    if (session.category === `connected`) {
      nav.session(orgId, projectId, session.sessionId, {
        state: { sandboxId, projectId },
      })
      return
    }

    if (connectingRef.current) return
    connectingRef.current = true
    setConnecting(true)

    try {
      const { cols, rows } = estimateTerminalDimensions()
      const resolvedId = await openSession({
        orgId,
        cols,
        rows,
        sandboxId,
        projectId,
        instanceId,
        sessionId: session.sessionId,
      })
      nav.session(orgId, projectId, resolvedId, {
        state: { sandboxId, projectId },
      })
    } catch (err) {
      toast.error(`Failed to connect`, {
        description:
          err instanceof Error ? err.message : `Session may no longer be available`,
      })
    } finally {
      connectingRef.current = false
      setConnecting(false)
    }
  }, [session, sandboxId, projectId, orgId])

  return (
    <Box
      onClick={onClick}
      sx={{
        py: `4px`,
        pr: `12px`,
        gap: `6px`,
        display: `flex`,
        userSelect: `none`,
        alignItems: `center`,
        pl: `${indent + 12}px`,
        borderRadius: dims.border.smpx,
        opacity: connecting ? 0.6 : isSharedViewOnly ? 0.65 : 1,
        cursor: connecting || isSharedViewOnly ? `default` : `pointer`,
        transition: `background-color 0.15s ease, border-color 0.15s ease`,
        backgroundColor: isActive ? cmx(colors.primary.main, 6) : `transparent`,
        borderLeft: isActive
          ? `3px solid ${colors.primary.main}`
          : `3px solid transparent`,
        '&:hover': {
          backgroundColor: connecting ? undefined : cmx(colors.grey[500], 5),
        },
      }}
    >
      {isSharedViewOnly ? (
        <VisibilityOutlined
          sx={{
            fontSize: 14,
            flexShrink: 0,
            color: colors.grey[500],
          }}
        />
      ) : session.category === `shared` ? (
        <PeopleOutline
          sx={{
            fontSize: 14,
            flexShrink: 0,
            color: isActive ? colors.primary.main : theme.palette.info.main,
          }}
        />
      ) : (
        <Box
          sx={{
            width: 8,
            height: 8,
            flexShrink: 0,
            borderRadius: `50%`,
            backgroundColor: categoryDotColor(session, theme.palette),
          }}
        />
      )}

      <Box sx={{ flex: 1, minWidth: 0, display: `flex`, flexDirection: `column` }}>
        <Typography
          noWrap
          sx={{
            fontSize: `12px`,
            lineHeight: 1.3,
            fontWeight: 400,
            color: isActive ? colors.primary.main : `text.primary`,
          }}
        >
          {categoryLabel(session)} · {shortId}
        </Typography>
        {timestamp && (
          <Typography
            noWrap
            sx={{
              lineHeight: 1.3,
              fontSize: `10px`,
              color: colors.grey[500],
            }}
          >
            {isSharedViewOnly ? `View only` : timestamp}
          </Typography>
        )}
      </Box>

      {connecting && (
        <CircularProgress
          size={12}
          sx={{ flexShrink: 0, color: colors.grey[500] }}
        />
      )}
    </Box>
  )
}
