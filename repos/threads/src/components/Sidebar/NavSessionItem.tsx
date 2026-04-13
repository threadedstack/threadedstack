import type { TClassifiedSession } from '@TTH/types'

import { useState, useCallback, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Box, Typography, CircularProgress, useTheme } from '@mui/material'
import { PeopleOutline } from '@mui/icons-material'
import { toast } from 'sonner'
import { colors, cmx, dims } from '@tdsk/components'
import { openSession } from '@TTH/actions/sessions'

export type TNavSessionItem = {
  session: TClassifiedSession
  sandboxId: string
  projectId: string
  orgId: string
  indent?: number
}

const formatTimestamp = (date?: string): string => {
  if (!date) return ``
  const d = new Date(date)
  return d.toLocaleDateString(undefined, {
    month: `short`,
    day: `numeric`,
    hour: `2-digit`,
    minute: `2-digit`,
  })
}

type PaletteColor = { main: string }

const categoryDotColor = (
  category: TClassifiedSession[`category`],
  palette: { success: PaletteColor; warning: PaletteColor; info: PaletteColor }
) => {
  switch (category) {
    case `connected`:
      return palette.success.main
    case `disconnected`:
      return palette.warning.main
    case `shared`:
      return palette.info.main
  }
}

const categoryLabel = (category: TClassifiedSession[`category`]) => {
  switch (category) {
    case `connected`:
      return `Active`
    case `disconnected`:
      return `Reconnect`
    case `shared`:
      return `Shared`
  }
}

export const NavSessionItem = (props: TNavSessionItem) => {
  const { session, sandboxId, projectId, orgId, indent = 48 } = props

  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const [connecting, setConnecting] = useState(false)
  const connectingRef = useRef(false)

  const isActive = location.pathname === `/session/${session.sessionId}`
  const shortId = session.sessionId.slice(0, 6)
  const timestamp = useMemo(
    () => formatTimestamp(session.connectedAt),
    [session.connectedAt]
  )

  const onClick = useCallback(async () => {
    if (session.category === `connected`) {
      navigate(`/session/${session.sessionId}`, {
        state: { sandboxId, projectId },
      })
      return
    }

    if (connectingRef.current) return
    connectingRef.current = true
    setConnecting(true)

    try {
      const resolvedId = await openSession({
        orgId,
        sandboxId,
        projectId,
        sessionId: session.sessionId,
      })
      navigate(`/session/${resolvedId}`, {
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
  }, [session, sandboxId, projectId, orgId, navigate])

  return (
    <Box
      onClick={onClick}
      sx={{
        display: `flex`,
        alignItems: `center`,
        gap: `6px`,
        pl: `${indent + 12}px`,
        pr: `12px`,
        py: `4px`,
        cursor: connecting ? `default` : `pointer`,
        opacity: connecting ? 0.6 : 1,
        borderRadius: dims.border.smpx,
        borderLeft: isActive
          ? `3px solid ${colors.primary.main}`
          : `3px solid transparent`,
        backgroundColor: isActive ? cmx(colors.primary.main, 6) : `transparent`,
        transition: `background-color 0.15s ease, border-color 0.15s ease`,
        '&:hover': {
          backgroundColor: connecting ? undefined : cmx(colors.grey[500], 5),
        },
        userSelect: `none`,
      }}
    >
      {session.category === `shared` ? (
        <PeopleOutline
          sx={{
            fontSize: 14,
            color: isActive ? colors.primary.main : theme.palette.info.main,
            flexShrink: 0,
          }}
        />
      ) : (
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: `50%`,
            flexShrink: 0,
            backgroundColor: categoryDotColor(session.category, theme.palette),
          }}
        />
      )}

      <Box sx={{ flex: 1, minWidth: 0, display: `flex`, flexDirection: `column` }}>
        <Typography
          noWrap
          sx={{
            fontSize: `12px`,
            fontWeight: 400,
            color: isActive ? colors.primary.main : `text.primary`,
            lineHeight: 1.3,
          }}
        >
          {categoryLabel(session.category)} · {shortId}
        </Typography>
        {timestamp && (
          <Typography
            noWrap
            sx={{
              fontSize: `10px`,
              color: colors.grey[500],
              lineHeight: 1.3,
            }}
          >
            {timestamp}
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
