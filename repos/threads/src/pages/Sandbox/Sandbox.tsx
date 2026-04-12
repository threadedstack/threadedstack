import type { TSandboxSession } from '@tdsk/domain'

import { toast } from 'sonner'
import { Loading } from '@tdsk/components'
import { Page } from '@TTH/pages/Page/Page'
import { openSession } from '@TTH/actions/sessions'
import { useParams, useNavigate } from 'react-router'
import { sandboxApi } from '@TTH/services/sandboxApi'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { ArrowBack, PlayArrow, Login, Add } from '@mui/icons-material'
import { useOrgId, useSandboxes, useUser } from '@TTH/state/selectors'
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
  const { sandboxId } = useParams<{ sandboxId: string }>()
  const navigate = useNavigate()
  const orgId = useOrgId()
  const sandboxes = useSandboxes()
  const [user] = useUser()

  const [sessions, setSessions] = useState<TSandboxSession[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const sandbox = useMemo(
    () => sandboxes.find((s) => s.id === sandboxId),
    [sandboxes, sandboxId]
  )

  const projectId = sandbox?.projects?.[0]?.id ?? ``

  useEffect(() => {
    if (!sandboxId || !orgId || !projectId) {
      setLoading(false)
      return
    }

    let cancelled = false
    sandboxApi.sessions(orgId, projectId, sandboxId).then((resp) => {
      if (cancelled) return
      if (resp.error) {
        toast.error(`Failed to load sessions`, {
          description: resp.error.message ?? `An unexpected error occurred`,
        })
      }
      setSessions(resp.data ?? [])
      setLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [sandboxId, orgId, projectId])

  const mySessions = useMemo(
    () => sessions.filter((s) => s.userId === user?.id),
    [sessions, user?.id]
  )

  const sharedSessions = useMemo(
    () => sessions.filter((s) => s.userId !== user?.id && s.visibility === `public`),
    [sessions, user?.id]
  )

  // Auto-navigate if exactly one own session
  useEffect(() => {
    if (!loading && mySessions.length === 1 && sharedSessions.length === 0) {
      navigate(`/session/${mySessions[0].sessionId}`, {
        replace: true,
        state: { sandboxId, projectId },
      })
    }
  }, [loading, mySessions, sharedSessions, navigate, sandboxId, projectId])

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

  if (loading) {
    return (
      <Page className='tdsk-sandbox-page'>
        <Loading
          message='Loading sessions...'
          messageSx={{ color: `text.primary` }}
        />
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
              {mySessions.map((s) => (
                <Card
                  key={s.sessionId}
                  variant='outlined'
                >
                  <CardActionArea
                    onClick={() => handleReconnect(s.sessionId)}
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
                      variant='outlined'
                      startIcon={<PlayArrow />}
                    >
                      Reconnect
                    </Button>
                  </CardActionArea>
                </Card>
              ))}
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
                    onClick={() => handleJoin(s.sessionId)}
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
                      variant='outlined'
                      startIcon={<Login />}
                    >
                      Join
                    </Button>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          </Box>
        )}

        <Box sx={{ display: `flex`, justifyContent: `center`, mt: 2 }}>
          <Button
            variant='contained'
            size='large'
            startIcon={<Add />}
            onClick={() => handleStart(null)}
            disabled={!orgId || !projectId}
          >
            New Session
          </Button>
        </Box>
      </Box>
    </Page>
  )
}

export default Sandbox
