import type { TViewMode } from '@TTH/components/ViewToggle'

import { toast } from 'sonner'
import { Loading } from '@tdsk/components'
import { EPermResource } from '@tdsk/domain'
import { Page } from '@TTH/pages/Page/Page'
import { styled } from '@mui/material/styles'
import { ArrowBack } from '@mui/icons-material'
import { isFeatureEnabled } from '@tdsk/domain'
import { usePermissions } from '@TTH/hooks/permissions'
import { ViewToggle } from '@TTH/components/ViewToggle'
import { useSessionEngine } from '@TTH/hooks/useSessionEngine'
import { SessionGUIView } from '@TTH/components/SessionGUIView'
import { findSandboxForSession } from '@TTH/utils/sessionStorage'
import { useParams, useNavigate, useLocation } from 'react-router'
import { SmartInput } from '@TTH/components/SmartInput/SmartInput'
import { TerminalView } from '@TTH/components/TerminalView/TerminalView'
import { SessionCommands } from '@TTH/components/Session/SessionCommands'
import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { openSession, getRawBuffer, subscribeEngineData } from '@TTH/actions/sessions'
import { useOpenSessions, useSandboxes, useOrgId, useUser } from '@TTH/state/selectors'
import { Box, Chip, Card, Button, IconButton, Typography } from '@mui/material'

const SessionContainer = styled(Box)`
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`

const SessionHeader = styled(Box)(({ theme }) => ({
  display: `flex`,
  alignItems: `center`,
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  minHeight: 48,
}))

const ContentArea = styled(Box)`
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
`

const monoFont = `'JetBrains Mono', monospace`

const ConfigLabel = styled(Typography)(({ theme }) => ({
  fontSize: 13,
  fontWeight: 600,
  color: theme.palette.text.secondary,
  textTransform: `uppercase` as const,
  letterSpacing: `0.05em`,
}))

const ConfigValue = styled(Typography)({
  fontSize: 14,
  fontFamily: monoFont,
})

const ConfigRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <Box
    sx={{
      display: `flex`,
      justifyContent: `space-between`,
      alignItems: `center`,
      py: 0.75,
    }}
  >
    <ConfigLabel>{label}</ConfigLabel>
    {typeof value === `string` || typeof value === `number` ? (
      <ConfigValue>{value}</ConfigValue>
    ) : (
      value
    )}
  </Box>
)

const Session = () => {
  const { sessionId } = useParams<{ sessionId: string }>()
  const orgId = useOrgId()
  const [user] = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const sandboxes = useSandboxes()
  const openSessions = useOpenSessions()
  const [connecting, setConnecting] = useState(false)
  const [viewMode, setViewMode] = useState<TViewMode>(
    isFeatureEnabled('terminalGui') ? `gui` : `terminal`
  )
  const [pendingOp, setPendingOp] = useState<`restart` | `recreate` | null>(null)
  const { canExec } = usePermissions()
  const canExecSandbox = canExec(EPermResource.sandbox)

  const session = sessionId ? openSessions.get(sessionId) : undefined
  const hasSession = !!session
  const activeSessionId = hasSession ? sessionId : null
  const engine = useSessionEngine(activeSessionId ?? null)

  // Resolve sandboxId: active session > route state > sessionStorage reverse lookup
  const sandboxId = useMemo(() => {
    if (session?.sandboxId) return session.sandboxId
    const fromState = (location.state as { sandboxId?: string })?.sandboxId
    if (fromState) return fromState
    if (sessionId) return findSandboxForSession(sessionId)
    return undefined
  }, [session?.sandboxId, location.state, sessionId])

  const isOwner = useMemo(
    () => !!session && !!user && session.podOwnerUserId === user.id,
    [session, user]
  )

  const sandbox = useMemo(
    () => (sandboxId ? sandboxes.find((s) => s.id === sandboxId) : undefined),
    [sandboxId, sandboxes]
  )

  const projectId = useMemo(() => {
    if (session?.projectId) return session.projectId
    const fromState = (location.state as { projectId?: string })?.projectId
    if (fromState) return fromState
    return sandbox?.projects?.[0]?.id ?? ``
  }, [session?.projectId, location.state, sandbox?.projects])

  // Auto-reconnect when we have sandboxId but no active WebSocket session
  const reconnectAttempted = useRef(false)
  const hadSession = useRef(false)
  useEffect(() => {
    if (hasSession) hadSession.current = true
  }, [hasSession])
  useEffect(() => {
    if (hasSession || connecting || pendingOp || reconnectAttempted.current) return
    // Don't auto-reconnect if session was deliberately closed/stopped
    if (hadSession.current) return
    if (!sessionId || !sandboxId || !orgId || !projectId) return

    reconnectAttempted.current = true
    setConnecting(true)
    openSession({ sandboxId, orgId, projectId, sessionId })
      .then((newSessionId) => {
        if (newSessionId !== sessionId) {
          navigate(`/session/${newSessionId}`, {
            replace: true,
            state: { sandboxId, projectId },
          })
        }
      })
      .catch((err) => {
        console.error(`[Session] auto-reconnect failed:`, err)
        toast.error(`Failed to reconnect`, {
          description:
            err instanceof Error ? err.message : `An unexpected error occurred`,
        })
      })
      .finally(() => setConnecting(false))
  }, [hasSession, connecting, pendingOp, sessionId, sandboxId, orgId, projectId])

  useEffect(() => {
    if (!activeSessionId || !engine) return
    const buffer = getRawBuffer(activeSessionId)
    for (const chunk of buffer) {
      engine.write(chunk)
    }
    const unsub = subscribeEngineData(activeSessionId, (data) => engine.write(data))
    return unsub
  }, [activeSessionId, engine])

  const handleBack = useCallback(() => {
    if (sandboxId) navigate(`/sandbox/${sandboxId}`)
    else navigate(`/`)
  }, [navigate, sandboxId])

  const handleViewChange = useCallback((value: TViewMode) => {
    setViewMode(value)
  }, [])

  const handleConnect = useCallback(async () => {
    if (!sandboxId || !orgId || !projectId) return
    setConnecting(true)
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
      console.error(`[Session] connect failed:`, err)
      toast.error(`Failed to connect`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    } finally {
      setConnecting(false)
    }
  }, [sandboxId, orgId, projectId, navigate])

  if (!sessionId) {
    return (
      <Page className='tdsk-session-page'>
        <Typography
          variant='h6'
          color='text.secondary'
        >
          No session selected
        </Typography>
      </Page>
    )
  }

  return (
    <Page className='tdsk-session-page'>
      <SessionContainer>
        <SessionHeader>
          <IconButton
            size='small'
            onClick={handleBack}
          >
            <ArrowBack />
          </IconButton>
          <Typography
            variant='subtitle1'
            noWrap
            sx={{ flex: 1 }}
          >
            {session?.runtime || sandbox?.name || sessionId}
          </Typography>
          {hasSession && sandboxId && (
            <>
              <SessionCommands
                sandboxId={sandboxId}
                sessionId={sessionId}
                projectId={projectId}
                isOwner={isOwner}
                onPendingOp={setPendingOp}
              />
              {isFeatureEnabled('terminalGui') && (
                <ViewToggle
                  value={viewMode}
                  onChange={handleViewChange}
                />
              )}
            </>
          )}
        </SessionHeader>
        <ContentArea>
          {!hasSession ? (
            <Box
              sx={{
                flex: 1,
                display: `flex`,
                flexDirection: `column`,
                alignItems: `center`,
                justifyContent: `center`,
                gap: 3,
                overflow: `auto`,
                py: 4,
                px: 2,
              }}
            >
              {connecting || pendingOp ? (
                <Loading
                  message={
                    pendingOp === `recreate`
                      ? `Recreating session...`
                      : pendingOp === `restart`
                        ? `Restarting session...`
                        : `Connecting...`
                  }
                  messageSx={{ color: `text.primary` }}
                />
              ) : (
                <Box sx={{ width: `100%`, maxWidth: 600 }}>
                  {/* Sandbox header */}
                  <Box
                    sx={{
                      display: `flex`,
                      alignItems: `center`,
                      gap: 1.5,
                      mb: 3,
                      justifyContent: `center`,
                      flexWrap: `wrap`,
                    }}
                  >
                    <Typography variant='h5'>{sandbox?.name || sessionId}</Typography>
                    {sandbox?.config?.runtime && (
                      <Chip
                        label={sandbox.config.runtime}
                        size='small'
                        color='primary'
                        variant='outlined'
                      />
                    )}
                    {sandbox?.builtIn && (
                      <Chip
                        label='Built-in'
                        size='small'
                        variant='filled'
                        sx={{ bgcolor: `action.selected` }}
                      />
                    )}
                  </Box>

                  {/* Configuration panel */}
                  {sandbox?.config && (
                    <Card
                      variant='outlined'
                      sx={{ mb: 3, p: 2.5 }}
                    >
                      <Typography
                        variant='subtitle2'
                        sx={{ mb: 1.5, fontWeight: 700 }}
                      >
                        Configuration
                      </Typography>
                      <Box sx={{ display: `flex`, flexDirection: `column`, gap: 0.5 }}>
                        {sandbox.config.image && (
                          <ConfigRow
                            label='Image'
                            value={
                              <ConfigValue
                                noWrap
                                title={sandbox.config.image}
                                sx={{ maxWidth: 350 }}
                              >
                                {sandbox.config.image}
                              </ConfigValue>
                            }
                          />
                        )}
                        {sandbox.config.runtime && (
                          <ConfigRow
                            label='Runtime'
                            value={sandbox.config.runtime}
                          />
                        )}
                        {sandbox.config.workdir && (
                          <ConfigRow
                            label='Working Dir'
                            value={sandbox.config.workdir}
                          />
                        )}
                        <ConfigRow
                          label='SSH Enabled'
                          value={sandbox.config.sshEnabled ? `Yes` : `No`}
                        />
                        {sandbox.config.idleTimeoutMinutes != null && (
                          <ConfigRow
                            label='Idle Timeout'
                            value={`${sandbox.config.idleTimeoutMinutes} min`}
                          />
                        )}
                        {sandbox.config.initScript && (
                          <ConfigRow
                            label='Init Script'
                            value={
                              <ConfigValue
                                noWrap
                                sx={{ maxWidth: 350, opacity: 0.8 }}
                                title={sandbox.config.initScript}
                              >
                                {sandbox.config.initScript.length > 60
                                  ? `${sandbox.config.initScript.slice(0, 60)}...`
                                  : sandbox.config.initScript}
                              </ConfigValue>
                            }
                          />
                        )}
                      </Box>
                    </Card>
                  )}

                  {/* Projects */}
                  {sandbox?.projects && sandbox.projects.length > 0 && (
                    <Box sx={{ mb: 3, textAlign: `center` }}>
                      <Typography
                        variant='subtitle2'
                        sx={{ mb: 1, fontWeight: 700 }}
                      >
                        Projects
                      </Typography>
                      <Box
                        sx={{
                          display: `flex`,
                          gap: 1,
                          flexWrap: `wrap`,
                          justifyContent: `center`,
                        }}
                      >
                        {sandbox.projects.map((project) => (
                          <Chip
                            key={project.id}
                            label={project.name}
                            size='small'
                            variant='outlined'
                          />
                        ))}
                      </Box>
                    </Box>
                  )}

                  {/* Start Session button */}
                  {canExecSandbox && (
                    <Box sx={{ display: `flex`, justifyContent: `center` }}>
                      <Button
                        variant='contained'
                        size='large'
                        onClick={handleConnect}
                        disabled={!orgId || !projectId || !sandboxId}
                      >
                        Start Session
                      </Button>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          ) : viewMode === `gui` && isFeatureEnabled('terminalGui') ? (
            <SessionGUIView sessionId={sessionId} />
          ) : (
            <TerminalView
              sessionId={sessionId}
              active={viewMode === `terminal`}
            />
          )}
        </ContentArea>
        {hasSession && viewMode === `gui` && isFeatureEnabled('terminalGui') && (
          <SmartInput sessionId={sessionId} />
        )}
      </SessionContainer>
    </Page>
  )
}

export const Component = Session
export default Session
