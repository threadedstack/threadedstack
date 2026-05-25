import type { Sandbox, TSBConnectResp, TSandboxSession } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { toast } from 'sonner'
import { ConfirmDelete } from '@tdsk/components'
import { useState, useMemo, useCallback } from 'react'
import { statusColor } from '@TAF/utils/sandbox/status'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { ConnectModal } from '@TAF/components/Sandboxes/ConnectModal'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { ESBState, ESandboxRuntime, EPermResource } from '@tdsk/domain'
import { useOrgSandboxes, useProjectSandboxes } from '@TAF/state/selectors'
import { OrgSandboxDrawer } from '@TAF/components/Sandboxes/OrgSandboxDrawer'
import { Box, Typography, Chip, CircularProgress, Tooltip } from '@mui/material'
import { getSandboxSessions } from '@TAF/actions/sandboxes/api/getSandboxSessions'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import { ProjectSandboxDrawer } from '@TAF/components/Sandboxes/ProjectSandboxDrawer'
import {
  copySandbox,
  stopSandbox,
  startSandbox,
  deleteSandbox,
  connectSandbox,
} from '@TAF/actions/sandboxes'
import {
  Key as KeyIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Stop as StopIcon,
  Dns as SandboxIcon,
  Delete as DeleteIcon,
  PlayArrow as StartIcon,
  Warning as WarningIcon,
  Terminal as ConnectIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material'

export type TSandboxes = {
  orgId: string
  projectId?: string
}

const styles = {
  table: {
    actions: {
      box: {
        gap: 1.5,
        display: `flex`,
        alignItems: `center`,
        justifyContent: `end`,
      },
      icon: { fontSize: `16px` },
    },
  },
}

type TInstanceStates = Record<string, TInstanceState[]>
type TInstanceState = { instanceId: string; state: ESBState }

export const Sandboxes = (props: TSandboxes) => {
  const { orgId, projectId } = props
  const [orgSandboxes] = useOrgSandboxes()
  const [loading, setLoading] = useState(false)
  const [projectSandboxes] = useProjectSandboxes()
  const [searchQuery, setSearchQuery] = useState(``)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<Sandbox>()
  const [error, setError] = useState<Error | null>(null)
  const [podStates, setPodStates] = useState<TInstanceStates>({})
  const [busySandboxes, setBusySandboxes] = useState<Set<string>>(new Set())
  const [connectData, setConnectData] = useState<TSBConnectResp | null>(null)
  const [selectedSandbox, setSelectedSandbox] = useState<Sandbox | null>(null)
  const [connectSessions, setConnectSessions] = useState<TSandboxSession[]>([])
  const { canCreate, canUpdate, canDelete, canExec, canConnect } = usePermissions()
  const [connectModalSandbox, setConnectModalSandbox] = useState<Sandbox | null>(null)

  const sandboxes = projectId ? projectSandboxes : orgSandboxes

  const setBusy = useCallback((id: string, busy: boolean) => {
    setBusySandboxes((prev) => {
      const next = new Set(prev)
      busy ? next.add(id) : next.delete(id)
      return next
    })
  }, [])

  const onCreateSandbox = () => {
    setSelectedSandbox(null)
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
    setSelectedSandbox(null)
  }

  const onEditSandbox = (sandbox: Sandbox) => {
    setSelectedSandbox(sandbox)
    setDialogOpen(true)
  }

  const onStartSandbox = async (sandbox: Sandbox) => {
    if (!projectId) {
      toast.error(`Sandbox can only be started from a project context`)
      return
    }

    setBusy(sandbox.id, true)
    setPodStates((prev) => ({
      ...prev,
      [sandbox.id]: [
        ...(prev[sandbox.id] || []),
        { instanceId: ``, state: ESBState.Starting },
      ],
    }))

    const result = await startSandbox({
      orgId,
      sandboxId: sandbox.id,
      projectId,
    })
    setBusy(sandbox.id, false)

    if (result.error) {
      setPodStates((prev) => ({
        ...prev,
        [sandbox.id]: (prev[sandbox.id] || []).filter((p) => p.instanceId !== ``),
      }))
      toast.error(`Failed to start sandbox: ${result.error.message}`)
      return
    }

    const instanceId = result.data?.instanceId || ``
    setPodStates((prev) => ({
      ...prev,
      [sandbox.id]: (prev[sandbox.id] || [])
        .filter((p) => p.instanceId !== ``)
        .concat({ instanceId, state: ESBState.Running }),
    }))
    toast.success(`Sandbox "${sandbox.name}" started`)
  }

  const onStopSandbox = async (sandbox: Sandbox) => {
    if (!projectId) {
      toast.error(`Sandbox can only be stopped from a project context`)
      return
    }

    const pods = podStates[sandbox.id] || []
    if (pods.length === 0) return

    setBusy(sandbox.id, true)
    const result = await stopSandbox({
      orgId,
      projectId,
      force: true,
      stopAll: true,
      sandboxId: sandbox.id,
    })
    setBusy(sandbox.id, false)

    if (result.error) {
      toast.error(`Failed to stop sandbox: ${result.error.message}`)
      return
    }

    setPodStates((prev) => {
      const next = { ...prev }
      delete next[sandbox.id]
      return next
    })
    toast.success(`Sandbox "${sandbox.name}" stopped`)
  }

  const onConnectSandbox = async (sandbox: Sandbox) => {
    if (!projectId) {
      toast.error(`Sandbox can only be connected from a project context`)
      return
    }

    setBusy(sandbox.id, true)
    setPodStates((prev) => ({
      ...prev,
      [sandbox.id]: [
        ...(prev[sandbox.id] || []),
        { instanceId: ``, state: ESBState.Starting },
      ],
    }))

    const result = await connectSandbox({
      orgId,
      projectId,
      newInstance: true,
      sandboxId: sandbox.id,
    })
    setBusy(sandbox.id, false)

    if (result.error) {
      setPodStates((prev) => ({
        ...prev,
        [sandbox.id]: (prev[sandbox.id] || []).filter((p) => p.instanceId !== ``),
      }))
      toast.error(`Failed to connect to sandbox: ${result.error.message}`)
      return
    }

    const data = result.data || null
    if (data?.instanceId) {
      setPodStates((prev) => {
        const existing = prev[sandbox.id] || []
        const already = existing.some((p) => p.instanceId === data.instanceId)
        return {
          ...prev,
          [sandbox.id]: already
            ? existing.map((p) =>
                p.instanceId === data.instanceId ? { ...p, state: ESBState.Running } : p
              )
            : existing
                .filter((p) => p.instanceId !== ``)
                .concat({ instanceId: data.instanceId, state: ESBState.Running }),
        }
      })
    }

    setConnectData(data)
    setConnectModalSandbox(sandbox)

    const sessionsResult = await getSandboxSessions({
      orgId,
      projectId,
      sandboxId: sandbox.id,
    })
    setConnectSessions(sessionsResult.data || [])
  }

  const onConnectModalClose = () => {
    setConnectModalSandbox(null)
    setConnectData(null)
    setConnectSessions([])
  }

  const onConnectModalStop = async () => {
    if (!connectModalSandbox || !connectData?.instanceId || !projectId) return

    setBusy(connectModalSandbox.id, true)
    const result = await stopSandbox({
      orgId,
      projectId,
      sandboxId: connectModalSandbox.id,
      instanceId: connectData.instanceId,
    })
    setBusy(connectModalSandbox.id, false)

    if (result.error) {
      toast.error(`Failed to stop sandbox: ${result.error.message}`)
      return
    }

    setPodStates((prev) => ({
      ...prev,
      [connectModalSandbox.id]: (prev[connectModalSandbox.id] || []).filter(
        (p) => p.instanceId !== connectData.instanceId
      ),
    }))
    toast.success(`Sandbox "${connectModalSandbox.name}" stopped`)
    onConnectModalClose()
  }

  const onCopySandbox = async (sandbox: Sandbox) => {
    setBusy(sandbox.id, true)
    const name = `${sandbox.name}-copy`
    const result = await copySandbox({ orgId, id: sandbox.id, name, projectId })
    setBusy(sandbox.id, false)

    if (result.error) {
      toast.error(`Failed to copy sandbox: ${result.error.message}`)
      return
    }

    toast.success(`Sandbox "${sandbox.name}" copied as "${name}"`)
  }

  const onRemove = async () => {
    if (!deleting) return

    setLoading(true)
    setError(null)

    const result = await deleteSandbox({ orgId, id: deleting.id })
    result.error && setError(result.error)

    if (!result.error)
      setPodStates((prev) => {
        const next = { ...prev }
        delete next[deleting.id]
        return next
      })

    setLoading(false)
    setDeleting(undefined)
  }

  const filteredSandboxes = useMemo(() => {
    const sandboxArray = sandboxes ? Object.values(sandboxes) : []
    if (!searchQuery.trim()) return sandboxArray
    const query = searchQuery.toLowerCase()
    return sandboxArray.filter(
      (sandbox) =>
        sandbox.name?.toLowerCase().includes(query) ||
        sandbox.config?.image?.toLowerCase().includes(query)
    )
  }, [sandboxes, searchQuery])

  const sandboxCount = useMemo(
    () => (sandboxes ? Object.values(sandboxes).length : 0),
    [sandboxes]
  )

  const columns: TDataTableColumn<Sandbox>[] = [
    {
      id: `name`,
      label: `Name`,
      render: (sandbox: Sandbox) => (
        <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
          <SandboxIcon sx={{ color: `text.secondary`, fontSize: 20 }} />
          <Typography
            variant='body2'
            fontWeight='medium'
          >
            {sandbox.name}
          </Typography>
        </Box>
      ),
    },
    ...(projectId
      ? [
          {
            id: `alias`,
            label: `Alias`,
            render: (sandbox: Sandbox) => {
              const alias = sandbox.projectConfigs?.find(
                (pc) => pc.projectId === projectId
              )?.alias
              return (
                <Typography
                  variant='body2'
                  fontFamily='monospace'
                  color='text.secondary'
                >
                  {alias || `--`}
                </Typography>
              )
            },
          } as TDataTableColumn<Sandbox>,
        ]
      : []),
    {
      id: `auth`,
      label: `Auth`,
      render: (sandbox: Sandbox) => {
        const providers = sandbox.providers || []
        const isCustom = sandbox.config?.runtime === ESandboxRuntime.custom

        if (isCustom) {
          return (
            <Typography
              variant='body2'
              color='text.secondary'
            >
              --
            </Typography>
          )
        }

        if (providers.length === 0) {
          return (
            <Tooltip title='No provider linked'>
              <WarningIcon
                fontSize='small'
                color='warning'
              />
            </Tooltip>
          )
        }

        const primary = providers[0]
        return (
          <Tooltip title={primary.name || primary.id}>
            <Chip
              size='small'
              variant='outlined'
              color='success'
              icon={<KeyIcon sx={{ fontSize: 14 }} />}
              label={primary.brand || 'linked'}
            />
          </Tooltip>
        )
      },
    },
    {
      id: `image`,
      label: `Image`,
      render: (sandbox: Sandbox) => (
        <Typography
          variant='body2'
          fontFamily='monospace'
          color='text.secondary'
        >
          {sandbox.config?.image}
        </Typography>
      ),
    },
    ...(!projectId
      ? [
          {
            id: `project`,
            label: `Projects`,
            render: (sandbox: Sandbox) => (
              <Typography
                variant='body2'
                color='text.secondary'
              >
                {sandbox.projects?.length
                  ? sandbox.projects.map((p) => p.name).join(', ')
                  : `—`}
              </Typography>
            ),
          } as TDataTableColumn<Sandbox>,
        ]
      : []),
    {
      id: `ports`,
      label: `Ports`,
      render: (sandbox: Sandbox) => (
        <Box sx={{ display: `flex`, gap: 0.5, flexWrap: `wrap` }}>
          {Object.keys(sandbox.config?.ports || {}).map((port) => (
            <Chip
              key={port}
              label={port}
              size='small'
              variant='outlined'
            />
          ))}
        </Box>
      ),
    },
    {
      id: `resources`,
      label: `Resources`,
      render: (sandbox: Sandbox) => (
        <Typography
          variant='body2'
          color='text.secondary'
        >
          {sandbox.config?.resources?.limits?.cpu || `-`} /{' '}
          {sandbox.config?.resources?.limits?.memory || `-`}
        </Typography>
      ),
    },
    {
      id: `status`,
      label: `Status`,
      render: (sandbox: Sandbox) => {
        const pods = podStates[sandbox.id] || []
        const isBusy = busySandboxes.has(sandbox.id)
        const runningCount = pods.filter((p) => p.state === ESBState.Running).length
        const isStarting = pods.some((p) => p.state === ESBState.Starting)
        const state = isStarting
          ? ESBState.Starting
          : runningCount > 0
            ? ESBState.Running
            : ESBState.Stopped

        if (isBusy && isStarting) {
          return (
            <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
              <CircularProgress size={14} />
              <Typography
                variant='body2'
                color='text.secondary'
              >
                Starting
              </Typography>
            </Box>
          )
        }

        return (
          <Chip
            size='small'
            variant='outlined'
            color={statusColor(state)}
            label={runningCount > 1 ? `${runningCount} Running` : state}
          />
        )
      },
    },
    {
      id: `actions`,
      label: `Actions`,
      align: `right` as const,
      render: (sandbox: Sandbox) => {
        const pods = podStates[sandbox.id] || []
        const isBusy = busySandboxes.has(sandbox.id)
        const isRunning = pods.some((p) => p.state === ESBState.Running)

        return (
          <Box sx={styles.table.actions.box}>
            {projectId &&
              (isRunning ? (
                <ActionIconButton
                  size='small'
                  color='warning'
                  tooltip='Stop Sandbox'
                  icon={<StopIcon sx={styles.table.actions.icon} />}
                  disabled={isBusy || !canExec(EPermResource.sandbox)}
                  disabledTooltip='You do not have permission to stop sandboxes'
                  onClick={(e) => {
                    e.stopPropagation()
                    onStopSandbox(sandbox)
                  }}
                />
              ) : (
                <ActionIconButton
                  size='small'
                  color='info'
                  tooltip='Start Sandbox'
                  icon={<StartIcon sx={styles.table.actions.icon} />}
                  disabled={isBusy || !canConnect(EPermResource.sandbox)}
                  disabledTooltip='You do not have permission to start sandboxes'
                  onClick={(e) => {
                    e.stopPropagation()
                    onStartSandbox(sandbox)
                  }}
                />
              ))}
            {projectId && (
              <ActionIconButton
                size='small'
                color='success'
                tooltip='Connect to Sandbox'
                disabled={isBusy || !canConnect(EPermResource.sandbox)}
                icon={<ConnectIcon sx={styles.table.actions.icon} />}
                disabledTooltip='You do not have permission to connect to sandboxes'
                onClick={(e) => {
                  e.stopPropagation()
                  onConnectSandbox(sandbox)
                }}
              />
            )}
            <ActionIconButton
              size='small'
              color='secondary'
              tooltip='Copy Sandbox'
              icon={<CopyIcon sx={styles.table.actions.icon} />}
              disabled={isBusy || !canCreate(EPermResource.sandbox)}
              disabledTooltip='You do not have permission to copy sandboxes'
              onClick={(e) => {
                e.stopPropagation()
                onCopySandbox(sandbox)
              }}
            />
            <ActionIconButton
              size='small'
              color='primary'
              tooltip='Edit Sandbox'
              disabled={!canUpdate(EPermResource.sandbox)}
              icon={<EditIcon sx={styles.table.actions.icon} />}
              disabledTooltip='You do not have permission to edit sandboxes'
              onClick={(e) => {
                e.stopPropagation()
                onEditSandbox(sandbox)
              }}
            />
            <ActionIconButton
              size='small'
              color='error'
              tooltip='Delete Sandbox'
              disabled={!canDelete(EPermResource.sandbox)}
              icon={<DeleteIcon sx={styles.table.actions.icon} />}
              disabledTooltip='You do not have permission to delete sandboxes'
              onClick={(e) => {
                e.stopPropagation()
                setDeleting(sandbox)
              }}
            />
          </Box>
        )
      },
    },
  ]

  return (
    <PageLayout
      searchCount={0}
      loading={loading}
      countLabel='config'
      query={searchQuery}
      count={sandboxCount}
      error={error?.message}
      title='Sandbox Configs'
      setSearchQuery={setSearchQuery}
      searchPlaceholder='Search sandbox configs...'
      onAction={sandboxCount > 0 && onCreateSandbox}
      actionLabel={sandboxCount > 0 && 'Create Sandbox'}
      actionDisabled={!canCreate(EPermResource.sandbox)}
      setError={(msg?: string) => setError(msg ? new Error(msg) : null)}
    >
      {!error && sandboxCount === 0 && !loading && (
        <EmptyState
          actionIcon={<AddIcon />}
          onAction={onCreateSandbox}
          actionLabel='Create Sandbox'
          actionDisabled={!canCreate(EPermResource.sandbox)}
          message='No sandbox configs yet. Create your first sandbox config to get started.'
        />
      )}

      {!error && sandboxCount > 0 && filteredSandboxes.length === 0 && (
        <EmptyState message='No sandboxes match your search.' />
      )}

      {!error && filteredSandboxes.length > 0 && (
        <DataTable
          columns={columns}
          getRowKey={(s) => s.id}
          data={filteredSandboxes}
          onRowClick={onEditSandbox}
        />
      )}

      {orgId && projectId && (
        <ProjectSandboxDrawer
          orgId={orgId}
          open={dialogOpen}
          projectId={projectId}
          onRemove={setDeleting}
          onClose={onDialogClose}
          sandbox={selectedSandbox}
        />
      )}

      {orgId && !projectId && (
        <OrgSandboxDrawer
          orgId={orgId}
          open={dialogOpen}
          onRemove={setDeleting}
          onClose={onDialogClose}
          sandbox={selectedSandbox}
        />
      )}

      <ConnectModal
        orgId={orgId}
        connectData={connectData}
        sessions={connectSessions}
        onStop={onConnectModalStop}
        open={!!connectModalSandbox}
        sandbox={connectModalSandbox}
        onClose={onConnectModalClose}
        stopping={!!connectModalSandbox && busySandboxes.has(connectModalSandbox.id)}
      />

      {deleting && (
        <ConfirmDelete
          deleting={loading}
          onConfirm={onRemove}
          itemName={deleting.name}
          onCancel={() => setDeleting(undefined)}
          text={`Are you sure you want to delete "${deleting.name}"? This cannot be undone.`}
        />
      )}
    </PageLayout>
  )
}
