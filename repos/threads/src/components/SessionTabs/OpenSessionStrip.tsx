import { useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { closeSession } from '@TTH/actions/sessions'
import { setActiveSession } from '@TTH/state/accessors'
import { useOpenSessions, useActiveSession, useToolState } from '@TTH/state/selectors'
import { Box, Chip } from '@mui/material'

const SessionChip = (props: { sandboxId: string; runtime: string; active: boolean }) => {
  const { sandboxId, runtime, active } = props
  const navigate = useNavigate()
  const toolState = useToolState(sandboxId)

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
    setActiveSession(sandboxId)
    navigate(`/session/${sandboxId}`)
  }, [sandboxId, navigate])

  const handleDelete = useCallback(() => {
    closeSession(sandboxId)
  }, [sandboxId])

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
          {runtime || sandboxId}
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
      {sessions.map(([sandboxId, session]) => (
        <SessionChip
          key={sandboxId}
          sandboxId={sandboxId}
          runtime={session.runtime}
          active={activeSession === sandboxId}
        />
      ))}
    </Box>
  )
}
