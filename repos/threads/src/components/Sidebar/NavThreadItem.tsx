import type { Thread } from '@tdsk/domain'

import { useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router'
import { Box, Typography } from '@mui/material'
import { ChatBubbleOutline } from '@mui/icons-material'
import { colors, cmx, dims } from '@tdsk/components'

export type TNavThreadItem = {
  thread: Thread
  sandboxId: string
  indent?: number
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
  const { thread, sandboxId, indent = 48 } = props

  const navigate = useNavigate()
  const location = useLocation()

  const isActive = location.pathname === `/session/${sandboxId}`

  const handleNavigate = useCallback(() => {
    navigate(`/session/${sandboxId}`)
  }, [navigate, sandboxId])

  const timestamp = useMemo(() => formatTimestamp(thread.createdAt), [thread.createdAt])

  return (
    <Box
      onClick={handleNavigate}
      sx={{
        display: `flex`,
        alignItems: `center`,
        gap: `6px`,
        pl: `${indent + 12}px`,
        pr: `12px`,
        py: `4px`,
        cursor: `pointer`,
        borderRadius: dims.border.smpx,
        borderLeft: isActive
          ? `3px solid ${colors.primary.main}`
          : `3px solid transparent`,
        backgroundColor: isActive ? cmx(colors.primary.main, 6) : `transparent`,
        transition: `background-color 0.15s ease, border-color 0.15s ease`,
        '&:hover': {
          backgroundColor: cmx(colors.grey[500], 5),
        },
        userSelect: `none`,
      }}
    >
      <ChatBubbleOutline
        sx={{
          fontSize: 14,
          color: isActive ? colors.primary.main : colors.grey[500],
          flexShrink: 0,
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
            color: isActive ? colors.primary.main : `text.primary`,
            lineHeight: 1.3,
          }}
        >
          {thread.name || `Session`}
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
    </Box>
  )
}
