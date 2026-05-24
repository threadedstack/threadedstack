import { toast } from 'sonner'
import Box from '@mui/material/Box'
import { nav } from '@TTH/services/nav'
import { useParams } from 'react-router'
import Button from '@mui/material/Button'
import { Page } from '@TTH/pages/Page/Page'
import { EPermResource } from '@tdsk/domain'
import Typography from '@mui/material/Typography'
import { formatDate } from '@TTH/utils/formatDate'
import { openSession } from '@TTH/actions/sessions'
import { useState, useCallback, useMemo } from 'react'
import { usePermissions } from '@TTH/hooks/permissions'
import { Loading, Avatar as TdskAvatar } from '@tdsk/components'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'
import { NoInstances } from '@TTH/components/Instance/NoInstances'
import { InstanceList } from '@TTH/components/Instance/InstanceList'
import { useOrgId, useSandboxes, useSandboxInstances } from '@TTH/state/selectors'
import {
  StatStrip,
  StatusChip,
  PageHeader,
  SectionHeader,
} from '@TTH/components/PagePrimitives'
import { Add, Link, Public, Dataset, Settings, RocketLaunch } from '@mui/icons-material'

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
  const [instancesMap] = useSandboxInstances()

  const sandbox = useMemo(
    () => sandboxes.find((s) => s.id === sandboxId),
    [sandboxes, sandboxId]
  )

  const resolvedOrgId = paramOrgId || orgId
  const projectId = paramProjectId || sandbox?.projects?.[0]?.id || ``

  const instanceData = sandboxId ? instancesMap.get(sandboxId) : undefined
  const instances = instanceData?.instances ?? []
  const maxInstances = instanceData?.maxInstances ?? 1

  const onNewInstance = useCallback(async () => {
    if (!sandboxId || !resolvedOrgId || !projectId) return
    setConnecting(true)
    try {
      const { cols, rows } = estimateTerminalDimensions()
      const { sessionId: newSessionId, instanceId: newInstanceId } = await openSession({
        cols,
        rows,
        projectId,
        sandboxId,
        sessionId: null,
        newInstance: true,
        orgId: resolvedOrgId,
      })

      if (newSessionId)
        nav.session(resolvedOrgId, projectId, newInstanceId, newSessionId, {
          state: {
            sandboxId,
            projectId,
            instanceId: newInstanceId,
          },
        })
      else
        toast.error(`Failed to start session`, {
          description: `No session was created. Try again or check sandbox status.`,
        })
    } catch (err) {
      console.error(`[Sandbox] connect failed:`, err)
      toast.error(`Failed to connect`, {
        description: err instanceof Error ? err.message : `An unexpected error occurred`,
      })
    } finally {
      setConnecting(false)
    }
  }, [sandboxId, resolvedOrgId, projectId])

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
  const runtime = config?.runtime || `custom`
  const cpu = config?.resources?.limits?.cpu || config?.resources?.requests?.cpu || `-`
  const mem =
    config?.resources?.limits?.memory || config?.resources?.requests?.memory || `-`

  const specs = `${cpu} x ${mem}`
  const runningCount = instances.filter((i) => i.state === `Running`).length
  const project = sandbox?.projects?.find((p) => p.id === projectId)
  const eyebrowText = project ? `${project.name} · Sandbox` : `Sandbox`

  return (
    <Page className='tdsk-sandbox-page'>
      <Box sx={{ maxWidth: 960, mx: `auto`, width: `100%`, py: 4, px: 2 }}>
        <PageHeader
          titleMono
          eyebrow={eyebrowText}
          eyebrowIcon={<Dataset />}
          title={sandbox?.name || sandboxId}
          statusChip={<StatusChip status={runningCount > 0 ? `running` : `stopped`} />}
          actions={
            <>
              <Button
                disabled
                size='small'
                variant='outlined'
                title='Coming soon'
                startIcon={<Link />}
              >
                Attach
              </Button>
              <Button
                disabled
                size='small'
                variant='outlined'
                title='Coming soon'
                startIcon={<Settings />}
              >
                Configure
              </Button>
              {canExecSandbox && (
                <Button
                  size='small'
                  variant='contained'
                  startIcon={<Add />}
                  onClick={onNewInstance}
                  disabled={
                    !resolvedOrgId || !projectId || instances.length >= maxInstances
                  }
                >
                  Deploy
                </Button>
              )}
            </>
          }
        />

        <StatStrip
          cells={[
            {
              value: runtime,
              label: `Runtime`,
              icon: <RocketLaunch sx={{ fontSize: 14, color: `text.secondary` }} />,
            },
            { label: `Resources`, value: specs, help: `vCPU × RAM`, sans: true },
            {
              sans: true,
              label: `Region`,
              value: `default`,
              icon: <Public sx={{ fontSize: 14, color: `text.secondary` }} />,
            },
            {
              label: `Instances`,
              help: `running / total`,
              value: `${runningCount} / ${instances.length}`,
            },
            { label: `Uptime`, value: `-`, sans: true },
            { label: `Last deploy`, value: formatDate(sandbox?.updatedAt), sans: true },
          ]}
        />

        <SectionHeader
          title='Instances'
          count={instances.length}
          actions={
            canExecSandbox ? (
              <Button
                size='small'
                variant='outlined'
                startIcon={<Add />}
                onClick={onNewInstance}
                disabled={
                  !resolvedOrgId || !projectId || instances.length >= maxInstances
                }
              >
                Spin up
              </Button>
            ) : undefined
          }
        />

        {instances.length > 0 ? (
          <InstanceList
            sandbox={sandbox}
            instances={instances}
            orgId={resolvedOrgId}
            projectId={projectId}
            sandboxId={sandboxId}
          />
        ) : (
          <NoInstances
            orgId={resolvedOrgId}
            projectId={projectId}
            onNewInstance={onNewInstance}
            canExecSandbox={canExecSandbox}
          />
        )}
      </Box>
    </Page>
  )
}

export default Sandbox
