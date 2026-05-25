import { toast } from 'sonner'
import { nav } from '@TTH/services/nav'
import { useParams } from 'react-router'
import { Loading } from '@tdsk/components'
import { Page } from '@TTH/pages/Page/Page'
import { useCallback, useMemo } from 'react'
import { EditorPane } from '@TTH/components/Editor'
import { EShellMsg, EPermResource } from '@tdsk/domain'
import { usePermissions } from '@TTH/hooks/permissions'
import { SessionProvider } from '@TTH/contexts/SessionProvider'
import { useSessionContext } from '@TTH/contexts/SessionContext'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'
import { Box, Chip, Card, Button, Typography } from '@mui/material'
import { closeEditorFile } from '@TTH/actions/editor/closeEditorFile'
import { restartSandbox } from '@TTH/actions/sandboxes/restartSandbox'
import { selectEditorFile } from '@TTH/actions/editor/selectEditorFile'
import { toggleContextPanel } from '@TTH/actions/sidebar/toggleContextPanel'
import { ConfigRow, ConfigValue } from '@TTH/components/ConfigRow/ConfigRow'
import { closeAllEditorFiles } from '@TTH/actions/editor/closeAllEditorFiles'
import {
  useOrgId,
  useSandboxes,
  useOpenSessions,
  useOpenEditorFiles,
  useActiveEditorFile,
  useContextPanelOpen,
} from '@TTH/state/selectors'
import {
  sendControl,
  openSession,
  closeSession,
  activateSession,
  disconnectSession,
} from '@TTH/actions/sessions'
import {
  TerminalPane,
  ContextPanel,
  SessionLayout,
  SessionHeader,
} from '@TTH/components/SessionLayout'

type TSessionParams = {
  sessionId: string
  instanceId: string
}

const SessionInner = () => {
  const [orgId] = useOrgId()
  const [sandboxes] = useSandboxes()
  const [openSessions] = useOpenSessions()
  const [openEditorFiles] = useOpenEditorFiles()
  const [activeEditorFile] = useActiveEditorFile()
  const [contextPanelOpen] = useContextPanelOpen()
  const { sessionId } = useParams<TSessionParams>()
  const { session, isOwner, sandboxId, projectId, instanceId, connecting } =
    useSessionContext()

  const hasSession = !!session

  const { canConnect } = usePermissions()
  const canConnectSandbox = canConnect(EPermResource.sandbox)

  const sandbox = sandboxId ? sandboxes.find((s) => s.id === sandboxId) : undefined

  // Get all sessions on the same instance for tab bar
  const instanceSessions = useMemo(() => {
    if (!session?.instanceId) return []
    const result = []
    for (const s of openSessions.values()) {
      if (s.instanceId === session.instanceId) result.push(s)
    }
    return result
  }, [openSessions, session?.instanceId])

  const onConnect = useCallback(async () => {
    if (!sandboxId || !orgId || !projectId) return

    try {
      const { cols, rows } = estimateTerminalDimensions()
      const { sessionId: newSessionId, instanceId: newInstanceId } = await openSession({
        cols,
        rows,
        orgId,
        sandboxId,
        projectId,
        sessionId: null,
      })

      if (newSessionId)
        nav.session(orgId, projectId, newInstanceId, newSessionId, {
          replace: true,
          state: { sandboxId, projectId, instanceId: newInstanceId },
        })
      else
        toast.error(`Failed to connect`, {
          description: `No session was created. Try again.`,
        })
    } catch (err) {
      console.error(`[Session] connect failed:`, err)
      toast.error(`Failed to connect`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    }
  }, [sandboxId, orgId, projectId])

  const onNewSession = useCallback(async () => {
    if (!orgId || !sandboxId || !projectId) return
    try {
      const { cols, rows } = estimateTerminalDimensions()
      const { sessionId: newSessionId, instanceId: newInstanceId } = await openSession({
        cols,
        rows,
        orgId,
        sandboxId,
        projectId,
        sessionId: null,
        instanceId: session?.instanceId,
      })
      nav.session(orgId, projectId, newInstanceId, newSessionId, {
        replace: true,
        state: {
          sandboxId,
          projectId,
          instanceId: newInstanceId,
        },
      })
    } catch (err) {
      toast.error(`Failed to create session`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    }
  }, [sandboxId, orgId, projectId, session?.instanceId])

  const onTabClick = useCallback(
    (tabSessionId: string) => {
      if (!orgId || !projectId || !instanceId) return
      activateSession(tabSessionId)
      nav.session(orgId, projectId, instanceId, tabSessionId, {
        replace: true,
        state: sandboxId ? { sandboxId, projectId, instanceId } : undefined,
      })
    },
    [orgId, projectId, sandboxId, instanceId]
  )

  const onDetach = useCallback(() => {
    if (!sessionId || !orgId || !sandboxId) return
    try {
      const result = disconnectSession(sessionId)
      if (result) nav.sandbox(orgId, result.projectId, sandboxId, { replace: true })
    } catch (err) {
      toast.error(`Failed to detach`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    }
  }, [sessionId, orgId, sandboxId])

  const onRestart = useCallback(async () => {
    if (!orgId || !sandboxId || !projectId) return
    try {
      const result = await restartSandbox({
        orgId,
        sandboxId,
        projectId,
        instanceId: session?.instanceId,
      })

      if (result.opened === 0)
        toast.warning(`Restart completed`, { description: `No sessions were reopened` })
      else if (result.opened < result.total)
        toast.warning(
          `Partial restart: ${result.opened} of ${result.total} sessions reopened`
        )
      else
        toast.success(`Restarted`, {
          description: `${result.opened} session(s) reopened`,
        })
    } catch (err) {
      toast.error(`Failed to restart`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    }
  }, [orgId, sandboxId, projectId, session?.instanceId])

  const onShare = useCallback(() => {
    if (!sessionId || !session) return
    const newVisibility = session.visibility === `public` ? `private` : `public`
    const sent = sendControl(sessionId, {
      type: EShellMsg.Visibility,
      visibility: newVisibility,
    })
    if (sent)
      toast.success(`Visibility changed`, {
        description: `Session is now ${newVisibility}`,
      })
    else toast.error(`Failed to change visibility`, { description: `Connection lost` })
  }, [sessionId, session])

  const onEndSession = useCallback(() => {
    if (!sessionId) return
    closeSession(sessionId)

    orgId &&
      projectId &&
      sandboxId &&
      nav.sandbox(orgId, projectId, sandboxId, { replace: true })
  }, [sessionId, orgId, projectId, sandboxId])

  const onToggleContext = useCallback(() => toggleContextPanel(), [])
  const onCloseAllEditorFiles = useCallback(() => closeAllEditorFiles(), [])
  const onCloseEditorFile = useCallback((path: string) => closeEditorFile(path), [])
  const onSelectEditorFile = useCallback((path: string) => selectEditorFile(path), [])

  const hasEditorOpen = openEditorFiles.length > 0 && activeEditorFile !== null

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

  // Not connected state - show sandbox info + Start Session button
  if (!hasSession)
    return (
      <Page className='tdsk-session-page'>
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
              {canConnectSandbox && (
                <Box sx={{ display: `flex`, justifyContent: `center` }}>
                  <Button
                    variant='contained'
                    size='large'
                    onClick={onConnect}
                    disabled={!orgId || !projectId || !sandboxId}
                  >
                    Start Session
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Page>
    )

  // Connected state - terminal-first layout
  return (
    <Page
      className='tdsk-session-page'
      sx={{ p: `0 !important`, overflow: `hidden` }}
    >
      <SessionLayout
        header={
          <SessionHeader
            session={session}
            isOwner={isOwner}
            contextPanelOpen={contextPanelOpen}
            onToggleContext={onToggleContext}
            onDetach={onDetach}
            onRestart={onRestart}
            onShare={onShare}
            onEndSession={onEndSession}
          />
        }
        editor={
          hasEditorOpen ? (
            <EditorPane
              files={openEditorFiles}
              activeFile={activeEditorFile}
              onCloseFile={onCloseEditorFile}
              onSelectFile={onSelectEditorFile}
              onCloseAll={onCloseAllEditorFiles}
            />
          ) : undefined
        }
        terminal={
          <TerminalPane
            sessionId={sessionId}
            onTabClick={onTabClick}
            activeSessionId={sessionId}
            onNewSession={onNewSession}
            sessions={instanceSessions.length > 0 ? instanceSessions : [session]}
          />
        }
        contextPanel={
          <ContextPanel
            orgId={orgId}
            session={session}
            sandbox={sandbox}
            projectId={projectId}
          />
        }
      />
    </Page>
  )
}

const Session = () => (
  <SessionProvider>
    <SessionInner />
  </SessionProvider>
)

export default Session
