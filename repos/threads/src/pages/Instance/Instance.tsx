import type { TSandboxSession } from '@tdsk/domain'
import type { TCommand, TSandboxStatus } from '@TTH/types'

import { toast } from 'sonner'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import { nav } from '@TTH/services/nav'
import { useParams } from 'react-router'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import { Loading } from '@tdsk/components'
import { Page } from '@TTH/pages/Page/Page'
import { EPermResource } from '@tdsk/domain'
import ListItem from '@mui/material/ListItem'
import { MonoFont } from '@TTH/constants/values'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import { openSession } from '@TTH/actions/sessions'
import DialogTitle from '@mui/material/DialogTitle'
import ListItemText from '@mui/material/ListItemText'
import { useState, useCallback, useMemo } from 'react'
import { usePermissions } from '@TTH/hooks/permissions'
import { CommandConfig } from '@TTH/constants/sessions'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import DialogContentText from '@mui/material/DialogContentText'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'
import { stopSandbox } from '@TTH/actions/sandboxes/stopSandbox'
import { restartSandbox } from '@TTH/actions/sandboxes/restartSandbox'
import { recreateSandbox } from '@TTH/actions/sandboxes/recreateSandbox'
import { Avatar as TdskAvatar, Chip as TdskChip } from '@tdsk/components'
import { formatTimestamp, formatRelativeDate } from '@TTH/utils/formatDate'
import {
  Add,
  Memory,
  Terminal,
  MoreHoriz,
  PlayCircle,
  StopCircle,
  RestartAlt,
  DeleteOutline,
} from '@mui/icons-material'
import {
  useUser,
  useOrgId,
  useSandboxes,
  useOpenSessions,
  useBackendSessions,
  useSandboxInstances,
} from '@TTH/state/selectors'
import {
  RowList,
  StatStrip,
  PageHeader,
  StatusChip,
  SectionHeader,
} from '@TTH/components/PagePrimitives'

const ValidStatuses = new Set<string>([
  `running`,
  `active`,
  `pending`,
  `building`,
  `stopped`,
  `idle`,
  `closed`,
  `failed`,
])
const toSandboxStatus = (state: string): TSandboxStatus =>
  ValidStatuses.has(state.toLowerCase())
    ? (state.toLowerCase() as TSandboxStatus)
    : `stopped`

type TInstanceParams = {
  orgId: string
  projectId: string
  sandboxId: string
  instanceId: string
}

const formatUptime = (date?: string | Date): string => {
  if (!date) return `-`
  const d = typeof date === `string` ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return `-`
  const diffMs = Date.now() - d.getTime()
  const totalMin = Math.floor(diffMs / 60_000)
  if (totalMin < 1) return `< 1m`
  if (totalMin < 60) return `${totalMin}m`
  const hrs = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hrs < 24) return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
  const days = Math.floor(hrs / 24)
  const remHrs = hrs % 24
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`
}

const SessionColumns = [
  { label: `Session`, width: `1.7fr` },
  { label: `Status`, width: `90px` },
  { label: `Shell`, width: `100px` },
  { label: `User`, width: `110px` },
  { label: `Started`, width: `110px` },
  { label: `Last input`, width: `130px` },
  { label: ``, width: `32px` },
]

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
  const [instancesMap] = useSandboxInstances()
  const [connecting, setConnecting] = useState(false)
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

  const instance = useMemo(() => {
    if (!sandboxId || !instanceId) return null
    const data = instancesMap.get(sandboxId)
    return data?.instances.find((i) => i.instanceId === instanceId) ?? null
  }, [instancesMap, sandboxId, instanceId])

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

  const allVisibleSessions = useMemo(
    () => [...mySessions, ...sharedSessions],
    [mySessions, sharedSessions]
  )

  const isOwner = instance?.userId === user?.id
  const isRunning = instance?.state === `Running`

  const onStart = useCallback(
    async (sessionId?: string | null) => {
      if (!sandboxId || !resolvedOrgId || !projectId || !instanceId) return
      setConnecting(true)
      try {
        const { cols, rows } = estimateTerminalDimensions()
        const { sessionId: newSessionId, instanceId: newInstanceId } = await openSession({
          cols,
          rows,
          sandboxId,
          projectId,
          instanceId,
          orgId: resolvedOrgId,
          sessionId: sessionId ?? null,
        })

        if (newSessionId)
          nav.session(
            resolvedOrgId,
            projectId,
            newInstanceId || instanceId,
            newSessionId,
            {
              state: { sandboxId, projectId, instanceId: newInstanceId || instanceId },
            }
          )
        else
          toast.error(`Failed to start session`, {
            description: `No session was created. Try again or check instance status.`,
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
        if (result.opened === 0) {
          toast.warning(`Restart completed`, {
            description: `No sessions were reopened`,
          })
        } else if (result.opened < result.total) {
          toast.warning(
            `Partial restart: ${result.opened} of ${result.total} sessions reopened`
          )
        } else {
          toast.success(`Restarted`, {
            description: `${result.opened} session(s) reopened`,
          })
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
  const sbConfig = sandbox?.config
  const cpu =
    sbConfig?.resources?.limits?.cpu || sbConfig?.resources?.requests?.cpu || `-`
  const mem =
    sbConfig?.resources?.limits?.memory || sbConfig?.resources?.requests?.memory || `-`
  const specs = `${cpu} x ${mem}`

  const instanceName = instance ? instanceId.slice(-12) : instanceId?.slice(-12) || `-`

  const eyebrowText = sandbox?.name ? `${sandbox.name} · Instance` : `Instance`

  return (
    <Page className='tdsk-instance-page'>
      <Box sx={{ maxWidth: 960, mx: `auto`, width: `100%`, py: 4, px: 2 }}>
        {!instance ? (
          <>
            <PageHeader
              eyebrow={eyebrowText}
              eyebrowIcon={<Memory />}
              title={instanceName}
              titleMono
              statusChip={<StatusChip status='stopped' />}
            />
            <Typography
              color='text.secondary'
              sx={{ textAlign: `center`, py: 4 }}
            >
              Instance not found or has been stopped.
            </Typography>
          </>
        ) : (
          <>
            <PageHeader
              eyebrow={eyebrowText}
              eyebrowIcon={<Memory />}
              title={instanceName}
              titleMono
              statusChip={<StatusChip status={toSandboxStatus(instance.state)} />}
              actions={
                canExecSandbox ? (
                  <>
                    {isOwner && (
                      <>
                        {isRunning ? (
                          <Button
                            size='small'
                            variant='outlined'
                            disabled={executing !== null}
                            onClick={() => setConfirmAction(`stop`)}
                            startIcon={
                              executing === `stop` ? (
                                <CircularProgress size={14} />
                              ) : (
                                <StopCircle />
                              )
                            }
                            sx={{ textTransform: `none` }}
                          >
                            Stop
                          </Button>
                        ) : (
                          <Button
                            size='small'
                            variant='outlined'
                            disabled={executing !== null}
                            onClick={() => onStart(null)}
                            startIcon={<PlayCircle />}
                            sx={{ textTransform: `none` }}
                          >
                            Start
                          </Button>
                        )}
                        <Button
                          size='small'
                          variant='outlined'
                          disabled={executing !== null}
                          onClick={() => setConfirmAction(`restart`)}
                          startIcon={
                            executing === `restart` ? (
                              <CircularProgress size={14} />
                            ) : (
                              <RestartAlt />
                            )
                          }
                          sx={{ textTransform: `none` }}
                        >
                          Restart
                        </Button>
                      </>
                    )}
                    {isRunning && (
                      <Button
                        size='small'
                        variant='contained'
                        startIcon={<Add />}
                        onClick={() => onStart(null)}
                        sx={{ textTransform: `none` }}
                      >
                        New session
                      </Button>
                    )}
                    {isOwner && (
                      <Button
                        size='small'
                        variant='outlined'
                        color='error'
                        disabled={executing !== null}
                        onClick={() => setConfirmAction(`recreate`)}
                        startIcon={
                          executing === `recreate` ? (
                            <CircularProgress size={14} />
                          ) : (
                            <DeleteOutline />
                          )
                        }
                        sx={{ textTransform: `none` }}
                      >
                        Delete
                      </Button>
                    )}
                  </>
                ) : isRunning ? (
                  <Button
                    size='small'
                    variant='contained'
                    startIcon={<Add />}
                    onClick={() => onStart(null)}
                    sx={{ textTransform: `none` }}
                  >
                    New session
                  </Button>
                ) : undefined
              }
            />

            <StatStrip
              cells={[
                {
                  label: `Status`,
                  value: (
                    <StatusChip
                      status={toSandboxStatus(instance.state)}
                      size='sm'
                    />
                  ),
                },
                { label: `Spec`, value: specs, sans: true },
                {
                  label: `IP`,
                  value: `-`,
                  sans: true,
                },
                { label: `Region`, value: `default`, sans: true },
                {
                  label: `Started`,
                  value:
                    instance.sessions.length > 0
                      ? formatTimestamp(instance.sessions[0]?.connectedAt)
                      : `-`,
                  sans: true,
                },
                {
                  label: `Uptime`,
                  value:
                    instance.sessions.length > 0
                      ? formatUptime(instance.sessions[0]?.connectedAt)
                      : `-`,
                  sans: true,
                },
              ]}
            />

            <SectionHeader
              title='Sessions'
              count={allVisibleSessions.length}
              actions={
                canExecSandbox && isRunning ? (
                  <Button
                    size='small'
                    variant='outlined'
                    startIcon={<Add />}
                    onClick={() => onStart(null)}
                  >
                    New session
                  </Button>
                ) : undefined
              }
            />

            {allVisibleSessions.length > 0 ? (
              <RowList columns={SessionColumns}>
                {allVisibleSessions.map((s, idx) => {
                  const isMine = s.userId === user?.id
                  const isOpen = openSessions.has(s.sessionId)
                  const sessionStatus = isOpen ? `active` : `closed`

                  return (
                    <RowList.Row
                      key={s.sessionId}
                      isLast={idx === allVisibleSessions.length - 1}
                      onClick={() => {
                        !isOpen
                          ? canExecSandbox && onStart(s.sessionId)
                          : nav.session(
                              resolvedOrgId,
                              projectId,
                              instanceId!,
                              s.sessionId,
                              {
                                state: { sandboxId, projectId, instanceId },
                              }
                            )
                      }}
                    >
                      {/* Session */}
                      <Box sx={{ display: `flex`, alignItems: `center`, gap: `10px` }}>
                        <Terminal sx={{ fontSize: 18, color: `text.secondary` }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Box
                            sx={{
                              display: `flex`,
                              alignItems: `center`,
                              gap: `6px`,
                            }}
                          >
                            <Typography
                              sx={{
                                fontSize: `13px`,
                                fontWeight: 600,
                                overflow: `hidden`,
                                textOverflow: `ellipsis`,
                                whiteSpace: `nowrap`,
                              }}
                            >
                              Session {s.sessionId.slice(0, 8)}
                            </Typography>
                            {isMine && (
                              <TdskChip
                                label='You'
                                variant='tint'
                                tone='primary'
                                size='sm'
                              />
                            )}
                          </Box>
                          <Typography
                            sx={{
                              fontSize: `10px`,
                              color: `text.secondary`,
                              fontFamily: MonoFont,
                              overflow: `hidden`,
                              textOverflow: `ellipsis`,
                              whiteSpace: `nowrap`,
                            }}
                          >
                            {s.sessionId}
                          </Typography>
                        </Box>
                      </Box>

                      {/* Status */}
                      <Box sx={{ display: `flex`, alignItems: `center` }}>
                        <StatusChip
                          status={sessionStatus}
                          size='sm'
                        />
                      </Box>

                      {/* Shell */}
                      <Box sx={{ display: `flex`, alignItems: `center` }}>
                        <Typography
                          sx={{
                            fontSize: `12px`,
                            fontFamily: MonoFont,
                            color: `text.secondary`,
                          }}
                        >
                          {s.hasShellSession ? `zsh` : `-`}
                        </Typography>
                      </Box>

                      {/* User */}
                      <Box
                        sx={{
                          display: `flex`,
                          alignItems: `center`,
                          gap: `6px`,
                        }}
                      >
                        <TdskAvatar
                          name={isMine ? `Me` : s.userId || `?`}
                          size='sm'
                        />
                        <Typography
                          sx={{
                            fontSize: `12px`,
                            overflow: `hidden`,
                            textOverflow: `ellipsis`,
                            whiteSpace: `nowrap`,
                          }}
                        >
                          {isMine ? `You` : s.userId?.slice(0, 8) || `Unknown`}
                        </Typography>
                      </Box>

                      {/* Started */}
                      <Box sx={{ display: `flex`, alignItems: `center` }}>
                        <Typography sx={{ fontSize: `12px`, color: `text.secondary` }}>
                          {formatTimestamp(s.connectedAt)}
                        </Typography>
                      </Box>

                      {/* Last input */}
                      <Box sx={{ display: `flex`, alignItems: `center` }}>
                        <Typography sx={{ fontSize: `12px`, color: `text.secondary` }}>
                          {formatRelativeDate(s.connectedAt)}
                        </Typography>
                      </Box>

                      {/* Actions */}
                      <Box sx={{ display: `flex`, alignItems: `center` }}>
                        <IconButton
                          disabled
                          size='small'
                          title='Coming soon'
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHoriz sx={{ fontSize: 18 }} />
                        </IconButton>
                      </Box>
                    </RowList.Row>
                  )
                })}
              </RowList>
            ) : (
              <Box
                sx={{
                  py: 6,
                  border: 1,
                  borderRadius: `8px`,
                  textAlign: `center`,
                  borderColor: `divider`,
                  bgcolor: `background.paper`,
                }}
              >
                <Typography
                  color='text.secondary'
                  sx={{ mb: 2 }}
                >
                  No sessions
                </Typography>
                {canExecSandbox && isRunning && (
                  <Button
                    size='small'
                    variant='contained'
                    startIcon={<Add />}
                    onClick={() => onStart(null)}
                  >
                    Start a session
                  </Button>
                )}
              </Box>
            )}
          </>
        )}
      </Box>

      {/* Confirmation dialog for stop/restart/recreate */}
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

      {/* Force stop dialog when active sessions exist */}
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
