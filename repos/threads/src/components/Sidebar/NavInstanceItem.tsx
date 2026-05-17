import type { TClassifiedSession } from '@TTH/types'

import { cmx } from '@tdsk/components'
import { nav } from '@TTH/services/nav'
import { useMemo, useState, useCallback } from 'react'
import { Dns, ChevronRight } from '@mui/icons-material'
import { Box, Typography, Collapse, useTheme } from '@mui/material'
import { NavSessionItem } from '@TTH/components/Sidebar/NavSessionItem'

type TNavInstanceItem = {
  index: number
  orgId: string
  indent: number
  instanceId: string
  sandboxId: string
  projectId: string
  sessions: TClassifiedSession[]
}

export const NavInstanceItem = (props: TNavInstanceItem) => {
  const { index, orgId, indent, sessions, sandboxId, projectId, instanceId } = props

  const theme = useTheme()
  const { grey } = theme.palette.colors
  const [expanded, setExpanded] = useState(true)

  const hasConnected = useMemo(
    () => sessions.some((s) => s.category === `connected`),
    [sessions]
  )

  const shortPod = instanceId.slice(-4)

  const onNavigate = useCallback(
    (evt: React.MouseEvent) => {
      evt.stopPropagation()
      nav.instance(orgId, projectId, sandboxId, instanceId)
    },
    [orgId, projectId, sandboxId, instanceId]
  )

  return (
    <Box>
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          gap: `6px`,
          py: `4px`,
          pr: `12px`,
          display: `flex`,
          cursor: `pointer`,
          userSelect: `none`,
          alignItems: `center`,
          pl: `${indent + 12}px`,
          borderRadius: theme.dims.border.smpx,
          transition: `background-color 0.15s ease`,
          '&:hover': {
            backgroundColor: cmx(grey[500], 5),
          },
        }}
      >
        <Box
          sx={{
            width: 6,
            height: 6,
            flexShrink: 0,
            borderRadius: `50%`,
            transition: `background-color 0.3s ease`,
            backgroundColor: hasConnected ? theme.palette.success.main : grey[500],
          }}
        />

        <Dns
          onClick={onNavigate}
          sx={{
            fontSize: 14,
            flexShrink: 0,
            color: grey[500],
            cursor: `pointer`,
          }}
        />

        <Typography
          noWrap
          onClick={onNavigate}
          sx={{
            flex: 1,
            fontSize: `12px`,
            fontWeight: 400,
            lineHeight: 1.4,
            cursor: `pointer`,
            color: `text.secondary`,
            '&:hover': { textDecoration: `underline` },
          }}
        >
          Instance {index} ({shortPod})
        </Typography>

        <Box
          sx={{
            width: 18,
            height: 18,
            flexShrink: 0,
            display: `flex`,
            cursor: `pointer`,
            borderRadius: `4px`,
            alignItems: `center`,
            justifyContent: `center`,
            transition: `background-color 0.15s ease`,
            '&:hover': {
              backgroundColor: cmx(grey[500], 10),
            },
          }}
        >
          <ChevronRight
            sx={{
              fontSize: 14,
              color: grey[500],
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
        {sessions.length > 0 ? (
          sessions.map((cs) => (
            <NavSessionItem
              session={cs}
              orgId={orgId}
              key={cs.sessionId}
              indent={indent + 20}
              sandboxId={sandboxId}
              projectId={projectId}
              instanceId={instanceId}
            />
          ))
        ) : (
          <Typography
            variant='caption'
            sx={{
              py: `3px`,
              display: `block`,
              color: grey[500],
              fontStyle: `italic`,
              pl: `${indent + 20 + 12}px`,
            }}
          >
            No sessions
          </Typography>
        )}
      </Collapse>
    </Box>
  )
}
