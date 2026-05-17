import type { TSandboxInstance } from '@tdsk/domain'

import { toast } from 'sonner'
import { nav } from '@TTH/services/nav'
import { useParams } from 'react-router'
import { Loading } from '@tdsk/components'
import { Page } from '@TTH/pages/Page/Page'
import { EPermResource } from '@tdsk/domain'
import { openSession } from '@TTH/actions/sessions'
import { sandboxApi } from '@TTH/services/sandboxApi'
import { usePermissions } from '@TTH/hooks/permissions'
import { CommandConfig } from '@TTH/constants/sessions'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'
import { restartSandbox } from '@TTH/actions/sandboxes/restartSandbox'
import { recreateSandbox } from '@TTH/actions/sandboxes/recreateSandbox'
import { useState, useCallback, useEffect, useMemo } from 'react'
import { ArrowBack, PlayArrow, Login, Add } from '@mui/icons-material'
import {
  useUser,
  useOrgId,
  useSandboxes,
  useOpenSessions,
  useBackendSessions,
} from '@TTH/state/selectors'
import {
  Box,
  Chip,
  Card,
  List,
  Button,
  Dialog,
  ListItem,
  Typography,
  IconButton,
  DialogTitle,
  ListItemText,
  DialogContent,
  DialogActions,
  CardActionArea,
  CircularProgress,
  DialogContentText,
} from '@mui/material'

import type { TCommand } from '@TTH/types'
import type { TSandboxSession } from '@tdsk/domain'

type TInstanceParams = {
  orgId: string
  projectId: string
  sandboxId: string
  instanceId: string
}

const Instance = () => {
  const [user] = useUser()
  const [orgId] = useOrgId()
  const [sandboxes] = useSandboxes()

  const {
    sandboxId,
    instanceId,
    orgId: paramOrgId,
    projectId: paramProjectId,
  } = useParams<TInstanceParams>()

  const { canExec } = usePermissions()
  const canExecSandbox = canExec(EPermResource.sandbox)

  const [openSessions] = useOpenSessions()
  const [backendSessionsMap] = useBackendSessions()
  const [connecting, setConnecting] = useState(false)
  const [instance, setInstance] = useState<TSandboxInstance | null>(null)
  const [loadingInstance, setLoadingInstance] = useState(true)
  const [executing, setExecuting] = useState<TCommand | null>(null)
  const [confirmAction, setConfirmAction] = useState<TCommand | null>(null)
  const [forceStopSessions, setForceStopSessions] = useState<TSandboxSession[] | null>(
    null
  )

  const sandbox = useMemo(
    () => sandboxes.find((s) => s.id === sandboxId),
    [sandboxes, sandboxId]
  )

  const resolvedOrgId = paramOrgId || orgId
  const projectId = paramProjectId || sandbox?.projects?.[0]?.id || ``
  const sessions = sandboxId ? (backendSessionsMap.get(sandboxId) ?? []) : []

  const instanceSessions = useMemo(
    () => sessions.filter((s) => s.instanceId === instanceId),
    [sessions, instanceId]
  )

  const mySessions = useMemo(
    () => instanceSessions.filter((s) => s.userId === user?.id),
    [instanceSessions, user?.id]
  )

  const sharedSessions = useMemo(
    () =>
      instanceSessions.filter((s) => s.userId !== user?.id && s.visibility === `public`),
    [instanceSessions, user?.id]
  )

  const fetchInstance = useCallback(() => {
    if (!sandboxId || !resolvedOrgId || !projectId) return
    setLoadingInstance(true)
    sandboxApi
      .listInstances(resolvedOrgId, projectId, sandboxId)
      .then((resp) => {
        if (resp.error) {
          toast.error(`Failed to load instance`, {
            description: resp.error.message || `Could not fetch instance details`,
          })
          return
        }
        if (resp.data) {
          const found = resp.data.instances.find((i) => i.instanceId === instanceId)
          setInstance(found ?? null)
        }
      })
      .catch((err) => {
        console.error(`[Instance] fetchInstance failed:`, err)
        toast.error(`Failed to load instance`, {
          description:
            err instanceof Error ? err.message : `An unexpected error occurred`,
        })
      })
      .finally(() => setLoadingInstance(false))
  }, [sandboxId, resolvedOrgId, projectId, instanceId])

  useEffect(() => {
    fetchInstance()
  }, [fetchInstance])

  const onStart = useCallback(
    async (sessionId?: string | null) => {
      if (!sandboxId || !resolvedOrgId || !projectId || !instanceId) return
      setConnecting(true)
      try {
        const { cols, rows } = estimateTerminalDimensions()
        const newSessionId = await openSession({
          sandboxId,
          projectId,
          instanceId,
          cols,
          rows,
          orgId: resolvedOrgId,
          sessionId: sessionId ?? null,
        })

        if (newSessionId)
          nav.session(resolvedOrgId, projectId, newSessionId, {
            state: { sandboxId, projectId },
          })
      } catch (err) {
        console.error(`[Instance] connect failed:`, err)
        toast.error(`Failed to connect`, {
          description:
            err instanceof Error ? err.message : `An unexpected error occurred`,
        })
      } finally {
        setConnecting(false)
      }
    },
    [sandboxId, resolvedOrgId, projectId, instanceId]
  )

  const onConfirm = useCallback(async () => {
    const action = confirmAction
    if (!action || !resolvedOrgId || !sandboxId || !projectId || !instanceId) return

    setConfirmAction(null)
    setExecuting(action)

    try {
      if (action === `stop`) {
        const result = await stopSandbox({
          sandboxId,
          projectId,
          orgId: resolvedOrgId,
          instanceId,
        })
        if (result.stopped) {
          nav.sandbox(resolvedOrgId, projectId, sandboxId, { replace: true })
          return
        }
        if (result.stopped === false && result.activeSessions.length) {
          setForceStopSessions(result.activeSessions)
          return
        }
        toast.error(`Failed to stop instance`, {
          description: `The instance could not be stopped.`,
        })
        return
      }
      if (action === `restart`) {
        const result = await restartSandbox({
          sandboxId,
          orgId: resolvedOrgId,
          projectId,
          instanceId,
        })
        if (result.opened < result.total) {
          toast.warning(
            `Partial restart: ${result.opened} of ${result.total} sessions reopened`
          )
        }
      } else if (action === `recreate`) {
        await recreateSandbox({ sandboxId, orgId: resolvedOrgId, projectId, instanceId })
      }
      nav.sandbox(resolvedOrgId, projectId, sandboxId, { replace: true })
    } catch (err) {
      console.error(`[Instance] ${action} failed:`, err)
      toast.error(`Failed to ${action} instance`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    } finally {
      setExecuting(null)
    }
  }, [confirmAction, sandboxId, resolvedOrgId, projectId, instanceId])

  const onForceStop = useCallback(async () => {
    if (!resolvedOrgId || !sandboxId || !projectId || !instanceId) return
    setForceStopSessions(null)
    setExecuting(`stop`)
    try {
      await stopSandbox({
        sandboxId,
        projectId,
        instanceId,
        force: true,
        orgId: resolvedOrgId,
      })
      nav.sandbox(resolvedOrgId, projectId, sandboxId, { replace: true })
    } catch (err) {
      console.error(`[Instance] force stop failed:`, err)
      toast.error(`Failed to stop instance`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    } finally {
      setExecuting(null)
    }
  }, [sandboxId, resolvedOrgId, projectId, instanceId])

  const onBack = () => {
    if (resolvedOrgId && projectId && sandboxId)
      nav.sandbox(resolvedOrgId, projectId, sandboxId)
    else if (resolvedOrgId) nav.projects(resolvedOrgId)
    else nav.orgs()
  }

  if (!sandboxId || !instanceId) {
    return (
      <Page className='tdsk-instance-page'>
        <Typography
          variant='h6'
          color='text.secondary'
        >
          No instance selected
        </Typography>
      </Page>
    )
  }

  if (connecting)
    return (
      <Page className='tdsk-instance-page'>
        <Loading
          message='Connecting...'
          messageSx={{ color: `text.primary` }}
        />
      </Page>
    )

  const config = confirmAction ? CommandConfig[confirmAction] : null

  return (
    <Page className='tdsk-instance-page'>
      <Box sx={{ maxWidth: 700, mx: `auto`, width: `100%`, py: 4, px: 2 }}>
        <Box sx={{ display: `flex`, alignItems: `center`, gap: 1, mb: 3 }}>
          <IconButton
            size='small'
            onClick={onBack}
          >
            <ArrowBack />
          </IconButton>
          <Typography
            variant='h5'
            sx={{ flex: 1 }}
          >
            {sandbox?.name || sandboxId}
          </Typography>
          {instance && (
            <Chip
              size='small'
              color={instance.state === `Running` ? `success` : `warning`}
              label={instance.state}
            />
          )}
          <Typography
            variant='caption'
            color='text.secondary'
          >
            {instanceId.slice(-8)}
          </Typography>
        </Box>

        {loadingInstance ? (
          <Loading
            message='Loading instance...'
            messageSx={{ color: `text.primary` }}
          />
        ) : !instance ? (
          <Typography
            color='text.secondary'
            sx={{ textAlign: `center`, py: 4 }}
          >
            Instance not found or has been stopped.
          </Typography>
        ) : (
          <>
            {canExecSandbox && (
              <Box sx={{ display: `flex`, gap: 0.5, mb: 3 }}>
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
              </Box>
            )}

            <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
              {mySessions.map((s) => {
                const isOpen = openSessions.has(s.sessionId)
                return (
                  <Card
                    key={s.sessionId}
                    variant='outlined'
                  >
                    <CardActionArea
                      onClick={() =>
                        isOpen
                          ? nav.session(resolvedOrgId, projectId, s.sessionId, {
                              state: { sandboxId, projectId },
                            })
                          : canExecSandbox
                            ? onStart(s.sessionId)
                            : undefined
                      }
                      disabled={!isOpen && !canExecSandbox}
                      sx={{ display: `flex`, justifyContent: `space-between`, p: 2 }}
                    >
                      <Box>
                        <Typography variant='body2'>
                          Session {s.sessionId.slice(0, 8)}
                        </Typography>
                        <Typography
                          variant='caption'
                          color='text.secondary'
                        >
                          Connected {new Date(s.connectedAt).toLocaleTimeString()}
                        </Typography>
                      </Box>
                      <Button
                        size='small'
                        component='span'
                        variant='outlined'
                        disabled={!isOpen && !canExecSandbox}
                        color={isOpen ? `primary` : `inherit`}
                        startIcon={isOpen ? <Login /> : <PlayArrow />}
                      >
                        {isOpen ? `Open` : `Reconnect`}
                      </Button>
                    </CardActionArea>
                  </Card>
                )
              })}
              {sharedSessions.map((s) => (
                <Card
                  key={s.sessionId}
                  variant='outlined'
                >
                  <CardActionArea
                    onClick={() => (canExecSandbox ? onStart(s.sessionId) : undefined)}
                    disabled={!canExecSandbox}
                    sx={{ display: `flex`, justifyContent: `space-between`, p: 2 }}
                  >
                    <Box>
                      <Typography variant='body2'>
                        Session {s.sessionId.slice(0, 8)}
                      </Typography>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                      >
                        Owner: {s.userId?.slice(0, 8)} &middot;{` `}
                        {new Date(s.connectedAt).toLocaleTimeString()}
                      </Typography>
                    </Box>
                    <Button
                      size='small'
                      component='span'
                      variant='outlined'
                      startIcon={<Login />}
                      disabled={!canExecSandbox}
                    >
                      Join
                    </Button>
                  </CardActionArea>
                </Card>
              ))}
            </Box>

            {canExecSandbox && instance.state === `Running` && (
              <Box sx={{ display: `flex`, justifyContent: `flex-start`, mt: 2 }}>
                <Button
                  size='small'
                  variant='text'
                  startIcon={<Add />}
                  onClick={() => onStart(null)}
                >
                  New Session
                </Button>
              </Box>
            )}
          </>
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
            This instance has {forceStopSessions?.length} active session(s). Stopping will
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
    </Page>
  )
}

export default Instance
