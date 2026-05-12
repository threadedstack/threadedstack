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
import { useState, useCallback, useMemo, useEffect } from 'react'
import { ArrowBack, PlayArrow, Login, Add, Dns } from '@mui/icons-material'
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
  Button,
  Typography,
  IconButton,
  CardActionArea,
} from '@mui/material'

type TSandboxParams = {
  orgId: string
  projectId: string
  sandboxId: string
}

const Sandbox = () => {
  const [user] = useUser()
  const [orgId] = useOrgId()
  const [sandboxes] = useSandboxes()

  const {
    sandboxId,
    orgId: paramOrgId,
    projectId: paramProjectId,
  } = useParams<TSandboxParams>()

  const { canExec } = usePermissions()
  const canExecSandbox = canExec(EPermResource.sandbox)

  const [openSessions] = useOpenSessions()
  const [backendSessionsMap] = useBackendSessions()
  const [connecting, setConnecting] = useState(false)
  const [instances, setInstances] = useState<TSandboxInstance[]>([])
  const [maxInstances, setMaxInstances] = useState(1)
  const [loadingInstances, setLoadingInstances] = useState(false)

  const sandbox = useMemo(
    () => sandboxes.find((s) => s.id === sandboxId),
    [sandboxes, sandboxId]
  )

  const resolvedOrgId = paramOrgId || orgId
  const projectId = paramProjectId || sandbox?.projects?.[0]?.id || ``
  const sessions = sandboxId ? (backendSessionsMap.get(sandboxId) ?? []) : []

  const fetchInstances = useCallback(() => {
    if (!sandboxId || !resolvedOrgId || !projectId) return
    setLoadingInstances(true)
    sandboxApi
      .listInstances(resolvedOrgId, projectId, sandboxId)
      .then((resp) => {
        if (resp.data) {
          setInstances(resp.data.instances)
          setMaxInstances(resp.data.maxInstances)
        }
      })
      .finally(() => setLoadingInstances(false))
  }, [sandboxId, resolvedOrgId, projectId])

  useEffect(() => {
    fetchInstances()
  }, [fetchInstances])

  const onStart = useCallback(
    async (sessionId?: string | null, instanceId?: string, newInstance?: boolean) => {
      if (!sandboxId || !resolvedOrgId || !projectId) return
      setConnecting(true)
      try {
        const newSessionId = await openSession({
          sandboxId,
          projectId,
          orgId: resolvedOrgId,
          sessionId: sessionId ?? null,
          ...(instanceId ? { instanceId } : {}),
          ...(newInstance ? { newInstance: true } : {}),
        })

        if (newSessionId)
          nav.session(resolvedOrgId, projectId, newSessionId, {
            state: { sandboxId, projectId },
          })
      } catch (err) {
        console.error(`[Sandbox] connect failed:`, err)
        toast.error(`Failed to connect`, {
          description:
            err instanceof Error ? err.message : `An unexpected error occurred`,
        })
      } finally {
        setConnecting(false)
        fetchInstances()
      }
    },
    [sandboxId, resolvedOrgId, projectId, fetchInstances]
  )

  const onBack = () => nav.project(resolvedOrgId, projectId)

  if (!sandboxId) {
    return (
      <Page className='tdsk-sandbox-page'>
        <Typography
          variant='h6'
          color='text.secondary'
        >
          No sandbox selected
        </Typography>
      </Page>
    )
  }

  if (connecting)
    return (
      <Page className='tdsk-sandbox-page'>
        <Loading
          message='Connecting...'
          messageSx={{ color: `text.primary` }}
        />
      </Page>
    )

  return (
    <Page className='tdsk-sandbox-page'>
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
          {sandbox?.config?.runtime && (
            <Chip
              size='small'
              color='primary'
              variant='outlined'
              label={sandbox.config.runtime}
            />
          )}
        </Box>

        {instances.length > 0 && (
          <Box sx={{ mb: 3 }}>
            {instances.map((instance, idx) => {
              const instSessions = sessions.filter(
                (s) => s.instanceId === instance.instanceId
              )
              const myInstSessions = instSessions.filter((s) => s.userId === user?.id)
              const sharedInstSessions = instSessions.filter(
                (s) => s.userId !== user?.id && s.visibility === `public`
              )

              return (
                <Box
                  key={instance.instanceId}
                  sx={{ mb: 3 }}
                >
                  <Box sx={{ display: `flex`, alignItems: `center`, gap: 1, mb: 1 }}>
                    <Dns sx={{ fontSize: 18, color: `text.secondary` }} />
                    <Typography
                      variant='subtitle2'
                      sx={{
                        fontWeight: 700,
                        letterSpacing: 0.5,
                        textTransform: `uppercase`,
                      }}
                    >
                      Instance {idx + 1}
                    </Typography>
                    <Typography
                      variant='caption'
                      color='text.secondary'
                    >
                      ({instance.instanceId.slice(-8)})
                    </Typography>
                    <Chip
                      size='small'
                      color={instance.state === `Running` ? `success` : `warning`}
                      label={instance.state}
                      sx={{ height: 20, fontSize: `11px` }}
                    />
                  </Box>

                  <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
                    {myInstSessions.map((s) => {
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
                                  ? onStart(s.sessionId, instance.instanceId)
                                  : undefined
                            }
                            disabled={!isOpen && !canExecSandbox}
                            sx={{
                              display: `flex`,
                              justifyContent: `space-between`,
                              p: 2,
                            }}
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
                    {sharedInstSessions.map((s) => (
                      <Card
                        key={s.sessionId}
                        variant='outlined'
                      >
                        <CardActionArea
                          onClick={() =>
                            canExecSandbox
                              ? onStart(s.sessionId, instance.instanceId)
                              : undefined
                          }
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
                    <Box sx={{ display: `flex`, justifyContent: `flex-start`, mt: 1 }}>
                      <Button
                        size='small'
                        variant='text'
                        startIcon={<Add />}
                        onClick={() => onStart(null, instance.instanceId)}
                      >
                        New Session
                      </Button>
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        )}

        {canExecSandbox && (
          <Box sx={{ display: `flex`, justifyContent: `center`, mt: 2 }}>
            <Button
              size='large'
              variant='contained'
              startIcon={<Add />}
              onClick={() => onStart(null, undefined, true)}
              disabled={!resolvedOrgId || !projectId || instances.length >= maxInstances}
            >
              New Instance
            </Button>
          </Box>
        )}
      </Box>
    </Page>
  )
}

export default Sandbox
