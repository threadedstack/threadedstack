import type { Thread } from '@tdsk/domain'

import { useCallback, useMemo } from 'react'
import { Box, Typography } from '@mui/material'
import { colors, cmx, dims } from '@tdsk/components'
import { useNavigate, useLocation } from 'react-router'
import { ChatBubbleOutline } from '@mui/icons-material'

export type TNavThreadItem = {
  orgId: string
  thread: Thread
  indent?: number
  sandboxId: string
  projectId: string
}

const formatTimestamp = (date?: string | Date): string => {
  if (!date) return ``
  const d = typeof date === `string` ? new Date(date) : date
  return d.toLocaleDateString(undefined, {
    month: `short`,
    day: `numeric`,
    hour: `2-digit`,
    minute: `2-digit`,
  })
}

export const NavThreadItem = (props: TNavThreadItem) => {
  const { thread, orgId, sandboxId, projectId, indent = 48 } = props

  const navigate = useNavigate()
  const location = useLocation()

  const basePath = `/orgs/${orgId}/projects/${projectId}`
  const isActive = location.pathname === `${basePath}/session/${sandboxId}`

  const handleNavigate = useCallback(() => {
    navigate(`${basePath}/session/${sandboxId}`)
  }, [navigate, basePath, sandboxId])

  const timestamp = useMemo(() => formatTimestamp(thread.createdAt), [thread.createdAt])

  return (
    <Box
      onClick={handleNavigate}
      sx={{
        py: `4px`,
        gap: `6px`,
        pr: `12px`,
        display: `flex`,
        cursor: `pointer`,
        alignItems: `center`,
        pl: `${indent + 12}px`,
        borderRadius: dims.border.smpx,
        transition: `background-color 0.15s ease, border-color 0.15s ease`,
        backgroundColor: isActive ? cmx(colors.primary.main, 6) : `transparent`,
        borderLeft: isActive
          ? `3px solid ${colors.primary.main}`
          : `3px solid transparent`,
        '&:hover': {
          backgroundColor: cmx(colors.grey[500], 5),
        },
        userSelect: `none`,
      }}
    >
      <ChatBubbleOutline
        sx={{
          fontSize: 14,
          flexShrink: 0,
          color: isActive ? colors.primary.main : colors.grey[500],
        }}
      />

      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: `flex`,
          flexDirection: `column`,
        }}
      >
        <Typography
          noWrap
          sx={{
            fontSize: `12px`,
            fontWeight: 400,
            lineHeight: 1.3,
            color: isActive ? colors.primary.main : `text.primary`,
          }}
        >
          {thread.name || `Session`}
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
            {timestamp}
          </Typography>
        )}
      </Box>
    </Box>
  )
}
