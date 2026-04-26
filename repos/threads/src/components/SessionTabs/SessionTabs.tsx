import { useNavigate } from 'react-router'
import { Close } from '@mui/icons-material'
import { useCallback, useMemo } from 'react'
import { Box, Tabs, Tab, Badge } from '@mui/material'
import { useSessionMode } from '@TTH/hooks/session/useSessionMode'
import { activateSession, closeSession } from '@TTH/actions/sessions'
import { useSandboxSessions } from '@TTH/hooks/sandbox/useSandboxSessions'
import {
  useSandboxes,
  useOpenSessions,
  useActiveSession,
  useOrgId,
} from '@TTH/state/selectors'

type TSessionTab = {
  sessionId: string
  onClose: (id: string) => void
  onSelect: (sessionId: string) => void
  session: { sandboxId: string; sessionId: string; runtime: string }
}

type TStatusDot = { sessionId: string }

type TTabLabel = {
  name: string
  sessionId: string
  onClose: (id: string) => void
}

const StatusDot = (props: TStatusDot) => {
  const mode = useSessionMode(props.sessionId)

  const color = useMemo(() => {
    switch (mode) {
      case `streaming`:
        return `success.main`
      case `interactive`:
        return `warning.main`
      default:
        return `text.disabled`
    }
  }, [mode])

  return (
    <Box
      sx={{
        mr: 1,
        width: 8,
        height: 8,
        flexShrink: 0,
        borderRadius: `50%`,
        backgroundColor: color,
      }}
    />
  )
}

const TabLabel = (props: TTabLabel) => {
  const { sessionId, name, onClose } = props
  const mode = useSessionMode(sessionId)
  const showBadge = mode === `interactive`

  const handleClose = useCallback(
    (evt: React.MouseEvent) => {
      evt.stopPropagation()
      onClose(sessionId)
    },
    [sessionId, onClose]
  )

  return (
    <Box
      gap={0.5}
      display='flex'
      alignItems='center'
    >
      <StatusDot sessionId={sessionId} />
      <Badge
        badgeContent={showBadge ? `!` : undefined}
        color='warning'
        sx={{
          '& .MuiBadge-badge': {
            height: 16,
            fontSize: 10,
            minWidth: 16,
          },
        }}
      >
        <Box
          component='span'
          sx={{
            maxWidth: 120,
            overflow: `hidden`,
            whiteSpace: `nowrap`,
            textOverflow: `ellipsis`,
          }}
        >
          {name}
        </Box>
      </Badge>
      <Close
        onClick={handleClose}
        sx={{
          ml: 0.5,
          p: 0.25,
          fontSize: 14,
          cursor: `pointer`,
          borderRadius: `50%`,
          '&:hover': { backgroundColor: `action.hover` },
        }}
      />
    </Box>
  )
}

type THTabLabelSession = {
  runtime: string
  sandboxId: string
  sessionId: string
}

const useTabLabel = (session: THTabLabelSession) => {
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
  }, [sandboxes, sbSessions, session.runtime, session.sandboxId, session.sessionId])
}

const SessionTabLabel = (props: Omit<TSessionTab, 'onSelect'>) => {
  const { session, onClose, sessionId } = props
  const label = useTabLabel(session)

  return (
    <TabLabel
      name={label}
      onClose={onClose}
      sessionId={sessionId}
    />
  )
}

export type TSessionTabs = {}

export const SessionTabs = (props: TSessionTabs) => {
  const navigate = useNavigate()
  const [orgId] = useOrgId()
  const [openSessions] = useOpenSessions()
  const [activeSession] = useActiveSession()

  const sessions = useMemo(() => Array.from(openSessions.entries()), [openSessions])

  // Only pass activeSession to Tabs if it matches an actual Tab child,
  // otherwise MUI warns about an invalid value
  const tabValue =
    activeSession && openSessions.has(activeSession) ? activeSession : false

  const onSelect = useCallback(
    (sessionId: string) => {
      const session = openSessions.get(sessionId)
      if (!session?.projectId || !orgId) return
      activateSession(sessionId)
      navigate(`/orgs/${orgId}/projects/${session.projectId}/session/${sessionId}`, {
        state: { sandboxId: session.sandboxId, projectId: session.projectId },
      })
    },
    [navigate, openSessions, orgId]
  )

  const onClose = useCallback((sessionId: string) => {
    closeSession(sessionId)
  }, [])

  if (!sessions.length) return null

  return (
    <Box
      sx={{
        borderBottom: 1,
        borderColor: `divider`,
      }}
    >
      <Tabs
        variant='scrollable'
        scrollButtons='auto'
        value={tabValue}
        onChange={(_evt, value: string) => onSelect(value)}
        sx={{
          minHeight: 40,
          '& .MuiTab-root': {
            py: 0.5,
            px: 1.5,
            minHeight: 40,
            textTransform: `none`,
          },
        }}
      >
        {sessions.map(([sessionId, session]) => (
          <Tab
            key={sessionId}
            value={sessionId}
            onClick={() => onSelect(sessionId)}
            label={
              <SessionTabLabel
                session={session}
                onClose={onClose}
                sessionId={sessionId}
              />
            }
          />
        ))}
      </Tabs>
    </Box>
  )
}
