import type { TCommand, TSessionCommandsProps } from '@TTH/types'

import { toast } from 'sonner'
import { useNavigate } from 'react-router'
import { EPermResource } from '@tdsk/domain'
import AddIcon from '@mui/icons-material/Add'
import { useState, useCallback } from 'react'
import ShareIcon from '@mui/icons-material/Share'
import LogoutIcon from '@mui/icons-material/Logout'
import { CommandConfig } from '@TTH/constants/sessions'
import { usePermissions } from '@TTH/hooks/permissions'
import { useOpenSessions, useOrgId } from '@TTH/state/selectors'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'
import { restartSandbox } from '@TTH/actions/sandboxes/restartSandbox'
import { recreateSandbox } from '@TTH/actions/sandboxes/recreateSandbox'
import { openSession, closeSession, sendControl } from '@TTH/actions/sessions'
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  DialogContentText,
} from '@mui/material'

export const SessionCommands = (props: TSessionCommandsProps) => {
  const { sandboxId, sessionId, projectId, isOwner, onPendingOp } = props
  const navigate = useNavigate()
  const openSessions = useOpenSessions()
  const orgId = useOrgId()
  const { canExec } = usePermissions()
  const canExecSandbox = canExec(EPermResource.sandbox)
  const [executing, setExecuting] = useState<TCommand | null>(null)
  const [confirmAction, setConfirmAction] = useState<TCommand | null>(null)

  const session = openSessions.get(sessionId)
  const isPublic = session?.visibility === `public`

  const handleConfirm = useCallback(async () => {
    const action = confirmAction
    if (!action || !orgId) return

    setConfirmAction(null)
    setExecuting(action)

    if (action === `restart` || action === `recreate`) onPendingOp(action)

    try {
      if (action === `stop`) {
        await stopSandbox({ sandboxId, orgId })
        navigate(`/sandbox/${sandboxId}`, { replace: true })
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

  const handleNewSession = useCallback(async () => {
    if (!orgId) return
    try {
      const newSessionId = await openSession({
        sandboxId,
        orgId,
        projectId,
        sessionId: null,
      })
      navigate(`/session/${newSessionId}`, {
        replace: true,
        state: { sandboxId, projectId },
      })
    } catch (err) {
      toast.error(`Failed to create session`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    }
  }, [sandboxId, orgId, projectId, navigate])

  const handleToggleShare = useCallback(() => {
    const newVisibility = isPublic ? `private` : `public`
    sendControl(sessionId, { type: `visibility`, visibility: newVisibility })
  }, [sessionId, isPublic])

  const handleLeave = useCallback(() => {
    closeSession(sessionId)
  }, [sessionId])

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
                  startIcon={
                    executing === cmd ? <CircularProgress size={14} /> : cfg.icon
                  }
                  onClick={() => setConfirmAction(cmd)}
                  disabled={executing !== null}
                  sx={{ textTransform: `none`, minWidth: 0, px: 1.5 }}
                >
                  {cfg.label}
                </Button>
              )
            })}
            <Button
              size='small'
              variant='outlined'
              startIcon={<AddIcon sx={{ fontSize: 18 }} />}
              onClick={handleNewSession}
              disabled={executing !== null}
              sx={{ textTransform: `none`, minWidth: 0, px: 1.5 }}
            >
              New
            </Button>
          </>
        )}
        {isOwner && (
          <Button
            size='small'
            variant={isPublic ? `contained` : `outlined`}
            color={isPublic ? `primary` : (`default` as any)}
            startIcon={<ShareIcon sx={{ fontSize: 18 }} />}
            onClick={handleToggleShare}
            disabled={executing !== null}
            sx={{ textTransform: `none`, minWidth: 0, px: 1.5 }}
          >
            {isPublic ? `Shared` : `Share`}
          </Button>
        )}
        {!isOwner && (
          <Button
            size='small'
            variant='outlined'
            startIcon={<LogoutIcon sx={{ fontSize: 18 }} />}
            onClick={handleLeave}
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
            onClick={handleConfirm}
            color={config?.color}
            variant='contained'
            autoFocus
          >
            {config?.label}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
