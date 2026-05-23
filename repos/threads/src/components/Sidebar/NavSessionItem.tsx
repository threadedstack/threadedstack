import type { TClassifiedSession } from '@TTH/types'

import { toast } from 'sonner'
import { nav } from '@TTH/services/nav'
import { useLocation } from 'react-router'
import { EPermResource } from '@tdsk/domain'
import { openSession } from '@TTH/actions/sessions'
import { colors, cmx, dims } from '@tdsk/components'
import { useState, useCallback, useRef } from 'react'
import { SidebarNavIndent } from '@TTH/constants/nav'
import { usePermissions } from '@TTH/hooks/permissions'
import { formatRelativeDate } from '@TTH/utils/formatDate'
import { categoryLabel } from '@TTH/utils/nav/categoryLabel'
import { shortId as formatShortId } from '@TTH/utils/shortId'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'
import { categoryDotColor } from '@TTH/utils/nav/categoryDotColor'
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

export const NavSessionItem = (props: TNavSessionItem) => {
  const {
    orgId,
    session,
    sandboxId,
    projectId,
    instanceId,
    indent = SidebarNavIndent,
  } = props

  const theme = useTheme()
  const location = useLocation()
  const connectingRef = useRef(false)
  const { canExec } = usePermissions()
  const canExecSandbox = canExec(EPermResource.sandbox)
  const [connecting, setConnecting] = useState(false)

  const isSharedViewOnly = session.category === `shared` && !canExecSandbox
  const isActive =
    location.pathname ===
    nav.path.session(orgId, projectId, instanceId ?? ``, session.sessionId)

  const sid = formatShortId(session.sessionId)
  const timestamp = formatRelativeDate(session.connectedAt)

  const onClick = useCallback(async () => {
    if (session.category === `connected`) {
      nav.session(orgId, projectId, instanceId ?? ``, session.sessionId, {
        state: { sandboxId, projectId, instanceId },
      })
      return
    }

    if (connectingRef.current) return
    connectingRef.current = true
    setConnecting(true)

    try {
      const { cols, rows } = estimateTerminalDimensions()
      const { sessionId: resolvedId, instanceId: resolvedInstanceId } = await openSession(
        {
          cols,
          rows,
          orgId,
          sandboxId,
          projectId,
          instanceId,
          sessionId: session.sessionId,
        }
      )
      nav.session(orgId, projectId, resolvedInstanceId, resolvedId, {
        state: { sandboxId, projectId, instanceId: resolvedInstanceId },
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
          {categoryLabel(session)} · {sid}
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
