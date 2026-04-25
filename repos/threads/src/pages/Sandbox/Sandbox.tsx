import { toast } from 'sonner'
import { Loading } from '@tdsk/components'
import { Page } from '@TTH/pages/Page/Page'
import { EPermResource } from '@tdsk/domain'
import { openSession } from '@TTH/actions/sessions'
import { useParams, useNavigate } from 'react-router'
import { useState, useCallback, useMemo } from 'react'
import { usePermissions } from '@TTH/hooks/permissions'
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
  Button,
  Typography,
  IconButton,
  CardActionArea,
} from '@mui/material'

const Sandbox = () => {
  const [orgId] = useOrgId()
  const [user] = useUser()
  const navigate = useNavigate()
  const [sandboxes] = useSandboxes()
  const { sandboxId } = useParams<{ sandboxId: string }>()

  const { canExec } = usePermissions()
  const canExecSandbox = canExec(EPermResource.sandbox)

  const [openSessions] = useOpenSessions()
  const [connecting, setConnecting] = useState(false)
  const [backendSessionsMap] = useBackendSessions()

  const sandbox = useMemo(
    () => sandboxes.find((s) => s.id === sandboxId),
    [sandboxes, sandboxId]
  )

  const projectId = sandbox?.projects?.[0]?.id ?? ``
  const sessions = sandboxId ? (backendSessionsMap.get(sandboxId) ?? []) : []

  const mySessions = useMemo(
    () => sessions.filter((s) => s.userId === user?.id),
    [sessions, user?.id]
  )

  const sharedSessions = useMemo(
    () => sessions.filter((s) => s.userId !== user?.id && s.visibility === `public`),
    [sessions, user?.id]
  )

  const handleStart = useCallback(
    async (sessionId?: string | null) => {
      if (!sandboxId || !orgId || !projectId) return
      setConnecting(true)
      try {
        const newSessionId = await openSession({
          sandboxId,
          orgId,
          projectId,
          sessionId: sessionId ?? null,
        })
        if (newSessionId) {
          navigate(`/session/${newSessionId}`, {
            state: { sandboxId, projectId },
          })
        }
      } catch (err) {
        console.error(`[Sandbox] connect failed:`, err)
        toast.error(`Failed to connect`, {
          description:
            err instanceof Error ? err.message : `An unexpected error occurred`,
        })
      } finally {
        setConnecting(false)
      }
    },
    [sandboxId, orgId, projectId, navigate]
  )

  const handleReconnect = useCallback(
    (sessionId: string) => {
      handleStart(sessionId)
    },
    [handleStart]
  )

  const handleJoin = useCallback(
    (sessionId: string) => {
      handleStart(sessionId)
    },
    [handleStart]
  )

  const handleBack = useCallback(() => {
    navigate(`/`)
  }, [navigate])

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

  if (connecting) {
    return (
      <Page className='tdsk-sandbox-page'>
        <Loading
          message='Connecting...'
          messageSx={{ color: `text.primary` }}
        />
      </Page>
    )
  }

  return (
    <Page className='tdsk-sandbox-page'>
      <Box sx={{ maxWidth: 700, mx: `auto`, width: `100%`, py: 4, px: 2 }}>
        <Box sx={{ display: `flex`, alignItems: `center`, gap: 1, mb: 3 }}>
          <IconButton
            size='small'
            onClick={handleBack}
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
              label={sandbox.config.runtime}
              size='small'
              color='primary'
              variant='outlined'
            />
          )}
        </Box>

        {mySessions.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant='subtitle2'
              sx={{
                mb: 1.5,
                fontWeight: 700,
                textTransform: `uppercase`,
                letterSpacing: 0.5,
              }}
            >
              My Sessions
            </Typography>
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
                          ? navigate(`/session/${s.sessionId}`, {
                              state: { sandboxId, projectId },
                            })
                          : canExecSandbox
                            ? handleReconnect(s.sessionId)
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
                        component='span'
                        size='small'
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
            </Box>
          </Box>
        )}

        {sharedSessions.length > 0 && (
          <Box sx={{ mb: 3 }}>
            <Typography
              variant='subtitle2'
              sx={{
                mb: 1.5,
                fontWeight: 700,
                textTransform: `uppercase`,
                letterSpacing: 0.5,
              }}
            >
              Shared Sessions
            </Typography>
            <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1 }}>
              {sharedSessions.map((s) => (
                <Card
                  key={s.sessionId}
                  variant='outlined'
                >
                  <CardActionArea
                    onClick={() => (canExecSandbox ? handleJoin(s.sessionId) : undefined)}
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
          </Box>
        )}

        {canExecSandbox && (
          <Box sx={{ display: `flex`, justifyContent: `center`, mt: 2 }}>
            <Button
              size='large'
              variant='contained'
              startIcon={<Add />}
              onClick={() => handleStart(null)}
              disabled={!orgId || !projectId}
            >
              New Session
            </Button>
          </Box>
        )}
      </Box>
    </Page>
  )
}

export default Sandbox
