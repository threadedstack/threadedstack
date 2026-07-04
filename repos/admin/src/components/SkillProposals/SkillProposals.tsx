import type { TSkillProposal, TSkillProposalStatus } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { useState, useMemo } from 'react'
import { EPermResource, ESkillProposalStatus } from '@tdsk/domain'
import { useSkillProposals } from '@TAF/state/selectors'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { reviewSkillProposal } from '@TAF/actions/skillProposals/api/reviewSkillProposal'
import { SkillProposalDrawer } from '@TAF/components/SkillProposals/SkillProposalDrawer'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import { Text, Dialog, Button, TextInput, DataTableSkeleton } from '@tdsk/components'
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Extension as ExtensionIcon,
} from '@mui/icons-material'

export type TSkillProposals = {
  orgId?: string
}

const statusColor: Record<
  TSkillProposalStatus,
  'default' | 'info' | 'success' | 'error'
> = {
  [ESkillProposalStatus.pending]: 'default',
  [ESkillProposalStatus.scanned]: 'info',
  [ESkillProposalStatus.promoted]: 'success',
  [ESkillProposalStatus.rejected]: 'error',
}

const isTerminal = (status: TSkillProposalStatus) =>
  status === ESkillProposalStatus.promoted || status === ESkillProposalStatus.rejected

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
  { id: `name`, label: `Name` },
  { id: `agentId`, label: `Agent` },
  { id: `status`, label: `Status`, width: 50 },
  { id: `scan`, label: `Scan`, width: 50 },
  { id: `actions`, label: `Actions`, align: `right` as const },
]

export const SkillProposals = (props: TSkillProposals) => {
  const { orgId } = props

  const { canUpdate } = usePermissions()
  const allowUpdate = canUpdate(EPermResource.skillProposal)
  const [proposalsMap] = useSkillProposals()
  const isInitialLoading = proposalsMap === undefined
  const proposals = useMemo(() => Object.values(proposalsMap || {}), [proposalsMap])

  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error>()
  const [selected, setSelected] = useState<TSkillProposal | null>(null)
  const [rejecting, setRejecting] = useState<TSkillProposal | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const onReview = async (
    proposal: TSkillProposal,
    approve: boolean,
    reason?: string
  ) => {
    if (!orgId) return

    setLoading(true)
    setError(undefined)

    const result = await reviewSkillProposal(orgId, proposal.id, { approve, reason })

    if (result.error)
      setError(
        result.error instanceof Error ? result.error : new Error(String(result.error))
      )

    setLoading(false)
    return result
  }

  const onApprove = async (proposal: TSkillProposal) => {
    const result = await onReview(proposal, true)
    if (result && !result.error && selected?.id === proposal.id) setSelected(null)
  }

  const onOpenReject = (proposal: TSkillProposal) => {
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
    const result = await onReview(rejecting, false, rejectReason.trim() || undefined)
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
        proposal.name?.toLowerCase().includes(query) ||
        proposal.description?.toLowerCase().includes(query) ||
        proposal.agentId?.toLowerCase().includes(query) ||
        proposal.id?.toLowerCase().includes(query)
    )
  }, [proposals, searchQuery])

  const columns: TDataTableColumn<TSkillProposal>[] = [
    {
      id: 'name',
      label: 'Name',
      render: (proposal) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ExtensionIcon sx={{ color: 'text.secondary' }} />
          <Text
            variant='body2'
            fontWeight='medium'
          >
            {proposal.name}
          </Text>
        </Box>
      ),
    },
    {
      id: 'agentId',
      label: 'Agent',
      render: (proposal) => (
        <Text
          display='block'
          overflow='hidden'
          variant='caption'
          whiteSpace='nowrap'
          textOverflow='ellipsis'
          color='text.secondary'
        >
          {proposal.agentId}
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
      id: 'scan',
      label: 'Scan',
      width: 120,
      render: (proposal) => {
        if (!proposal.scanResult)
          return (
            <Chip
              size='small'
              color='default'
              variant='outlined'
              label='Not scanned'
            />
          )

        const findingCount = proposal.scanResult.findings?.length || 0
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              size='small'
              variant='outlined'
              label={proposal.scanResult.passed ? 'Passed' : 'Failed'}
              color={proposal.scanResult.passed ? 'success' : 'error'}
            />
            {findingCount > 0 && (
              <Text
                variant='caption'
                color='text.secondary'
              >
                {findingCount} finding{findingCount === 1 ? '' : 's'}
              </Text>
            )}
          </Box>
        )
      },
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
              tooltip='Approve Proposal'
              icon={<CheckIcon sx={styles.table.actions.icon} />}
              size='small'
              color='success'
              disabled={!allowUpdate || terminal || loading}
              disabledTooltip={
                terminal
                  ? 'This proposal has already been resolved'
                  : 'You do not have permission to review skill proposals'
              }
              onClick={(e) => {
                e.stopPropagation()
                onApprove(proposal)
              }}
            />
            <ActionIconButton
              tooltip='Reject Proposal'
              icon={<CloseIcon sx={styles.table.actions.icon} />}
              size='small'
              color='error'
              disabled={!allowUpdate || terminal || loading}
              disabledTooltip={
                terminal
                  ? 'This proposal has already been resolved'
                  : 'You do not have permission to review skill proposals'
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
      title='Skill Proposals'
      query={searchQuery}
      countLabel='proposal'
      error={error?.message}
      setSearchQuery={setSearchQuery}
      count={isInitialLoading ? undefined : proposals.length}
      searchPlaceholder='Search proposals by name, agent, or description...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : undefined)}
    >
      {isInitialLoading && <DataTableSkeleton columns={skeletonColumns} />}

      {!isInitialLoading && !error && proposals.length === 0 && !loading && (
        <EmptyState message='No skill proposals yet. Agents will surface self-authored skills here for review.' />
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

      <SkillProposalDrawer
        loading={loading}
        proposal={selected}
        open={Boolean(selected)}
        canUpdate={allowUpdate}
        onApprove={onApprove}
        onReject={onOpenReject}
        onClose={() => setSelected(null)}
      />

      <Dialog
        maxWidth='sm'
        open={Boolean(rejecting)}
        onClose={onCloseReject}
        title='Reject Skill Proposal'
        content={
          <Box sx={styles.dialog}>
            <Text variant='body2'>
              Optionally record a reason for rejecting
              {rejecting ? ` "${rejecting.name}"` : ''}.
            </Text>
            <TextInput
              fullWidth
              autoFocus
              multiline
              minRows={3}
              value={rejectReason}
              disabled={loading}
              label='Rejection Reason'
              id='tdsk-skill-proposal-reject-reason'
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

export default SkillProposals
