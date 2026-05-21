import type { TSandboxInstance } from '@tdsk/domain'
import type { TSandboxStatus } from '@TTH/types'

import { toast } from 'sonner'
import Box from '@mui/material/Box'
import { nav } from '@TTH/services/nav'
import { useParams } from 'react-router'
import Button from '@mui/material/Button'
import { Page } from '@TTH/pages/Page/Page'
import { EPermResource } from '@tdsk/domain'
import { MonoFont } from '@TTH/constants/values'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import { openSession } from '@TTH/actions/sessions'
import { sandboxApi } from '@TTH/services/sandboxApi'
import { usePermissions } from '@TTH/hooks/permissions'
import { ValidStatuses } from '@TTH/constants/sessions'
import { useOrgId, useSandboxes } from '@TTH/state/selectors'
import { Loading, Avatar as TdskAvatar } from '@tdsk/components'
import { estimateTerminalDimensions } from '@TTH/utils/terminal'
import { useState, useCallback, useMemo, useEffect } from 'react'
import { formatDate, formatTimestamp } from '@TTH/utils/formatDate'
import {
  RowList,
  StatStrip,
  StatusChip,
  PageHeader,
  SectionHeader,
} from '@TTH/components/PagePrimitives'
import {
  Add,
  Link,
  Public,
  Dataset,
  Memory,
  Settings,
  MoreHoriz,
  RocketLaunch,
} from '@mui/icons-material'

type TSandboxParams = {
  orgId: string
  projectId: string
  sandboxId: string
}

const toSandboxStatus = (state: string): TSandboxStatus =>
  ValidStatuses.has(state.toLowerCase())
    ? (state.toLowerCase() as TSandboxStatus)
    : `stopped`

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
        cols,
        rows,
        projectId,
        sandboxId,
        sessionId: null,
        newInstance: true,
        orgId: resolvedOrgId,
      })

      if (newSessionId)
        nav.session(resolvedOrgId, projectId, newSessionId, {
          state: { sandboxId, projectId },
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
      fetchInstances()
    }
  }, [sandboxId, resolvedOrgId, projectId, fetchInstances])

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

  const columns = [
    { label: `Instance`, width: `1.6fr` },
    { label: `Status`, width: `100px` },
    { label: `Spec`, width: `110px` },
    { label: `Owner`, width: `120px` },
    { label: `Started`, width: `130px` },
    { label: `Sessions`, width: `70px` },
    { label: ``, width: `32px` },
  ]

  return (
    <Page className='tdsk-sandbox-page'>
      <Box sx={{ maxWidth: 960, mx: `auto`, width: `100%`, py: 4, px: 2 }}>
        <PageHeader
          eyebrow={eyebrowText}
          eyebrowIcon={<Dataset />}
          title={sandbox?.name || sandboxId}
          titleMono
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
              label: `Runtime`,
              value: runtime,
              icon: <RocketLaunch sx={{ fontSize: 14, color: `text.secondary` }} />,
            },
            { label: `Resources`, value: specs, help: `vCPU × RAM`, sans: true },
            {
              label: `Region`,
              value: `default`,
              sans: true,
              icon: <Public sx={{ fontSize: 14, color: `text.secondary` }} />,
            },
            {
              label: `Instances`,
              value: `${runningCount} / ${instances.length}`,
              help: `running / total`,
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

        {loadingInstances ? (
          <Loading
            message='Loading instances...'
            messageSx={{ color: `text.primary` }}
          />
        ) : instances.length > 0 ? (
          <RowList columns={columns}>
            {instances.map((instance, idx) => (
              <RowList.Row
                key={instance.instanceId}
                isLast={idx === instances.length - 1}
                onClick={() =>
                  nav.instance(resolvedOrgId, projectId, sandboxId, instance.instanceId)
                }
              >
                {/* Instance */}
                <Box sx={{ display: `flex`, alignItems: `center`, gap: `10px` }}>
                  <Memory sx={{ fontSize: 18, color: `text.secondary` }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: `13px`,
                        fontWeight: 600,
                        overflow: `hidden`,
                        whiteSpace: `nowrap`,
                        fontFamily: MonoFont,
                        textOverflow: `ellipsis`,
                      }}
                    >
                      Instance {idx + 1}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: `11px`,
                        color: `text.secondary`,
                        overflow: `hidden`,
                        textOverflow: `ellipsis`,
                        whiteSpace: `nowrap`,
                      }}
                    >
                      {instance.instanceId.slice(-12)}
                    </Typography>
                  </Box>
                </Box>

                {/* Status */}
                <Box sx={{ display: `flex`, alignItems: `center` }}>
                  <StatusChip
                    status={toSandboxStatus(instance.state)}
                    size='sm'
                  />
                </Box>

                {/* Spec */}
                <Box sx={{ display: `flex`, alignItems: `center` }}>
                  <Typography
                    sx={{
                      fontSize: `12px`,
                      fontFamily: MonoFont,
                      color: `text.secondary`,
                    }}
                  >
                    {specs}
                  </Typography>
                </Box>

                {/* Owner */}
                <Box sx={{ display: `flex`, alignItems: `center`, gap: `6px` }}>
                  <TdskAvatar
                    name={instance.userId || `?`}
                    size='sm'
                  />
                  <Typography
                    noWrap
                    sx={{ fontSize: `12px` }}
                  >
                    {instance.userId ? instance.userId.slice(0, 8) : `-`}
                  </Typography>
                </Box>

                {/* Started */}
                <Box sx={{ display: `flex`, alignItems: `center` }}>
                  <Typography sx={{ fontSize: `12px`, color: `text.secondary` }}>
                    {instance.sessions?.[0]?.connectedAt
                      ? formatTimestamp(instance.sessions[0].connectedAt)
                      : `-`}
                  </Typography>
                </Box>

                {/* Sessions */}
                <Box sx={{ display: `flex`, alignItems: `center` }}>
                  <Typography sx={{ fontSize: `13px`, fontWeight: 500 }}>
                    {instance.sessions.length}
                  </Typography>
                </Box>

                {/* Actions */}
                <Box sx={{ display: `flex`, alignItems: `center` }}>
                  <IconButton
                    disabled
                    size='small'
                    title='Coming soon'
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHoriz sx={{ fontSize: 18 }} />
                  </IconButton>
                </Box>
              </RowList.Row>
            ))}
          </RowList>
        ) : (
          <Box
            sx={{
              py: 6,
              border: 1,
              borderRadius: `8px`,
              textAlign: `center`,
              borderColor: `divider`,
              bgcolor: `background.paper`,
            }}
          >
            <Typography
              color='text.secondary'
              sx={{ mb: 2 }}
            >
              No instances running
            </Typography>
            {canExecSandbox && (
              <Button
                size='small'
                variant='contained'
                startIcon={<Add />}
                onClick={onNewInstance}
                disabled={!resolvedOrgId || !projectId}
              >
                Start Instance
              </Button>
            )}
          </Box>
        )}
      </Box>
    </Page>
  )
}

export default Sandbox
