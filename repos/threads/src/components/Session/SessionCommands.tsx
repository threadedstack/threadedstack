import type { TCommand, TSessionCommandsProps } from '@TTH/types'
import type { TSandboxSession } from '@tdsk/domain'

import { toast } from 'sonner'
import { nav } from '@TTH/services/nav'
import { EPermResource } from '@tdsk/domain'
import AddIcon from '@mui/icons-material/Add'
import { useState, useCallback } from 'react'
import ShareIcon from '@mui/icons-material/Share'
import LinkOffIcon from '@mui/icons-material/LinkOff'
import LogoutIcon from '@mui/icons-material/Logout'
import { CommandConfig } from '@TTH/constants/sessions'
import { usePermissions } from '@TTH/hooks/permissions'
import { useOpenSessions, useOrgId } from '@TTH/state/selectors'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'
import { restartSandbox } from '@TTH/actions/sandboxes/restartSandbox'
import { recreateSandbox } from '@TTH/actions/sandboxes/recreateSandbox'
import {
  sendControl,
  openSession,
  closeSession,
  disconnectSession,
} from '@TTH/actions/sessions'
import {
  Box,
  List,
  Button,
  Dialog,
  ListItem,
  DialogTitle,
  ListItemText,
  DialogContent,
  DialogActions,
  CircularProgress,
  DialogContentText,
} from '@mui/material'

export const SessionCommands = (props: TSessionCommandsProps) => {
  const { isOwner, sandboxId, sessionId, projectId, onPendingOp } = props

  const [orgId] = useOrgId()
  const { canExec } = usePermissions()
  const [openSessions] = useOpenSessions()
  const canExecSandbox = canExec(EPermResource.sandbox)
  const [executing, setExecuting] = useState<TCommand | null>(null)
  const [confirmAction, setConfirmAction] = useState<TCommand | null>(null)
  const [forceStopSessions, setForceStopSessions] = useState<TSandboxSession[] | null>(
    null
  )

  const session = openSessions.get(sessionId)
  const isPublic = session?.visibility === `public`

  const onConfirm = useCallback(async () => {
    const action = confirmAction
    if (!action || !orgId) return

    setConfirmAction(null)
    setExecuting(action)

    if (action === `restart` || action === `recreate`) onPendingOp(action)

    try {
      if (action === `stop`) {
        const result = await stopSandbox({ sandboxId, orgId, projectId })
        if (result.stopped) {
          nav.sandbox(orgId, projectId, sandboxId, { replace: true })
          return
        }
        if (result.stopped === false && result.activeSessions.length) {
          setForceStopSessions(result.activeSessions)
          return
        }
        toast.error(`Failed to stop sandbox`, {
          description: `The sandbox could not be stopped. It may already be stopped or stopping.`,
        })
        return
      }
      if (action === `restart`) {
        await restartSandbox({ sandboxId, orgId, projectId })
      } else if (action === `recreate`) {
        await recreateSandbox({ sandboxId, orgId, projectId })
      }
    } catch (err) {
      console.error(`[SessionCommands] ${action} failed:`, err)
      toast.error(`Failed to ${action} sandbox`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    } finally {
      setExecuting(null)
      onPendingOp(null)
    }
  }, [confirmAction, sandboxId, orgId, projectId, onPendingOp])

  const onForceStop = useCallback(async () => {
    if (!orgId) return
    setForceStopSessions(null)
    setExecuting(`stop`)
    try {
      await stopSandbox({ sandboxId, orgId, projectId, force: true })
      nav.sandbox(orgId, projectId, sandboxId, { replace: true })
    } catch (err) {
      console.error(`[SessionCommands] force stop failed:`, err)
      toast.error(`Failed to stop sandbox`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    } finally {
      setExecuting(null)
    }
  }, [sandboxId, orgId, projectId])

  const onNewSession = useCallback(async () => {
    if (!orgId) return
    try {
      const newSessionId = await openSession({
        sandboxId,
        orgId,
        projectId,
        sessionId: null,
      })
      nav.session(orgId, projectId, newSessionId, {
        replace: true,
        state: { sandboxId, projectId },
      })
    } catch (err) {
      toast.error(`Failed to create session`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    }
  }, [sandboxId, orgId, projectId])

  const onToggleShare = useCallback(() => {
    const newVisibility = isPublic ? `private` : `public`
    sendControl(sessionId, { type: `visibility`, visibility: newVisibility })
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

  const config = confirmAction ? CommandConfig[confirmAction] : null

  return (
    <>
      <Box sx={{ display: `flex`, gap: 0.5 }}>
        {canExecSandbox && (
          <>
            {(Object.keys(CommandConfig) as TCommand[]).map((cmd) => {
              const cfg = CommandConfig[cmd]
              return (
                <Button
                  key={cmd}
                  size='small'
                  color={cfg.color}
                  variant='outlined'
                  disabled={executing !== null}
                  onClick={() => setConfirmAction(cmd)}
                  sx={{ textTransform: `none`, minWidth: 0, px: 1.5 }}
                  startIcon={
                    executing === cmd ? <CircularProgress size={14} /> : cfg.icon
                  }
                >
                  {cfg.label}
                </Button>
              )
            })}
            <Button
              size='small'
              variant='outlined'
              onClick={onNewSession}
              disabled={executing !== null}
              startIcon={<AddIcon sx={{ fontSize: 18 }} />}
              sx={{ textTransform: `none`, minWidth: 0, px: 1.5 }}
            >
              New
            </Button>
          </>
        )}
        {isOwner && (
          <>
            <Button
              size='small'
              variant='outlined'
              onClick={onDisconnect}
              disabled={executing !== null}
              startIcon={<LinkOffIcon sx={{ fontSize: 18 }} />}
              sx={{ textTransform: `none`, minWidth: 0, px: 1.5 }}
            >
              Disconnect
            </Button>
            <Button
              size='small'
              onClick={onToggleShare}
              disabled={executing !== null}
              variant={isPublic ? `contained` : `outlined`}
              startIcon={<ShareIcon sx={{ fontSize: 18 }} />}
              color={isPublic ? `primary` : (`default` as any)}
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

      <Dialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
      >
        <DialogTitle>{config?.dialogTitle}</DialogTitle>
        <DialogContent>
          <DialogContentText>{config?.dialogText}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmAction(null)}>Cancel</Button>
          <Button
            autoFocus
            variant='contained'
            onClick={onConfirm}
            color={config?.color}
          >
            {config?.label}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={forceStopSessions !== null}
        onClose={() => setForceStopSessions(null)}
      >
        <DialogTitle>Active Sessions</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This sandbox has {forceStopSessions?.length} active session(s). Stopping will
            disconnect all users.
          </DialogContentText>
          <List dense>
            {forceStopSessions?.map((s) => (
              <ListItem key={s.sessionId}>
                <ListItemText
                  primary={s.sessionId.slice(0, 12)}
                  secondary={`Connected ${new Date(s.connectedAt).toLocaleTimeString()}`}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setForceStopSessions(null)}>Cancel</Button>
          <Button
            autoFocus
            variant='contained'
            color='error'
            onClick={onForceStop}
          >
            Force Stop
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
