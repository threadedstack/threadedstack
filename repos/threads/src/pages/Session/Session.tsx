import { useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router'
import {
  Box,
  IconButton,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  Chip,
  Card,
} from '@mui/material'
import { ArrowBack, Chat, Terminal } from '@mui/icons-material'
import { styled } from '@mui/material/styles'
import { Loading } from '@tdsk/components'
import { Page } from '@TTH/pages/Page/Page'
import { ChatView } from '@TTH/components/ChatView/ChatView'
import { TerminalView } from '@TTH/components/TerminalView/TerminalView'
import { SmartInput } from '@TTH/components/SmartInput/SmartInput'
import { SessionCommands } from '@TTH/components/Session/SessionCommands'
import { useOpenSessions, useSandboxes, useOrgId } from '@TTH/state/selectors'
import { openSession } from '@TTH/actions/sessions'

type TViewMode = 'chat' | 'terminal'

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
    <ConfigValue>{value}</ConfigValue>
  </Box>
)

const Session = () => {
  const { sandboxId } = useParams<{ sandboxId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const openSessions = useOpenSessions()
  const sandboxes = useSandboxes()
  const orgId = useOrgId()
  const [viewMode, setViewMode] = useState<TViewMode>(`chat`)
  const [connecting, setConnecting] = useState(false)
  const [pendingOp, setPendingOp] = useState<'restart' | 'recreate' | null>(null)

  const hasSession = sandboxId ? openSessions.has(sandboxId) : false
  const session = sandboxId ? openSessions.get(sandboxId) : undefined

  const sandbox = useMemo(
    () => (sandboxId ? sandboxes.find((s) => s.id === sandboxId) : undefined),
    [sandboxId, sandboxes]
  )

  const projectId = useMemo(() => {
    const fromState = (location.state as { projectId?: string })?.projectId
    if (fromState) return fromState
    return sandbox?.projects?.[0]?.id ?? ``
  }, [location.state, sandbox?.projects])

  const handleBack = useCallback(() => {
    navigate(`/`)
  }, [navigate])

  const handleViewChange = useCallback(
    (_evt: React.MouseEvent<HTMLElement>, value: TViewMode | null) => {
      if (value) setViewMode(value)
    },
    []
  )

  const handleConnect = useCallback(async () => {
    if (!sandboxId || !orgId || !projectId) return
    setConnecting(true)
    try {
      await openSession({ sandboxId, orgId, projectId })
    } catch (err) {
      console.error(`[Session] connect failed:`, err)
    } finally {
      setConnecting(false)
    }
  }, [sandboxId, orgId, projectId])

  if (!sandboxId) {
    return (
      <Page className='tdsk-session-page'>
        <Typography
          variant='h6'
          color='text.secondary'
        >
          No sandbox selected
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
            {session?.runtime || sandboxId}
          </Typography>
          {hasSession && (
            <>
              <SessionCommands
                sandboxId={sandboxId}
                projectId={projectId}
                onPendingOp={setPendingOp}
              />
              <ToggleButtonGroup
                value={viewMode}
                exclusive
                onChange={handleViewChange}
                size='small'
              >
                <ToggleButton value='chat'>
                  <Chat sx={{ fontSize: 18, mr: 0.5 }} />
                  Chat
                </ToggleButton>
                <ToggleButton value='terminal'>
                  <Terminal sx={{ fontSize: 18, mr: 0.5 }} />
                  Terminal
                </ToggleButton>
              </ToggleButtonGroup>
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
                    <Typography variant='h5'>{sandbox?.name || sandboxId}</Typography>
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
                  <Box sx={{ display: `flex`, justifyContent: `center` }}>
                    <Button
                      variant='contained'
                      size='large'
                      onClick={handleConnect}
                      disabled={!orgId || !projectId}
                    >
                      Start Session
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          ) : viewMode === `chat` ? (
            <ChatView sandboxId={sandboxId} />
          ) : (
            <TerminalView
              sandboxId={sandboxId}
              active={viewMode === `terminal`}
            />
          )}
        </ContentArea>
        {hasSession && viewMode === `chat` && <SmartInput sandboxId={sandboxId} />}
      </SessionContainer>
    </Page>
  )
}

export const Component = Session
export default Session
