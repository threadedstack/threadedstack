import type { TViewMode } from '@TTH/types'

import { toast } from 'sonner'
import { Loading } from '@tdsk/components'
import { Page } from '@TTH/pages/Page/Page'
import { styled } from '@mui/material/styles'
import { ArrowBack } from '@mui/icons-material'
import { useParams, useNavigate } from 'react-router'
import { usePermissions } from '@TTH/hooks/permissions'
import { ViewToggle } from '@TTH/components/ViewToggle'
import { useState, useCallback, useEffect } from 'react'
import { useOrgId, useSandboxes } from '@TTH/state/selectors'
import { isFeatureEnabled, EPermResource } from '@tdsk/domain'
import { SessionGUIView } from '@TTH/components/SessionGUIView'
import { SessionProvider } from '@TTH/contexts/SessionProvider'
import { useSessionContext } from '@TTH/contexts/SessionContext'
import { SmartInput } from '@TTH/components/SmartInput/SmartInput'
import { TerminalView } from '@TTH/components/Terminal/TerminalView'
import { useSessionEngine } from '@TTH/hooks/session/useSessionEngine'
import { SessionCommands } from '@TTH/components/Session/SessionCommands'
import { TerminalQuickSettings } from '@TTH/components/Terminal/TerminalQuickSettings'
import { Box, Chip, Card, Button, IconButton, Typography } from '@mui/material'
import { openSession, getRawBuffer, subscribeEngineData } from '@TTH/actions/sessions'

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

const SessionInner = () => {
  const [orgId] = useOrgId()
  const navigate = useNavigate()
  const [sandboxes] = useSandboxes()
  const { sessionId } = useParams<{ sessionId: string }>()
  const { session, isOwner, sandboxId, projectId, pendingOp, connecting, setPendingOp } =
    useSessionContext()

  const hasSession = !!session
  const activeSessionId = hasSession ? sessionId : null
  const engine = useSessionEngine(activeSessionId ?? null)

  const [viewMode, setViewMode] = useState<TViewMode>(
    isFeatureEnabled(`terminalGui`) ? `gui` : `terminal`
  )
  const { canExec } = usePermissions()
  const canExecSandbox = canExec(EPermResource.sandbox)

  const sandbox = sandboxId ? sandboxes.find((s) => s.id === sandboxId) : undefined

  // Subscribe engine to terminal data
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
    try {
      const newSessionId = await openSession({
        orgId,
        sandboxId,
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
                isOwner={isOwner}
                sandboxId={sandboxId}
                sessionId={sessionId}
                projectId={projectId}
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
          {hasSession && <TerminalQuickSettings />}
        </SessionHeader>
        <ContentArea>
          {!hasSession ? (
            <Box
              sx={{
                py: 4,
                px: 2,
                gap: 3,
                flex: 1,
                display: `flex`,
                overflow: `auto`,
                alignItems: `center`,
                flexDirection: `column`,
                justifyContent: `center`,
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
                      mb: 3,
                      gap: 1.5,
                      display: `flex`,
                      flexWrap: `wrap`,
                      alignItems: `center`,
                      justifyContent: `center`,
                    }}
                  >
                    <Typography variant='h5'>{sandbox?.name || sessionId}</Typography>
                    {sandbox?.config?.runtime && (
                      <Chip
                        size='small'
                        color='primary'
                        variant='outlined'
                        label={sandbox.config.runtime}
                      />
                    )}
                    {sandbox?.builtIn && (
                      <Chip
                        size='small'
                        variant='filled'
                        label='Built-in'
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
                                sx={{ maxWidth: 350 }}
                                title={sandbox.config.image}
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

const Session = () => (
  <SessionProvider>
    <SessionInner />
  </SessionProvider>
)

export default Session
