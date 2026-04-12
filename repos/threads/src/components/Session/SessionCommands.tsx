import { useState, useCallback } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from '@mui/material'
import StopIcon from '@mui/icons-material/Stop'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import RefreshIcon from '@mui/icons-material/Refresh'
import { toast } from 'sonner'
import { useOpenSessions, useOrgId } from '@TTH/state/selectors'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'
import { restartSandbox } from '@TTH/actions/sandboxes/restartSandbox'
import { recreateSandbox } from '@TTH/actions/sandboxes/recreateSandbox'

type TCommand = 'stop' | 'restart' | 'recreate'

type TSessionCommandsProps = {
  sandboxId: string
  projectId: string
  onPendingOp: (op: 'restart' | 'recreate' | null) => void
}

const commandConfig: Record<
  TCommand,
  {
    label: string
    icon: React.ReactNode
    color: 'error' | 'warning'
    dialogTitle: string
    dialogText: string
  }
> = {
  stop: {
    label: `Stop`,
    icon: <StopIcon sx={{ fontSize: 18 }} />,
    color: `error`,
    dialogTitle: `Stop Sandbox`,
    dialogText: `Stop this sandbox session? The pod will be shut down.`,
  },
  restart: {
    label: `Restart`,
    icon: <RestartAltIcon sx={{ fontSize: 18 }} />,
    color: `warning`,
    dialogTitle: `Restart Sandbox`,
    dialogText: `Restart this sandbox? Your session history will be preserved.`,
  },
  recreate: {
    label: `Recreate`,
    icon: <RefreshIcon sx={{ fontSize: 18 }} />,
    color: `warning`,
    dialogTitle: `Recreate Sandbox`,
    dialogText: `Recreate this sandbox from scratch? All session history will be lost.`,
  },
}

export const SessionCommands = (props: TSessionCommandsProps) => {
  const { sandboxId, projectId, onPendingOp } = props
  const openSessions = useOpenSessions()
  const orgId = useOrgId()
  const [executing, setExecuting] = useState<TCommand | null>(null)
  const [confirmAction, setConfirmAction] = useState<TCommand | null>(null)

  const handleConfirm = useCallback(async () => {
    const action = confirmAction
    if (!action || !orgId) return

    setConfirmAction(null)
    setExecuting(action)

    if (action === `restart` || action === `recreate`) onPendingOp(action)

    try {
      if (action === `stop`) {
        await stopSandbox({ sandboxId, orgId })
      } else if (action === `restart`) {
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

  const session = openSessions.get(sandboxId)
  if (!session || !orgId) return null

  const config = confirmAction ? commandConfig[confirmAction] : null

  return (
    <>
      <Box sx={{ display: `flex`, gap: 0.5 }}>
        {(Object.keys(commandConfig) as TCommand[]).map((cmd) => {
          const cfg = commandConfig[cmd]
          return (
            <Button
              key={cmd}
              size='small'
              color={cfg.color}
              variant='outlined'
              startIcon={executing === cmd ? <CircularProgress size={14} /> : cfg.icon}
              onClick={() => setConfirmAction(cmd)}
              disabled={executing !== null}
              sx={{ textTransform: `none`, minWidth: 0, px: 1.5 }}
            >
              {cfg.label}
            </Button>
          )
        })}
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
