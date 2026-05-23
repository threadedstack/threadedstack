import type { TSessionCommandsProps } from '@TTH/types'

import { toast } from 'sonner'
import { nav } from '@TTH/services/nav'
import { Box, Button } from '@mui/material'
import { useState, useCallback } from 'react'
import AddIcon from '@mui/icons-material/Add'
import ShareIcon from '@mui/icons-material/Share'
import LogoutIcon from '@mui/icons-material/Logout'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import { usePermissions } from '@TTH/hooks/permissions'
import { EShellMsg, EPermResource } from '@tdsk/domain'
import { useOpenSessions, useOrgId } from '@TTH/state/selectors'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'
import {
  sendControl,
  openSession,
  closeSession,
  disconnectSession,
} from '@TTH/actions/sessions'

export const SessionCommands = (props: TSessionCommandsProps) => {
  const { isOwner, sandboxId, sessionId, projectId } = props

  const [orgId] = useOrgId()
  const { canExec } = usePermissions()
  const [openSessions] = useOpenSessions()
  const canExecSandbox = canExec(EPermResource.sandbox)
  const [creating, setCreating] = useState(false)

  const session = openSessions.get(sessionId)
  const isPublic = session?.visibility === `public`

  const onNewSession = useCallback(async () => {
    if (!orgId) return
    setCreating(true)
    try {
      const { cols, rows } = estimateTerminalDimensions()
      const { sessionId: newSessionId, instanceId: newInstanceId } = await openSession({
        cols,
        rows,
        orgId,
        sandboxId,
        projectId,
        sessionId: null,
        instanceId: session?.instanceId,
      })
      nav.session(orgId, projectId, newInstanceId, newSessionId, {
        replace: true,
        state: { sandboxId, projectId, instanceId: newInstanceId },
      })
    } catch (err) {
      toast.error(`Failed to create session`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    } finally {
      setCreating(false)
    }
  }, [sandboxId, orgId, projectId, session?.instanceId])

  const onToggleShare = useCallback(() => {
    const newVisibility = isPublic ? `private` : `public`
    const sent = sendControl(sessionId, {
      type: EShellMsg.Visibility,
      visibility: newVisibility,
    })
    if (!sent)
      toast.error(`Failed to change visibility`, { description: `Connection lost` })
  }, [sessionId, isPublic])

  const onDisconnect = useCallback(() => {
    if (!orgId) return
    try {
      const result = disconnectSession(sessionId)
      if (result) nav.sandbox(orgId, result.projectId, sandboxId, { replace: true })
    } catch (err) {
      console.error(`[SessionCommands] disconnect failed:`, err)
      toast.error(`Failed to disconnect session`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    }
  }, [sessionId, orgId, sandboxId])

  const onLeave = useCallback(() => closeSession(sessionId), [sessionId])

  if (!session || !orgId) return null

  return (
    <Box sx={{ display: `flex`, gap: 0.5 }}>
      {canExecSandbox && (
        <Button
          size='small'
          variant='outlined'
          onClick={onNewSession}
          disabled={creating}
          startIcon={<AddIcon sx={{ fontSize: 18 }} />}
          sx={{ textTransform: `none`, minWidth: 0, px: 1.5 }}
        >
          New
        </Button>
      )}
      {isOwner && (
        <>
          <Button
            size='small'
            variant='outlined'
            onClick={onDisconnect}
            startIcon={<LinkOffIcon sx={{ fontSize: 18 }} />}
            sx={{ textTransform: `none`, minWidth: 0, px: 1.5 }}
          >
            Disconnect
          </Button>
          <Button
            size='small'
            onClick={onToggleShare}
            variant={isPublic ? `contained` : `outlined`}
            startIcon={<ShareIcon sx={{ fontSize: 18 }} />}
            color={isPublic ? `primary` : `inherit`}
            sx={{ textTransform: `none`, minWidth: 0, px: 1.5 }}
          >
            {isPublic ? `Shared` : `Share`}
          </Button>
        </>
      )}
      {!isOwner && (
        <Button
          size='small'
          onClick={onLeave}
          variant='outlined'
          startIcon={<LogoutIcon sx={{ fontSize: 18 }} />}
          sx={{ textTransform: `none`, minWidth: 0, px: 1.5 }}
        >
          Leave
        </Button>
      )}
    </Box>
  )
}
