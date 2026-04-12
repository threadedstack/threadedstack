import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { closeSession } from '@TTH/actions/sessions'
import { setActiveSession } from '@TTH/state/accessors'
import {
  useOpenSessions,
  useActiveSession,
  useToolState,
  useSandboxes,
  useSessionsForSandbox,
} from '@TTH/state/selectors'
import { Box, Chip } from '@mui/material'

const useChipLabel = (session: {
  sandboxId: string
  sessionId: string
  runtime: string
}) => {
  const sandboxes = useSandboxes()
  const sbSessions = useSessionsForSandbox(session.sandboxId)

  return useMemo(() => {
    const sandbox = sandboxes.find((s) => s.id === session.sandboxId)
    const baseName = sandbox?.name || session.runtime || session.sandboxId
    if (sbSessions.length > 1) {
      const idx = sbSessions.findIndex((s) => s.sessionId === session.sessionId)
      return `${baseName} (${idx + 1})`
    }
    return baseName
  }, [sandboxes, session.sandboxId, session.sessionId, session.runtime, sbSessions])
}

const SessionChip = (props: {
  sessionId: string
  session: { sandboxId: string; sessionId: string; runtime: string }
  active: boolean
}) => {
  const { sessionId, session, active } = props
  const navigate = useNavigate()
  const toolState = useToolState(sessionId)
  const label = useChipLabel(session)

  const dotColor = useMemo(() => {
    switch (toolState) {
      case `working`:
        return `success.main`
      case `permission`:
        return `warning.main`
      default:
        return `text.disabled`
    }
  }, [toolState])

  const handleClick = useCallback(() => {
    setActiveSession(sessionId)
    navigate(`/session/${sessionId}`, {
      state: { sandboxId: session.sandboxId },
    })
  }, [sessionId, session, navigate])

  const handleDelete = useCallback(() => {
    closeSession(sessionId)
  }, [sessionId])

  return (
    <Chip
      label={
        <Box
          display='flex'
          alignItems='center'
          gap={0.75}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: `50%`,
              backgroundColor: dotColor,
              flexShrink: 0,
            }}
          />
          {label}
        </Box>
      }
      size='small'
      variant={active ? `filled` : `outlined`}
      color={active ? `primary` : `default`}
      onClick={handleClick}
      onDelete={handleDelete}
      sx={{ flexShrink: 0 }}
    />
  )
}

export type TOpenSessionStrip = {}

export const OpenSessionStrip = (_props: TOpenSessionStrip) => {
  const openSessions = useOpenSessions()
  const activeSession = useActiveSession()

  const sessions = useMemo(() => Array.from(openSessions.entries()), [openSessions])

  if (!sessions.length) return null

  return (
    <Box
      sx={{
        display: `flex`,
        gap: 1,
        px: 2,
        py: 1,
        overflowX: `auto`,
        whiteSpace: `nowrap`,
        borderBottom: 1,
        borderColor: `divider`,
        '&::-webkit-scrollbar': { display: `none` },
        scrollbarWidth: `none`,
      }}
    >
      {sessions.map(([sessionId, session]) => (
        <SessionChip
          key={sessionId}
          sessionId={sessionId}
          session={session}
          active={activeSession === sessionId}
        />
      ))}
    </Box>
  )
}
