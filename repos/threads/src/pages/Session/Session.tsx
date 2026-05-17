import type { TViewMode } from '@TTH/types'

import { toast } from 'sonner'
import { nav } from '@TTH/services/nav'
import { useParams } from 'react-router'
import { Loading } from '@tdsk/components'
import { Page } from '@TTH/pages/Page/Page'
import { styled } from '@mui/material/styles'
import { usePermissions } from '@TTH/hooks/permissions'
import { ViewToggle } from '@TTH/components/ViewToggle'
import { useCallback, useEffect, useState } from 'react'
import { ArrowBack, Dns } from '@mui/icons-material'
import { useOrgId, useSandboxes } from '@TTH/state/selectors'
import { isFeatureEnabled, EPermResource } from '@tdsk/domain'
import { SessionGUIView } from '@TTH/components/SessionGUIView'
import { SessionProvider } from '@TTH/contexts/SessionProvider'
import { useSessionContext } from '@TTH/contexts/SessionContext'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'
import { SmartInput } from '@TTH/components/SmartInput/SmartInput'
import { TerminalView } from '@TTH/components/Terminal/TerminalView'
import { useSessionEngine } from '@TTH/hooks/session/useSessionEngine'
import { SessionCommands } from '@TTH/components/Session/SessionCommands'
import { ConfigRow, ConfigValue } from '@TTH/components/ConfigRow/ConfigRow'
import { TerminalQuickSettings } from '@TTH/components/Terminal/TerminalQuickSettings'
import { openSession, getRawBuffer, subscribeEngineData } from '@TTH/actions/sessions'
import { Box, Chip, Card, Button, IconButton, Typography, Tooltip } from '@mui/material'

const SessionContainer = styled(Box)`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
`

const SessionHeader = styled(Box)(({ theme }) => ({
  minHeight: 48,
  display: `flex`,
  alignItems: `center`,
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}))

const ContentArea = styled(Box)(({ theme }) => ({
  flex: 1,
  display: `flex`,
  overflow: `hidden`,
  position: `relative`,
  flexDirection: `column`,
  padding: theme.spacing(1),
}))

const SessionInner = () => {
  const [orgId] = useOrgId()
  const [sandboxes] = useSandboxes()
  const { sessionId } = useParams<{ sessionId: string }>()
  const { session, isOwner, sandboxId, projectId, connecting } = useSessionContext()

  const hasSession = !!session
  const activeSessionId = hasSession ? sessionId : null

  const guiEnabled = isFeatureEnabled(`terminalGui`)
  const [viewMode, setViewMode] = useState<TViewMode>(guiEnabled ? `gui` : `terminal`)

  const engineSessionId = guiEnabled ? activeSessionId : null
  const engine = useSessionEngine(engineSessionId ?? null)

  const { canExec } = usePermissions()
  const canExecSandbox = canExec(EPermResource.sandbox)

  const sandbox = sandboxId ? sandboxes.find((s) => s.id === sandboxId) : undefined

  useEffect(() => {
    if (!activeSessionId || !engine || !guiEnabled) return
    const buffer = getRawBuffer(activeSessionId)
    for (const chunk of buffer) {
      engine.write(chunk)
    }
    const unsub = subscribeEngineData(activeSessionId, (data) => engine.write(data))
    return unsub
  }, [activeSessionId, engine, guiEnabled])

  const onBack = useCallback(() => {
    if (sandboxId && orgId && projectId) nav.sandbox(orgId, projectId, sandboxId)
    else orgId ? nav.projects(orgId) : nav.orgs()
  }, [sandboxId, orgId, projectId])

  const handleConnect = useCallback(async () => {
    if (!sandboxId || !orgId || !projectId) return
    try {
      const { cols, rows } = estimateTerminalDimensions()
      const newSessionId = await openSession({
        orgId,
        cols,
        rows,
        sandboxId,
        projectId,
        sessionId: null,
      })
      nav.session(orgId, projectId, newSessionId, {
        replace: true,
        state: { sandboxId, projectId },
      })
    } catch (err) {
      console.error(`[Session] connect failed:`, err)
      toast.error(`Failed to connect`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    }
  }, [sandboxId, orgId, projectId])

  if (!sessionId)
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

  return (
    <Page className='tdsk-session-page'>
      <SessionContainer>
        <SessionHeader>
          <IconButton
            size='small'
            onClick={onBack}
          >
            <ArrowBack />
          </IconButton>
          <Typography
            noWrap
            sx={{ flex: 1 }}
            variant='subtitle1'
          >
            {session?.runtime || sandbox?.name || sessionId}
          </Typography>
          {hasSession && sandboxId && sessionId && projectId && (
            <>
              <SessionCommands
                isOwner={isOwner}
                sandboxId={sandboxId}
                sessionId={sessionId}
                projectId={projectId}
              />
              {session?.instanceId && orgId && sandboxId && projectId && (
                <Tooltip title='Instance'>
                  <IconButton
                    size='small'
                    onClick={() =>
                      nav.instance(orgId, projectId, sandboxId, session.instanceId)
                    }
                  >
                    <Dns sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}
              {guiEnabled && (
                <ViewToggle
                  value={viewMode}
                  onChange={setViewMode}
                />
              )}
            </>
          )}
          {hasSession && <TerminalQuickSettings />}
        </SessionHeader>
        <ContentArea className='tth-session-content-area'>
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
              {connecting ? (
                <Loading
                  message='Connecting...'
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
          ) : viewMode === `gui` && guiEnabled ? (
            <SessionGUIView sessionId={sessionId} />
          ) : (
            <TerminalView
              key={sessionId}
              sessionId={sessionId}
              active={viewMode === `terminal`}
            />
          )}
        </ContentArea>
        {hasSession && viewMode === `gui` && guiEnabled && (
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
