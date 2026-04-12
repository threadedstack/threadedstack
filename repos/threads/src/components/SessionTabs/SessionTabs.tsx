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
import { Close } from '@mui/icons-material'
import { Box, Tabs, Tab, Badge, IconButton } from '@mui/material'

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
  const toolState = useToolState(props.sessionId)

  const color = useMemo(() => {
    switch (toolState) {
      case `working`:
        return `success.main`
      case `permission`:
        return `warning.main`
      default:
        return `text.disabled`
    }
  }, [toolState])

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
  const toolState = useToolState(sessionId)
  const showBadge = toolState === `permission`

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
      <IconButton
        size='small'
        onClick={handleClose}
        sx={{ ml: 0.5, p: 0.25 }}
      >
        <Close sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  )
}

type THTabLabelSession = {
  runtime: string
  sandboxId: string
  sessionId: string
}

const useTabLabel = (session: THTabLabelSession) => {
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

const SessionTab = (props: TSessionTab) => {
  const { session, onClose, onSelect, sessionId } = props

  const label = useTabLabel(session)
  const onClick = useCallback(() => {
    onSelect(sessionId)
  }, [sessionId, onSelect])

  return (
    <Tab
      onClick={onClick}
      value={sessionId}
      label={
        <TabLabel
          name={label}
          onClose={onClose}
          sessionId={sessionId}
        />
      }
    />
  )
}

export type TSessionTabs = {}

export const SessionTabs = (props: TSessionTabs) => {
  const navigate = useNavigate()
  const openSessions = useOpenSessions()
  const activeSession = useActiveSession()

  const sessions = useMemo(() => Array.from(openSessions.entries()), [openSessions])

  const onSelect = useCallback(
    (sessionId: string) => {
      setActiveSession(sessionId)
      const session = openSessions.get(sessionId)
      navigate(`/session/${sessionId}`, {
        state: session
          ? { sandboxId: session.sandboxId, projectId: session.projectId }
          : undefined,
      })
    },
    [navigate, openSessions]
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
        value={activeSession || false}
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
          <SessionTab
            key={sessionId}
            session={session}
            onClose={onClose}
            onSelect={onSelect}
            sessionId={sessionId}
          />
        ))}
      </Tabs>
    </Box>
  )
}
