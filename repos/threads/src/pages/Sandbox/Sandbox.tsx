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
import { estimateTerminalDimensions } from '@TTH/utils/terminal'
import { useState, useCallback, useMemo, useEffect } from 'react'
import {
  Add,
  Dns,
  Code,
  Timer,
  VpnKey,
  Memory,
  Folder,
  Terminal,
  ArrowBack,
  PlayArrow,
} from '@mui/icons-material'
import { useOrgId, useSandboxes } from '@TTH/state/selectors'
import { ConfigRow, ConfigValue } from '@TTH/components/ConfigRow/ConfigRow'
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
  const [orgId] = useOrgId()
  const [sandboxes] = useSandboxes()

  const {
    sandboxId,
    orgId: paramOrgId,
    projectId: paramProjectId,
  } = useParams<TSandboxParams>()

  const { canExec } = usePermissions()
  const canExecSandbox = canExec(EPermResource.sandbox)

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

  const fetchInstances = useCallback(() => {
    if (!sandboxId || !resolvedOrgId || !projectId) return
    setLoadingInstances(true)
    sandboxApi
      .listInstances(resolvedOrgId, projectId, sandboxId)
      .then((resp) => {
        if (resp.error) {
          toast.error(`Failed to load instances`, {
            description: resp.error.message || `Could not fetch instance details`,
          })
          return
        }
        if (resp.data) {
          setInstances(resp.data.instances)
          setMaxInstances(resp.data.maxInstances)
        }
      })
      .catch((err) => {
        console.error(`[Sandbox] fetchInstances failed:`, err)
        toast.error(`Failed to load instances`, {
          description:
            err instanceof Error ? err.message : `An unexpected error occurred`,
        })
      })
      .finally(() => setLoadingInstances(false))
  }, [sandboxId, resolvedOrgId, projectId])

  useEffect(() => {
    fetchInstances()
  }, [fetchInstances])

  const onNewInstance = useCallback(async () => {
    if (!sandboxId || !resolvedOrgId || !projectId) return
    setConnecting(true)
    try {
      const { cols, rows } = estimateTerminalDimensions()
      const newSessionId = await openSession({
        sandboxId,
        projectId,
        cols,
        rows,
        orgId: resolvedOrgId,
        sessionId: null,
        newInstance: true,
      })

      if (newSessionId)
        nav.session(resolvedOrgId, projectId, newSessionId, {
          state: { sandboxId, projectId },
        })
    } catch (err) {
      console.error(`[Sandbox] connect failed:`, err)
      toast.error(`Failed to connect`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    } finally {
      setConnecting(false)
      fetchInstances()
    }
  }, [sandboxId, resolvedOrgId, projectId, fetchInstances])

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
          message='Starting instance...'
          messageSx={{ color: `text.primary` }}
        />
      </Page>
    )

  const config = sandbox?.config

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
          {config?.runtime && (
            <Chip
              size='small'
              color='primary'
              variant='outlined'
              label={config.runtime}
            />
          )}
        </Box>

        {config && (
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
              {config.image && (
                <ConfigRow
                  icon={<Memory sx={{ fontSize: 18 }} />}
                  label='Image'
                  value={
                    <ConfigValue
                      noWrap
                      sx={{ maxWidth: 350 }}
                      title={config.image}
                    >
                      {config.image}
                    </ConfigValue>
                  }
                />
              )}
              {config.runtime && (
                <ConfigRow
                  icon={<Terminal sx={{ fontSize: 18 }} />}
                  label='Runtime'
                  value={config.runtime}
                />
              )}
              {config.workdir && (
                <ConfigRow
                  icon={<Folder sx={{ fontSize: 18 }} />}
                  label='Working Dir'
                  value={config.workdir}
                />
              )}
              <ConfigRow
                icon={<VpnKey sx={{ fontSize: 18 }} />}
                label='SSH'
                value={config.sshEnabled ? `Enabled` : `Disabled`}
              />
              {config.idleTimeoutMinutes != null && (
                <ConfigRow
                  icon={<Timer sx={{ fontSize: 18 }} />}
                  label='Idle Timeout'
                  value={`${config.idleTimeoutMinutes} min`}
                />
              )}
              {config.initScript && (
                <ConfigRow
                  icon={<Code sx={{ fontSize: 18 }} />}
                  label='Init Script'
                  value={
                    <ConfigValue
                      noWrap
                      sx={{ maxWidth: 350, opacity: 0.8 }}
                      title={config.initScript}
                    >
                      {config.initScript.length > 60
                        ? `${config.initScript.slice(0, 60)}...`
                        : config.initScript}
                    </ConfigValue>
                  }
                />
              )}
            </Box>
          </Card>
        )}

        {loadingInstances ? (
          <Loading
            message='Loading instances...'
            messageSx={{ color: `text.primary` }}
          />
        ) : instances.length > 0 ? (
          <Box sx={{ display: `flex`, flexDirection: `column`, gap: 1.5, mb: 3 }}>
            <Typography
              variant='subtitle2'
              sx={{ fontWeight: 700, letterSpacing: 0.5, textTransform: `uppercase` }}
            >
              Instances
            </Typography>
            {instances.map((instance, idx) => (
              <Card
                key={instance.instanceId}
                variant='outlined'
                sx={{
                  transition: `border-color 0.2s ease, box-shadow 0.2s ease`,
                  '&:hover': {
                    borderColor: `primary.main`,
                    boxShadow: 1,
                  },
                }}
              >
                <CardActionArea
                  onClick={() =>
                    nav.instance(resolvedOrgId, projectId, sandboxId, instance.instanceId)
                  }
                  sx={{
                    p: 2,
                    display: `flex`,
                    alignItems: `center`,
                    justifyContent: `space-between`,
                  }}
                >
                  <Box sx={{ display: `flex`, alignItems: `center`, gap: 1.5 }}>
                    <Dns sx={{ fontSize: 20, color: `text.secondary` }} />
                    <Box>
                      <Typography
                        variant='body2'
                        sx={{ fontWeight: 600 }}
                      >
                        Instance {idx + 1}
                      </Typography>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                      >
                        {instance.instanceId.slice(-8)}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: `flex`, alignItems: `center`, gap: 1.5 }}>
                    <Chip
                      size='small'
                      variant='outlined'
                      label={`${instance.sessions.length} sessions`}
                      sx={{ height: 22, fontSize: `11px` }}
                    />
                    <Chip
                      size='small'
                      color={instance.state === `Running` ? `success` : `warning`}
                      label={instance.state}
                      sx={{ height: 22, fontSize: `11px` }}
                    />
                  </Box>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        ) : (
          <Box sx={{ textAlign: `center`, py: 4 }}>
            <Typography
              color='text.secondary'
              sx={{ mb: 2 }}
            >
              No instances running
            </Typography>
            {canExecSandbox && (
              <Button
                size='large'
                variant='contained'
                startIcon={<PlayArrow />}
                onClick={onNewInstance}
                disabled={!resolvedOrgId || !projectId}
              >
                Start Session
              </Button>
            )}
          </Box>
        )}

        {canExecSandbox && instances.length > 0 && (
          <Box sx={{ display: `flex`, justifyContent: `center`, mt: 2 }}>
            <Button
              size='large'
              variant='contained'
              startIcon={<Add />}
              onClick={onNewInstance}
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
