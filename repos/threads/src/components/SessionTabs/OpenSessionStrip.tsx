import { Box, Chip } from '@mui/material'
import { useNavigate } from 'react-router'
import { useCallback, useMemo } from 'react'
import { useSessionMode } from '@TTH/hooks/session/useSessionMode'
import { activateSession, closeSession } from '@TTH/actions/sessions'
import { useSandboxSessions } from '@TTH/hooks/sandbox/useSandboxSessions'
import { useSandboxes, useOpenSessions, useActiveSession } from '@TTH/state/selectors'

type TSession = {
  runtime: string
  sandboxId: string
  sessionId: string
}

const useChipLabel = (session: TSession) => {
  const { runtime, sandboxId, sessionId } = session

  const [sandboxes] = useSandboxes()
  const sbSessions = useSandboxSessions(session.sandboxId)

  return useMemo(() => {
    const sandbox = sandboxes.find((s) => s.id === session.sandboxId)
    const baseName = sandbox?.name || session.runtime || session.sandboxId
    if (sbSessions.length > 1) {
      const idx = sbSessions.findIndex((s) => s.sessionId === session.sessionId)
      return `${baseName} (${idx + 1})`
    }
    return baseName
  }, [runtime, sandboxes, sandboxId, sessionId, sbSessions])
}

type TSessionChip = {
  active: boolean
  sessionId: string
  session: TSession
}

const SessionChip = (props: TSessionChip) => {
  const { sessionId, session, active } = props
  const navigate = useNavigate()
  const mode = useSessionMode(sessionId)
  const label = useChipLabel(session)

  const dotColor = useMemo(() => {
    switch (mode) {
      case `streaming`:
        return `success.main`
      case `interactive`:
        return `warning.main`
      default:
        return `text.disabled`
    }
  }, [mode])

  const handleClick = useCallback(() => {
    activateSession(sessionId)
    navigate(`/session/${sessionId}`, {
      state: { sandboxId: session.sandboxId },
    })
  }, [sessionId, session, navigate])

  const handleDelete = useCallback(() => {
    closeSession(sessionId)
  }, [sessionId])

  return (
    <Chip
      size='small'
      onClick={handleClick}
      onDelete={handleDelete}
      sx={{ flexShrink: 0 }}
      color={active ? `primary` : `default`}
      variant={active ? `filled` : `outlined`}
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
              flexShrink: 0,
              borderRadius: `50%`,
              backgroundColor: dotColor,
            }}
          />
          {label}
        </Box>
      }
    />
  )
}

export type TOpenSessionStrip = {}

export const OpenSessionStrip = (_props: TOpenSessionStrip) => {
  const [openSessions] = useOpenSessions()
  const [activeSession] = useActiveSession()

  const sessions = useMemo(() => Array.from(openSessions.entries()), [openSessions])

  if (!sessions.length) return null

  return (
    <Box
      sx={{
        py: 1,
        px: 2,
        gap: 1,
        borderBottom: 1,
        display: `flex`,
        overflowX: `auto`,
        whiteSpace: `nowrap`,
        borderColor: `divider`,
        scrollbarWidth: `none`,
        '&::-webkit-scrollbar': { display: `none` },
      }}
    >
      {sessions.map(([sessionId, session]) => (
        <SessionChip
          key={sessionId}
          session={session}
          sessionId={sessionId}
          active={activeSession === sessionId}
        />
      ))}
    </Box>
  )
}
