import type { TOpsActionRow } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { useState, useMemo } from 'react'
import { EPermResource, EOpsActionStatus, EOpsAction } from '@tdsk/domain'
import { useOpsActions } from '@TAF/state/selectors'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { overrideOpsAction } from '@TAF/actions/opsActions/api/overrideOpsAction'
import { OpsActionDrawer } from '@TAF/components/OpsActions/OpsActionDrawer'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import { Text, Dialog, Button, TextInput, DataTableSkeleton } from '@tdsk/components'
import {
  Check as ApproveIcon,
  Close as RejectIcon,
  Undo as RevertIcon,
  BuildCircle as OpsIcon,
} from '@mui/icons-material'

const ASYNC_OVERRIDE_COPY = `Async override — the adversary cycle is the default gate; this is a human safety net.`

export type TOpsActions = {
  orgId?: string
}

type TOpsActionStatus = `${EOpsActionStatus}`

const statusColor: Record<
  TOpsActionStatus,
  'default' | 'info' | 'warning' | 'success' | 'error'
> = {
  [EOpsActionStatus.proposed]: 'info',
  [EOpsActionStatus.dryRun]: 'warning',
  [EOpsActionStatus.rejected]: 'error',
  [EOpsActionStatus.executed]: 'success',
  [EOpsActionStatus.failed]: 'error',
}

const isTerminal = (status: TOpsActionStatus) =>
  status === EOpsActionStatus.rejected || status === EOpsActionStatus.failed

const actionChipColor = (action: string) => {
  const writeActions: string[] = [
    EOpsAction.triggerRedeploy,
    EOpsAction.restartDeployment,
    EOpsAction.applySandboxConfig,
  ]
  return writeActions.includes(action) ? 'warning' : 'info'
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
  dialog: {
    gap: 2,
    pt: 1,
    display: 'flex',
    flexDirection: 'column',
  },
}

const skeletonColumns = [
  { id: `action`, label: `Action` },
  { id: `agentId`, label: `Agent` },
  { id: `status`, label: `Status`, width: 50 },
  { id: `createdAt`, label: `Created` },
  { id: `actions`, label: `Actions`, align: `right` as const },
]

export const OpsActions = (props: TOpsActions) => {
  const { orgId } = props

  const { canUpdate } = usePermissions()
  const allowUpdate = canUpdate(EPermResource.opsAction)
  const [opsActionsMap] = useOpsActions()
  const isInitialLoading = opsActionsMap === undefined
  const opsActions = useMemo(() => Object.values(opsActionsMap || {}), [opsActionsMap])

  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error>()
  const [selected, setSelected] = useState<TOpsActionRow | null>(null)

  // Approve dialog state (for dryRun rows)
  const [approving, setApproving] = useState<TOpsActionRow | null>(null)
  const [approveReason, setApproveReason] = useState('')

  // Reject dialog state (for dryRun rows)
  const [rejecting, setRejecting] = useState<TOpsActionRow | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const onOverride = async (action: TOpsActionRow, approve: boolean, reason?: string) => {
    if (!orgId) return

    setLoading(true)
    setError(undefined)

    const result = await overrideOpsAction(orgId, action.id, { approve, reason })

    if (result.error)
      setError(
        result.error instanceof Error ? result.error : new Error(String(result.error))
      )

    setLoading(false)
    return result
  }

  const onOpenApprove = (action: TOpsActionRow) => {
    setApproveReason('')
    setApproving(action)
  }

  const onCloseApprove = () => {
    if (loading) return
    setApproving(null)
    setApproveReason('')
  }

  const onConfirmApprove = async () => {
    if (!approving) return
    const result = await onOverride(approving, true, approveReason.trim() || undefined)
    if (result && !result.error) {
      if (selected?.id === approving.id) setSelected(null)
      setApproving(null)
      setApproveReason('')
    }
  }

  const onOpenReject = (action: TOpsActionRow) => {
    setRejectReason('')
    setRejecting(action)
  }

  const onCloseReject = () => {
    if (loading) return
    setRejecting(null)
    setRejectReason('')
  }

  const onConfirmReject = async () => {
    if (!rejecting) return
    const result = await onOverride(rejecting, false, rejectReason.trim() || undefined)
    if (result && !result.error) {
      if (selected?.id === rejecting.id) setSelected(null)
      setRejecting(null)
      setRejectReason('')
    }
  }

  const onRevert = async (action: TOpsActionRow) => {
    const result = await onOverride(action, false)
    if (result && !result.error && selected?.id === action.id) setSelected(null)
  }

  const filteredOpsActions = useMemo(() => {
    if (!searchQuery.trim()) return opsActions

    const q = searchQuery.toLowerCase()
    return opsActions.filter(
      (a) =>
        a.action?.toLowerCase().includes(q) ||
        a.agentId?.toLowerCase().includes(q) ||
        a.id?.toLowerCase().includes(q) ||
        a.status?.toLowerCase().includes(q)
    )
  }, [opsActions, searchQuery])

  const columns: TDataTableColumn<TOpsActionRow>[] = [
    {
      id: 'action',
      label: 'Action',
      width: 120,
      render: (a) => (
        <Chip
          size='small'
          variant='outlined'
          label={a.action}
          color={actionChipColor(a.action as string)}
        />
      ),
    },
    {
      id: 'agentId',
      label: 'Agent',
      render: (a) => (
        <Text
          variant='body2'
          fontFamily='monospace'
          color='text.secondary'
        >
          {a.agentId}
        </Text>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: 80,
      render: (a) => (
        <Chip
          size='small'
          variant='outlined'
          label={a.status}
          color={statusColor[a.status as TOpsActionStatus] || 'default'}
        />
      ),
    },
    {
      id: 'createdAt',
      label: 'Created',
      render: (a) => (
        <Text
          variant='caption'
          color='text.secondary'
        >
          {a.createdAt ? new Date(a.createdAt as string).toLocaleDateString() : '—'}
        </Text>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (a) => {
        const terminal = isTerminal(a.status as TOpsActionStatus)
        const isDryRun =
          a.status === EOpsActionStatus.dryRun || a.status === EOpsActionStatus.proposed
        const isExecuted = a.status === EOpsActionStatus.executed

        if (terminal) return <Box sx={styles.table.actions.box} />

        return (
          <Box sx={styles.table.actions.box}>
            {isDryRun && (
              <>
                <ActionIconButton
                  tooltip={`Approve — ${ASYNC_OVERRIDE_COPY}`}
                  icon={<ApproveIcon sx={styles.table.actions.icon} />}
                  size='small'
                  color='success'
                  disabled={!allowUpdate || loading}
                  disabledTooltip='You do not have permission to approve ops actions'
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenApprove(a)
                  }}
                />
                <ActionIconButton
                  tooltip={`Reject — ${ASYNC_OVERRIDE_COPY}`}
                  icon={<RejectIcon sx={styles.table.actions.icon} />}
                  size='small'
                  color='error'
                  disabled={!allowUpdate || loading}
                  disabledTooltip='You do not have permission to reject ops actions'
                  onClick={(e) => {
                    e.stopPropagation()
                    onOpenReject(a)
                  }}
                />
              </>
            )}
            {isExecuted && (
              <ActionIconButton
                tooltip={`Revert — ${ASYNC_OVERRIDE_COPY}`}
                icon={<RevertIcon sx={styles.table.actions.icon} />}
                size='small'
                color='warning'
                disabled={!allowUpdate || loading}
                disabledTooltip='You do not have permission to revert ops actions'
                onClick={(e) => {
                  e.stopPropagation()
                  onRevert(a)
                }}
              />
            )}
          </Box>
        )
      },
    },
  ]

  return (
    <PageLayout
      loading={loading}
      searchCount={0}
      title='Ops Actions'
      query={searchQuery}
      countLabel='ops action'
      error={error?.message}
      setSearchQuery={setSearchQuery}
      count={isInitialLoading ? undefined : opsActions.length}
      searchPlaceholder='Search ops actions by action, agent, or status...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : undefined)}
    >
      {isInitialLoading && <DataTableSkeleton columns={skeletonColumns} />}

      {!isInitialLoading && !error && opsActions.length === 0 && !loading && (
        <EmptyState message='No ops actions yet. The steward will record ops actions here as it operates.' />
      )}

      {!isInitialLoading &&
        !error &&
        opsActions.length > 0 &&
        filteredOpsActions.length === 0 && (
          <EmptyState message='No ops actions match your search query.' />
        )}

      {!error && filteredOpsActions.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredOpsActions}
          onRowClick={(a) => setSelected(a)}
          getRowKey={(a) => a.id}
        />
      )}

      <OpsActionDrawer
        loading={loading}
        opsAction={selected}
        open={Boolean(selected)}
        canUpdate={allowUpdate}
        onApprove={onOpenApprove}
        onReject={onOpenReject}
        onRevert={onRevert}
        onClose={() => setSelected(null)}
      />

      {/* Approve Dialog */}
      <Dialog
        maxWidth='sm'
        open={Boolean(approving)}
        onClose={onCloseApprove}
        title='Approve Ops Action'
        content={
          <Box sx={styles.dialog}>
            <Text variant='body2'>
              Approve{approving ? ` "${approving.action}"` : ''} for execution. Optionally
              provide a reason.
            </Text>
            <Text
              variant='caption'
              color='text.secondary'
            >
              {ASYNC_OVERRIDE_COPY}
            </Text>
            <TextInput
              fullWidth
              autoFocus
              value={approveReason}
              disabled={loading}
              label='Reason (optional)'
              id='tdsk-opsaction-approve-reason'
              placeholder='Why are you approving this? (optional)'
              onChange={(e) => setApproveReason(e.target.value)}
            />
          </Box>
        }
        actions={
          <>
            <Button
              variant='text'
              disabled={loading}
              onClick={onCloseApprove}
            >
              Cancel
            </Button>
            <Button
              color='success'
              variant='contained'
              disabled={loading}
              onClick={onConfirmApprove}
            >
              Approve
            </Button>
          </>
        }
      />

      {/* Reject Dialog */}
      <Dialog
        maxWidth='sm'
        open={Boolean(rejecting)}
        onClose={onCloseReject}
        title='Reject Ops Action'
        content={
          <Box sx={styles.dialog}>
            <Text variant='body2'>
              Record a reason for rejecting
              {rejecting ? ` "${rejecting.action}"` : ''}.
            </Text>
            <Text
              variant='caption'
              color='text.secondary'
            >
              {ASYNC_OVERRIDE_COPY}
            </Text>
            <TextInput
              fullWidth
              autoFocus
              multiline
              minRows={3}
              value={rejectReason}
              disabled={loading}
              label='Rejection Reason'
              id='tdsk-opsaction-reject-reason'
              placeholder='Enter a reason (required)'
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </Box>
        }
        actions={
          <>
            <Button
              variant='text'
              disabled={loading}
              onClick={onCloseReject}
            >
              Cancel
            </Button>
            <Button
              color='error'
              variant='contained'
              disabled={loading || !rejectReason.trim()}
              onClick={onConfirmReject}
            >
              Reject
            </Button>
          </>
        }
      />
    </PageLayout>
  )
}

export default OpsActions
