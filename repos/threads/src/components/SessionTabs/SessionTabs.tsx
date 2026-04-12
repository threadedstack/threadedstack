import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { closeSession } from '@TTH/actions/sessions'
import { setActiveSession } from '@TTH/state/accessors'
import { useOpenSessions, useActiveSession, useToolState } from '@TTH/state/selectors'
import { Close } from '@mui/icons-material'
import { Box, Tabs, Tab, Badge, IconButton } from '@mui/material'

const StatusDot = (props: { sandboxId: string }) => {
  const toolState = useToolState(props.sandboxId)

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
        width: 8,
        height: 8,
        borderRadius: `50%`,
        backgroundColor: color,
        mr: 1,
        flexShrink: 0,
      }}
    />
  )
}

const TabLabel = (props: {
  sandboxId: string
  name: string
  onClose: (id: string) => void
}) => {
  const { sandboxId, name, onClose } = props
  const toolState = useToolState(sandboxId)
  const showBadge = toolState === `permission`

  const handleClose = useCallback(
    (evt: React.MouseEvent) => {
      evt.stopPropagation()
      onClose(sandboxId)
    },
    [sandboxId, onClose]
  )

  return (
    <Box
      display='flex'
      alignItems='center'
      gap={0.5}
    >
      <StatusDot sandboxId={sandboxId} />
      <Badge
        badgeContent={showBadge ? `!` : undefined}
        color='warning'
        sx={{
          '& .MuiBadge-badge': {
            fontSize: 10,
            minWidth: 16,
            height: 16,
          },
        }}
      >
        <Box
          component='span'
          sx={{
            maxWidth: 120,
            overflow: `hidden`,
            textOverflow: `ellipsis`,
            whiteSpace: `nowrap`,
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

export type TSessionTabs = {}

export const SessionTabs = (_props: TSessionTabs) => {
  const navigate = useNavigate()
  const openSessions = useOpenSessions()
  const activeSession = useActiveSession()

  const sessions = useMemo(() => Array.from(openSessions.entries()), [openSessions])

  const handleChange = useCallback(
    (_evt: React.SyntheticEvent, value: string) => {
      setActiveSession(value)
      navigate(`/session/${value}`)
    },
    [navigate]
  )

  const handleClose = useCallback((sandboxId: string) => {
    closeSession(sandboxId)
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
        value={activeSession || false}
        onChange={handleChange}
        variant='scrollable'
        scrollButtons='auto'
        sx={{
          minHeight: 40,
          '& .MuiTab-root': {
            minHeight: 40,
            textTransform: `none`,
            py: 0.5,
            px: 1.5,
          },
        }}
      >
        {sessions.map(([sandboxId, session]) => (
          <Tab
            key={sandboxId}
            value={sandboxId}
            label={
              <TabLabel
                sandboxId={sandboxId}
                name={session.runtime || sandboxId}
                onClose={handleClose}
              />
            }
          />
        ))}
      </Tabs>
    </Box>
  )
}
