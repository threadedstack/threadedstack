import type { TOpenSession } from '@TTH/types'

import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Add from '@mui/icons-material/Add'
import { shortId } from '@TTH/utils/shortId'
import { MonoFont } from '@TTH/constants/values'
import Typography from '@mui/material/Typography'
import { TerminalView } from '@TTH/components/Terminal/TerminalView'
import { TerminalQuickSettings } from '@TTH/components/Terminal/TerminalQuickSettings'

export type TTerminalPane = {
  sessionId: string
  activeSessionId: string
  sessions: TOpenSession[]
  onNewSession: () => void
  onTabClick: (sessionId: string) => void
}

export const TerminalPane = (props: TTerminalPane) => {
  const { sessions, sessionId, onTabClick, onNewSession, activeSessionId } = props

  const tabs = useMemo(() => {
    return sessions.map((s) => ({
      id: s.sessionId,
      label: `${s.runtime || `shell`} · ${shortId(s.sessionId, `s`)}`,
      active: s.sessionId === activeSessionId,
    }))
  }, [sessions, activeSessionId])

  return (
    <Box
      sx={{
        display: `flex`,
        flexDirection: `column`,
        flex: 1,
        minHeight: 0,
        overflow: `hidden`,
      }}
    >
      {/* Tab bar */}
      <Box
        sx={{
          height: 36,
          minHeight: 36,
          display: `flex`,
          borderBottom: 1,
          alignItems: `stretch`,
          borderColor: `divider`,
          bgcolor: `background.default`,
        }}
      >
        <Box
          sx={{
            display: `flex`,
            alignItems: `stretch`,
            flex: 1,
            minWidth: 0,
            overflow: `hidden`,
          }}
        >
          {tabs.map((tab) => (
            <Box
              key={tab.id}
              onClick={() => onTabClick(tab.id)}
              sx={{
                px: 1.5,
                gap: `6px`,
                borderRight: 1,
                display: `flex`,
                cursor: `pointer`,
                userSelect: `none`,
                alignItems: `center`,
                position: `relative`,
                whiteSpace: `nowrap`,
                borderColor: `divider`,
                color: tab.active ? `text.primary` : `text.secondary`,
                bgcolor: tab.active ? `background.paper` : `transparent`,
                '&:hover': {
                  bgcolor: tab.active ? `background.paper` : `action.hover`,
                },
                ...(tab.active && {
                  '&::before': {
                    content: `''`,
                    position: `absolute`,
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `2px`,
                    bgcolor: `primary.main`,
                  },
                }),
              }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  flexShrink: 0,
                  borderRadius: `50%`,
                  bgcolor: tab.active ? `success.main` : `text.disabled`,
                }}
              />
              <Typography
                noWrap
                sx={{
                  fontSize: 12,
                  fontFamily: MonoFont,
                  fontWeight: tab.active ? 600 : 400,
                }}
              >
                {tab.label}
              </Typography>
            </Box>
          ))}
          <Box
            onClick={onNewSession}
            sx={{
              px: 1.5,
              gap: `4px`,
              display: `flex`,
              cursor: `pointer`,
              userSelect: `none`,
              alignItems: `center`,
              color: `text.secondary`,
              '&:hover': {
                color: `text.primary`,
                bgcolor: `action.hover`,
              },
            }}
          >
            <Add sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: 12 }}>New</Typography>
          </Box>
        </Box>
        <Box
          sx={{
            px: 1,
            gap: 0.25,
            borderLeft: 1,
            display: `flex`,
            alignItems: `center`,
            borderColor: `divider`,
          }}
        >
          <TerminalQuickSettings />
        </Box>
      </Box>

      {/* Terminal body */}
      <Box sx={{ flex: 1, minHeight: 0, position: `relative` }}>
        <TerminalView
          key={sessionId}
          sessionId={sessionId}
          active
        />
      </Box>
    </Box>
  )
}
