import type { TEscalation, TEscalationStatus } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { useState, useMemo } from 'react'
import { EPermResource, EEscalationStatus } from '@tdsk/domain'
import { useEscalations } from '@TAF/state/selectors'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { resolveEscalation } from '@TAF/actions/escalations/api/resolveEscalation'
import { EscalationDrawer } from '@TAF/components/Escalations/EscalationDrawer'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import { Text, Dialog, Button, TextInput, DataTableSkeleton } from '@tdsk/components'
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Warning as EscalationIcon,
} from '@mui/icons-material'

export type TEscalations = {
  orgId?: string
}

const statusColor: Record<
  TEscalationStatus,
  'default' | 'info' | 'warning' | 'success' | 'error'
> = {
  [EEscalationStatus.open]: 'info',
  [EEscalationStatus.routed]: 'warning',
  [EEscalationStatus.resolved]: 'success',
  [EEscalationStatus.rejected]: 'error',
}

const isTerminal = (status: TEscalationStatus) =>
  status === EEscalationStatus.resolved || status === EEscalationStatus.rejected

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
  { id: `target`, label: `Target` },
  { id: `title`, label: `Title` },
  { id: `status`, label: `Status`, width: 50 },
  { id: `createdAt`, label: `Created` },
  { id: `actions`, label: `Actions`, align: `right` as const },
]

export const Escalations = (props: TEscalations) => {
  const { orgId } = props

  const { canUpdate } = usePermissions()
  const allowUpdate = canUpdate(EPermResource.escalation)
  const [escalationsMap] = useEscalations()
  const isInitialLoading = escalationsMap === undefined
  const escalations = useMemo(() => Object.values(escalationsMap || {}), [escalationsMap])

  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error>()
  const [selected, setSelected] = useState<TEscalation | null>(null)

  // Resolve dialog state
  const [resolving, setResolving] = useState<TEscalation | null>(null)
  const [resolvedRef, setResolvedRef] = useState('')

  // Reject dialog state
  const [rejecting, setRejecting] = useState<TEscalation | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const onResolve = async (escalation: TEscalation, ref?: string) => {
    if (!orgId) return

    setLoading(true)
    setError(undefined)

    const result = await resolveEscalation(orgId, escalation.id, {
      status: 'resolved',
      resolvedRef: ref || undefined,
    })

    if (result.error)
      setError(
        result.error instanceof Error ? result.error : new Error(String(result.error))
      )

    setLoading(false)
    return result
  }

  const onReject = async (escalation: TEscalation, reason?: string) => {
    if (!orgId) return

    setLoading(true)
    setError(undefined)

    const result = await resolveEscalation(orgId, escalation.id, {
      status: 'rejected',
      reason,
    })

    if (result.error)
      setError(
        result.error instanceof Error ? result.error : new Error(String(result.error))
      )

    setLoading(false)
    return result
  }

  const onOpenResolve = (escalation: TEscalation) => {
    setResolvedRef('')
    setResolving(escalation)
  }

  const onCloseResolve = () => {
    if (loading) return
    setResolving(null)
    setResolvedRef('')
  }

  const onConfirmResolve = async () => {
    if (!resolving) return
    const result = await onResolve(resolving, resolvedRef.trim() || undefined)
    if (result && !result.error) {
      if (selected?.id === resolving.id) setSelected(null)
      setResolving(null)
      setResolvedRef('')
    }
  }

  const onOpenReject = (escalation: TEscalation) => {
    setRejectReason('')
    setRejecting(escalation)
  }

  const onCloseReject = () => {
    if (loading) return
    setRejecting(null)
    setRejectReason('')
  }

  const onConfirmReject = async () => {
    if (!rejecting) return
    const result = await onReject(rejecting, rejectReason.trim() || undefined)
    if (result && !result.error) {
      if (selected?.id === rejecting.id) setSelected(null)
      setRejecting(null)
      setRejectReason('')
    }
  }

  const filteredEscalations = useMemo(() => {
    if (!searchQuery.trim()) return escalations

    const q = searchQuery.toLowerCase()
    return escalations.filter(
      (esc) =>
        esc.title?.toLowerCase().includes(q) ||
        esc.problem?.toLowerCase().includes(q) ||
        esc.target?.toLowerCase().includes(q) ||
        esc.id?.toLowerCase().includes(q)
    )
  }, [escalations, searchQuery])

  const columns: TDataTableColumn<TEscalation>[] = [
    {
      id: 'target',
      label: 'Target',
      width: 80,
      render: (esc) => (
        <Chip
          size='small'
          variant='outlined'
          label={esc.target}
        />
      ),
    },
    {
      id: 'title',
      label: 'Title',
      render: (esc) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EscalationIcon sx={{ color: 'text.secondary' }} />
          <Text
            variant='body2'
            fontWeight='medium'
          >
            {esc.title}
          </Text>
        </Box>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: 50,
      render: (esc) => (
        <Chip
          size='small'
          variant='outlined'
          label={esc.status}
          color={statusColor[esc.status] || 'default'}
        />
      ),
    },
    {
      id: 'createdAt',
      label: 'Created',
      render: (esc) => (
        <Text
          variant='caption'
          color='text.secondary'
        >
          {esc.createdAt ? new Date(esc.createdAt).toLocaleDateString() : '—'}
        </Text>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (esc) => {
        const terminal = isTerminal(esc.status)
        return (
          <Box sx={styles.table.actions.box}>
            <ActionIconButton
              tooltip='Resolve Escalation'
              icon={<CheckIcon sx={styles.table.actions.icon} />}
              size='small'
              color='success'
              disabled={!allowUpdate || terminal || loading}
              disabledTooltip={
                terminal
                  ? 'This escalation has already been resolved or rejected'
                  : 'You do not have permission to resolve escalations'
              }
              onClick={(e) => {
                e.stopPropagation()
                onOpenResolve(esc)
              }}
            />
            <ActionIconButton
              tooltip='Reject Escalation'
              icon={<CloseIcon sx={styles.table.actions.icon} />}
              size='small'
              color='error'
              disabled={!allowUpdate || terminal || loading}
              disabledTooltip={
                terminal
                  ? 'This escalation has already been resolved or rejected'
                  : 'You do not have permission to reject escalations'
              }
              onClick={(e) => {
                e.stopPropagation()
                onOpenReject(esc)
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
      searchCount={0}
      title='Escalations'
      query={searchQuery}
      countLabel='escalation'
      error={error?.message}
      setSearchQuery={setSearchQuery}
      count={isInitialLoading ? undefined : escalations.length}
      searchPlaceholder='Search escalations by title, target, or problem...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : undefined)}
    >
      {isInitialLoading && <DataTableSkeleton columns={skeletonColumns} />}

      {!isInitialLoading && !error && escalations.length === 0 && !loading && (
        <EmptyState message='No escalations yet. The steward will surface needs it cannot yet act on here.' />
      )}

      {!isInitialLoading &&
        !error &&
        escalations.length > 0 &&
        filteredEscalations.length === 0 && (
          <EmptyState message='No escalations match your search query.' />
        )}

      {!error && filteredEscalations.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredEscalations}
          onRowClick={(esc) => setSelected(esc)}
          getRowKey={(esc) => esc.id}
        />
      )}

      <EscalationDrawer
        loading={loading}
        escalation={selected}
        open={Boolean(selected)}
        canUpdate={allowUpdate}
        onResolve={onOpenResolve}
        onReject={onOpenReject}
        onClose={() => setSelected(null)}
      />

      {/* Resolve Dialog */}
      <Dialog
        maxWidth='sm'
        open={Boolean(resolving)}
        onClose={onCloseResolve}
        title='Resolve Escalation'
        content={
          <Box sx={styles.dialog}>
            <Text variant='body2'>
              Mark{resolving ? ` "${resolving.title}"` : ''} as resolved. Optionally paste
              the fix PR URL as the resolved reference.
            </Text>
            <Text
              variant='caption'
              color='text.secondary'
            >
              This is an async override; it does not block the agent.
            </Text>
            <TextInput
              fullWidth
              autoFocus
              value={resolvedRef}
              disabled={loading}
              label='Resolved Ref (PR URL)'
              id='tdsk-escalation-resolved-ref'
              placeholder='https://github.com/... (optional)'
              onChange={(e) => setResolvedRef(e.target.value)}
            />
          </Box>
        }
        actions={
          <>
            <Button
              variant='text'
              disabled={loading}
              onClick={onCloseResolve}
            >
              Cancel
            </Button>
            <Button
              color='success'
              variant='contained'
              disabled={loading}
              onClick={onConfirmResolve}
            >
              Resolve
            </Button>
          </>
        }
      />

      {/* Reject Dialog */}
      <Dialog
        maxWidth='sm'
        open={Boolean(rejecting)}
        onClose={onCloseReject}
        title='Reject Escalation'
        content={
          <Box sx={styles.dialog}>
            <Text variant='body2'>
              Record a reason for rejecting
              {rejecting ? ` "${rejecting.title}"` : ''}.
            </Text>
            <Text
              variant='caption'
              color='text.secondary'
            >
              This is an async override; it does not block the agent.
            </Text>
            <TextInput
              fullWidth
              autoFocus
              multiline
              minRows={3}
              value={rejectReason}
              disabled={loading}
              label='Rejection Reason'
              id='tdsk-escalation-reject-reason'
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

export default Escalations
