import type { TTaskProposal, TTaskProposalStatus } from '@tdsk/domain'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { Text, Drawer, Button } from '@tdsk/components'
import { ETaskProposalStatus } from '@tdsk/domain'
import { Close as CloseIcon } from '@mui/icons-material'

export type TTaskProposalDrawer = {
  open: boolean
  loading?: boolean
  canUpdate?: boolean
  onClose: () => void
  proposal?: TTaskProposal | null
  onReject?: (proposal: TTaskProposal) => void
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
  section: { display: 'flex', flexDirection: 'column', gap: 0.5 },
  label: { color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 },
  evidence: {
    p: 1.5,
    borderRadius: 1,
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    fontFamily: 'monospace',
    bgcolor: 'background.default',
    border: (theme: any) => `1px solid ${theme.palette.divider}`,
  },
  finding: {
    p: 1,
    borderRadius: 1,
    bgcolor: 'background.default',
    border: (theme: any) => `1px solid ${theme.palette.divider}`,
  },
  actions: {
    gap: 1.5,
    p: 2,
    display: 'flex',
    justifyContent: 'flex-end',
    borderTop: (theme: any) => `1px solid ${theme.palette.divider}`,
  },
}

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <Box sx={styles.section}>
    <Text
      variant='caption'
      sx={styles.label}
    >
      {label}
    </Text>
    {children}
  </Box>
)

export const TaskProposalDrawer = ({
  open,
  loading,
  canUpdate,
  proposal,
  onClose,
  onReject,
}: TTaskProposalDrawer) => {
  if (!proposal) {
    return (
      <Drawer
        open={open}
        onClose={onClose}
        title='Task Proposal'
      />
    )
  }

  const terminal = isTerminal(proposal.status)
  const actionsDisabled = !canUpdate || terminal || loading
  const findings = proposal.scanResult?.findings || []

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={proposal.title}
      actions={
        <Box sx={styles.actions}>
          <Button
            color='error'
            variant='outlined'
            Icon={CloseIcon}
            disabled={actionsDisabled}
            onClick={() => onReject?.(proposal)}
          >
            Reject
          </Button>
        </Box>
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Section label='Status'>
          <Box>
            <Chip
              size='small'
              variant='outlined'
              label={proposal.status}
              color={statusColor[proposal.status] || 'default'}
            />
          </Box>
        </Section>

        <Section label='Priority'>
          <Box>
            <Chip
              size='small'
              variant='outlined'
              label={proposal.priority}
            />
          </Box>
        </Section>

        <Section label='Source Signal'>
          <Text variant='body2'>{proposal.sourceSignal}</Text>
        </Section>

        {proposal.description && (
          <Section label='Description'>
            <Text variant='body2'>{proposal.description}</Text>
          </Section>
        )}

        <Section label='Evidence'>
          <Box sx={styles.evidence}>
            <Text
              variant='caption'
              component='code'
            >
              {proposal.evidence}
            </Text>
          </Box>
        </Section>

        <Section label='Dedupe Key'>
          <Text
            variant='body2'
            fontFamily='monospace'
          >
            {proposal.dedupeKey}
          </Text>
        </Section>

        <Section label='Security Scan'>
          {proposal.scanResult ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box>
                <Chip
                  size='small'
                  variant='outlined'
                  label={proposal.scanResult.passed ? 'Passed' : 'Failed'}
                  color={proposal.scanResult.passed ? 'success' : 'error'}
                />
              </Box>
              {findings.length > 0 &&
                findings.map((finding, idx) => (
                  <Box
                    key={`${idx}-${finding}`}
                    sx={styles.finding}
                  >
                    <Text variant='caption'>{finding}</Text>
                  </Box>
                ))}
            </Box>
          ) : (
            <Text
              variant='body2'
              color='text.secondary'
            >
              Not scanned yet.
            </Text>
          )}
        </Section>

        {proposal.prUrl && (
          <Section label='Pull Request'>
            <Text variant='body2'>
              <a
                href={proposal.prUrl}
                target='_blank'
                rel='noopener'
              >
                {proposal.prUrl}
              </a>
            </Text>
          </Section>
        )}

        <Section label='Reject'>
          <Text
            variant='caption'
            color='text.secondary'
          >
            Rejecting only filters this from the steward's backlog; it never blocks work
            in flight.
          </Text>
        </Section>
      </Box>
    </Drawer>
  )
}

export default TaskProposalDrawer
