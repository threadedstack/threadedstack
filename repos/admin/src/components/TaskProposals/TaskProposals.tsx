import type { TTaskProposal, TTaskProposalStatus } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { useState, useMemo } from 'react'
import { EPermResource, ETaskProposalStatus } from '@tdsk/domain'
import { useTaskProposals } from '@TAF/state/selectors'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { reviewTaskProposal } from '@TAF/actions/taskProposals/api/reviewTaskProposal'
import { TaskProposalDrawer } from '@TAF/components/TaskProposals/TaskProposalDrawer'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import { Text, Dialog, Button, TextInput, DataTableSkeleton } from '@tdsk/components'
import { Close as CloseIcon, Assignment as AssignmentIcon } from '@mui/icons-material'

export type TTaskProposals = {
  orgId?: string
}

const statusColor: Record<TTaskProposalStatus, 'default' | 'info' | 'success' | 'error'> =
  {
    [ETaskProposalStatus.pending]: 'default',
    [ETaskProposalStatus.scanned]: 'info',
    [ETaskProposalStatus.promoted]: 'success',
    [ETaskProposalStatus.rejected]: 'error',
  }

const isTerminal = (status: TTaskProposalStatus) =>
  status === ETaskProposalStatus.promoted || status === ETaskProposalStatus.rejected

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
  { id: `priority`, label: `Priority` },
  { id: `title`, label: `Title` },
  { id: `sourceSignal`, label: `Source` },
  { id: `status`, label: `Status`, width: 50 },
  { id: `createdAt`, label: `Created` },
  { id: `actions`, label: `Actions`, align: `right` as const },
]

export const TaskProposals = (props: TTaskProposals) => {
  const { orgId } = props

  const { canUpdate } = usePermissions()
  const allowUpdate = canUpdate(EPermResource.taskProposal)
  const [proposalsMap] = useTaskProposals()
  const isInitialLoading = proposalsMap === undefined
  const proposals = useMemo(() => Object.values(proposalsMap || {}), [proposalsMap])

  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error>()
  const [selected, setSelected] = useState<TTaskProposal | null>(null)
  const [rejecting, setRejecting] = useState<TTaskProposal | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const onReject = async (proposal: TTaskProposal, reason?: string) => {
    if (!orgId) return

    setLoading(true)
    setError(undefined)

    const result = await reviewTaskProposal(orgId, proposal.id, {
      approve: false,
      reason,
    })

    if (result.error)
      setError(
        result.error instanceof Error ? result.error : new Error(String(result.error))
      )

    setLoading(false)
    return result
  }

  const onOpenReject = (proposal: TTaskProposal) => {
    setRejectReason('')
    setRejecting(proposal)
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

  const filteredProposals = useMemo(() => {
    if (!searchQuery.trim()) return proposals

    const query = searchQuery.toLowerCase()
    return proposals.filter(
      (proposal) =>
        proposal.title?.toLowerCase().includes(query) ||
        proposal.description?.toLowerCase().includes(query) ||
        proposal.sourceSignal?.toLowerCase().includes(query) ||
        proposal.id?.toLowerCase().includes(query)
    )
  }, [proposals, searchQuery])

  const columns: TDataTableColumn<TTaskProposal>[] = [
    {
      id: 'priority',
      label: 'Priority',
      width: 80,
      render: (proposal) => (
        <Chip
          size='small'
          variant='outlined'
          label={proposal.priority}
        />
      ),
    },
    {
      id: 'title',
      label: 'Title',
      render: (proposal) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssignmentIcon sx={{ color: 'text.secondary' }} />
          <Text
            variant='body2'
            fontWeight='medium'
          >
            {proposal.title}
          </Text>
        </Box>
      ),
    },
    {
      id: 'sourceSignal',
      label: 'Source',
      render: (proposal) => (
        <Text
          display='block'
          overflow='hidden'
          variant='caption'
          whiteSpace='nowrap'
          textOverflow='ellipsis'
          color='text.secondary'
        >
          {proposal.sourceSignal}
        </Text>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: 50,
      render: (proposal) => (
        <Chip
          size='small'
          variant='outlined'
          label={proposal.status}
          color={statusColor[proposal.status] || 'default'}
        />
      ),
    },
    {
      id: 'createdAt',
      label: 'Created',
      render: (proposal) => (
        <Text
          variant='caption'
          color='text.secondary'
        >
          {proposal.createdAt ? new Date(proposal.createdAt).toLocaleDateString() : '—'}
        </Text>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (proposal) => {
        const terminal = isTerminal(proposal.status)
        return (
          <Box sx={styles.table.actions.box}>
            <ActionIconButton
              tooltip='Reject Proposal'
              icon={<CloseIcon sx={styles.table.actions.icon} />}
              size='small'
              color='error'
              disabled={!allowUpdate || terminal || loading}
              disabledTooltip={
                terminal
                  ? 'This proposal has already been resolved'
                  : 'You do not have permission to review task proposals'
              }
              onClick={(e) => {
                e.stopPropagation()
                onOpenReject(proposal)
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
      title='Task Proposals'
      query={searchQuery}
      countLabel='proposal'
      error={error?.message}
      setSearchQuery={setSearchQuery}
      count={isInitialLoading ? undefined : proposals.length}
      searchPlaceholder='Search proposals by title, source, or description...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : undefined)}
    >
      {isInitialLoading && <DataTableSkeleton columns={skeletonColumns} />}

      {!isInitialLoading && !error && proposals.length === 0 && !loading && (
        <EmptyState message='No task proposals yet. The steward will surface self-sensed tasks here for review.' />
      )}

      {!isInitialLoading &&
        !error &&
        proposals.length > 0 &&
        filteredProposals.length === 0 && (
          <EmptyState message='No proposals match your search query.' />
        )}

      {!error && filteredProposals.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredProposals}
          onRowClick={(proposal) => setSelected(proposal)}
          getRowKey={(proposal) => proposal.id}
        />
      )}

      <TaskProposalDrawer
        loading={loading}
        proposal={selected}
        open={Boolean(selected)}
        canUpdate={allowUpdate}
        onReject={onOpenReject}
        onClose={() => setSelected(null)}
      />

      <Dialog
        maxWidth='sm'
        open={Boolean(rejecting)}
        onClose={onCloseReject}
        title='Reject Task Proposal'
        content={
          <Box sx={styles.dialog}>
            <Text variant='body2'>
              Optionally record a reason for rejecting
              {rejecting ? ` "${rejecting.title}"` : ''}.
            </Text>
            <Text
              variant='caption'
              color='text.secondary'
            >
              Rejecting only filters this from the steward's backlog; it never blocks work
              in flight.
            </Text>
            <TextInput
              fullWidth
              autoFocus
              multiline
              minRows={3}
              value={rejectReason}
              disabled={loading}
              label='Rejection Reason'
              id='tdsk-task-proposal-reject-reason'
              placeholder='Enter a reason (optional)'
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
              disabled={loading}
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

export default TaskProposals
