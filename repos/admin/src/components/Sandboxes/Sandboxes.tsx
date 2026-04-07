import type { Sandbox, TSandboxConnectResponse } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { toast } from 'sonner'
import { ESBState } from '@tdsk/domain'
import { ConfirmDelete } from '@tdsk/components'
import { useSandboxes } from '@TAF/state/selectors'
import { useState, useMemo, useCallback } from 'react'
import { statusColor } from '@TAF/utils/sandbox/status'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { ConnectModal } from '@TAF/components/Sandboxes/ConnectModal'
import { SandboxDrawer } from '@TAF/components/Sandboxes/SandboxDrawer'
import { Box, Typography, Chip, CircularProgress } from '@mui/material'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  copySandbox,
  stopSandbox,
  startSandbox,
  deleteSandbox,
  connectSandbox,
} from '@TAF/actions/sandboxes'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Stop as StopIcon,
  Dns as SandboxIcon,
  Delete as DeleteIcon,
  PlayArrow as StartIcon,
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

type TPodState = { podName: string; state: ESBState }

export const Sandboxes = ({ orgId, projectId }: TSandboxes) => {
  const [sandboxes] = useSandboxes()
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState(``)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<Sandbox>()
  const [error, setError] = useState<Error | null>(null)
  const [podStates, setPodStates] = useState<Record<string, TPodState>>({})
  const [busySandboxes, setBusySandboxes] = useState<Set<string>>(new Set())
  const [selectedSandbox, setSelectedSandbox] = useState<Sandbox | null>(null)
  const [connectModalSandbox, setConnectModalSandbox] = useState<Sandbox | null>(null)
  const [connectData, setConnectData] = useState<TSandboxConnectResponse | null>(null)

  const isProjectContext = !!projectId
  const isOrgContext = !!orgId && !projectId

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
    setBusy(sandbox.id, true)
    setPodStates((prev) => ({
      ...prev,
      [sandbox.id]: { podName: ``, state: ESBState.Starting },
    }))

    const result = await startSandbox({
      orgId,
      sandboxId: sandbox.id,
      projectId: sandbox.projectId,
    })
    setBusy(sandbox.id, false)

    if (result.error) {
      setPodStates((prev) => {
        const next = { ...prev }
        delete next[sandbox.id]
        return next
      })
      toast.error(`Failed to start sandbox: ${result.error.message}`)
      return
    }

    const podName = result.data?.podName || ``
    setPodStates((prev) => ({
      ...prev,
      [sandbox.id]: { podName, state: ESBState.Running },
    }))
    toast.success(`Sandbox "${sandbox.name}" started`)
  }

  const onStopSandbox = async (sandbox: Sandbox) => {
    const pod = podStates[sandbox.id]
    if (!pod?.podName) return

    setBusy(sandbox.id, true)
    const result = await stopSandbox({
      orgId,
      sandboxId: sandbox.id,
      podName: pod.podName,
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
    setBusy(sandbox.id, true)
    setPodStates((prev) => ({
      ...prev,
      [sandbox.id]: {
        podName: prev[sandbox.id]?.podName || ``,
        state: ESBState.Starting,
      },
    }))

    const result = await connectSandbox({ orgId, sandboxId: sandbox.id })
    setBusy(sandbox.id, false)

    if (result.error) {
      setPodStates((prev) => {
        const next = { ...prev }
        delete next[sandbox.id]
        return next
      })
      toast.error(`Failed to connect to sandbox: ${result.error.message}`)
      return
    }

    const data = result.data || null
    if (data?.podName) {
      setPodStates((prev) => ({
        ...prev,
        [sandbox.id]: { podName: data.podName, state: ESBState.Running },
      }))
    }

    setConnectData(data)
    setConnectModalSandbox(sandbox)
  }

  const onConnectModalClose = () => {
    setConnectModalSandbox(null)
    setConnectData(null)
  }

  const onConnectModalStop = async () => {
    if (!connectModalSandbox || !connectData?.podName) return

    setBusy(connectModalSandbox.id, true)
    const result = await stopSandbox({
      orgId,
      sandboxId: connectModalSandbox.id,
      podName: connectData.podName,
    })
    setBusy(connectModalSandbox.id, false)

    if (result.error) {
      toast.error(`Failed to stop sandbox: ${result.error.message}`)
      return
    }

    setPodStates((prev) => {
      const next = { ...prev }
      delete next[connectModalSandbox.id]
      return next
    })
    toast.success(`Sandbox "${connectModalSandbox.name}" stopped`)
    onConnectModalClose()
  }

  const onCopySandbox = async (sandbox: Sandbox) => {
    setBusy(sandbox.id, true)
    const name = `${sandbox.name}-copy`
    const result = await copySandbox({ orgId, id: sandbox.id, name })
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

    const contextFiltered = sandboxArray.filter((sb) => {
      if (isProjectContext) return sb.projectId === projectId
      if (isOrgContext) return sb.orgId === orgId
      return false
    })

    if (!searchQuery.trim()) return contextFiltered

    const query = searchQuery.toLowerCase()
    return contextFiltered.filter(
      (sandbox) =>
        sandbox.name?.toLowerCase().includes(query) ||
        sandbox.config?.image?.toLowerCase().includes(query)
    )
  }, [sandboxes, searchQuery, orgId, projectId, isOrgContext, isProjectContext])

  const sandboxCount = useMemo(() => {
    const sandboxArray = sandboxes ? Object.values(sandboxes) : []
    if (isProjectContext)
      return sandboxArray.filter((sb) => sb.projectId === projectId).length
    if (isOrgContext) return sandboxArray.filter((sb) => sb.orgId === orgId).length
    return 0
  }, [sandboxes, orgId, projectId, isOrgContext, isProjectContext])

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
    ...(isOrgContext
      ? [
          {
            id: `project`,
            label: `Project`,
            render: (sandbox: Sandbox) => (
              <Typography
                variant='body2'
                color='text.secondary'
              >
                {sandbox.projectId || `—`}
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
        const pod = podStates[sandbox.id]
        const isBusy = busySandboxes.has(sandbox.id)
        const state = pod?.state || ESBState.Stopped

        if (isBusy && state === ESBState.Starting) {
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
            label={state}
            variant='outlined'
            color={statusColor(state)}
          />
        )
      },
    },
    {
      id: `actions`,
      label: `Actions`,
      align: `right` as const,
      render: (sandbox: Sandbox) => {
        const pod = podStates[sandbox.id]
        const isBusy = busySandboxes.has(sandbox.id)
        const isRunning = pod?.state === ESBState.Running

        return (
          <Box sx={styles.table.actions.box}>
            {isRunning ? (
              <ActionIconButton
                size='small'
                color='warning'
                disabled={isBusy}
                tooltip='Stop Sandbox'
                icon={<StopIcon sx={styles.table.actions.icon} />}
                onClick={(e) => {
                  e.stopPropagation()
                  onStopSandbox(sandbox)
                }}
              />
            ) : (
              <ActionIconButton
                size='small'
                color='info'
                disabled={isBusy}
                tooltip='Start Sandbox'
                icon={<StartIcon sx={styles.table.actions.icon} />}
                onClick={(e) => {
                  e.stopPropagation()
                  onStartSandbox(sandbox)
                }}
              />
            )}
            <ActionIconButton
              size='small'
              color='success'
              disabled={isBusy}
              tooltip='Connect to Sandbox'
              icon={<ConnectIcon sx={styles.table.actions.icon} />}
              onClick={(e) => {
                e.stopPropagation()
                onConnectSandbox(sandbox)
              }}
            />
            <ActionIconButton
              size='small'
              color='secondary'
              disabled={isBusy}
              tooltip='Copy Sandbox'
              icon={<CopyIcon sx={styles.table.actions.icon} />}
              onClick={(e) => {
                e.stopPropagation()
                onCopySandbox(sandbox)
              }}
            />
            <ActionIconButton
              size='small'
              color='primary'
              tooltip='Edit Sandbox'
              icon={<EditIcon sx={styles.table.actions.icon} />}
              onClick={(e) => {
                e.stopPropagation()
                onEditSandbox(sandbox)
              }}
            />
            <ActionIconButton
              size='small'
              color='error'
              tooltip='Delete Sandbox'
              icon={<DeleteIcon sx={styles.table.actions.icon} />}
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
      loading={loading}
      countLabel='config'
      query={searchQuery}
      count={sandboxCount}
      error={error?.message}
      title='Sandbox Configs'
      setSearchQuery={setSearchQuery}
      searchCount={0}
      searchPlaceholder='Search sandbox configs...'
      onAction={sandboxCount > 0 && onCreateSandbox}
      actionLabel={sandboxCount > 0 && 'Create Sandbox'}
      setError={(msg?: string) => setError(msg ? new Error(msg) : null)}
    >
      {!error && sandboxCount === 0 && !loading && (
        <EmptyState
          actionIcon={<AddIcon />}
          onAction={onCreateSandbox}
          actionLabel='Create Sandbox'
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

      {orgId && (
        <SandboxDrawer
          orgId={orgId}
          open={dialogOpen}
          projectId={projectId}
          onRemove={setDeleting}
          onClose={onDialogClose}
          sandbox={selectedSandbox}
        />
      )}

      <ConnectModal
        orgId={orgId}
        connectData={connectData}
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
