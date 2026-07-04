import type { TSkillProposal, TSkillProposalStatus } from '@tdsk/domain'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { Text, Drawer, Button } from '@tdsk/components'
import { ESkillProposalStatus } from '@tdsk/domain'
import { Check as CheckIcon, Close as CloseIcon } from '@mui/icons-material'

export type TSkillProposalDrawer = {
  open: boolean
  loading?: boolean
  canUpdate?: boolean
  onClose: () => void
  proposal?: TSkillProposal | null
  onApprove?: (proposal: TSkillProposal) => void
  onReject?: (proposal: TSkillProposal) => void
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
  section: { display: 'flex', flexDirection: 'column', gap: 0.5 },
  label: { color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 },
  instructions: {
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

export const SkillProposalDrawer = ({
  open,
  loading,
  canUpdate,
  proposal,
  onClose,
  onApprove,
  onReject,
}: TSkillProposalDrawer) => {
  if (!proposal) {
    return (
      <Drawer
        open={open}
        onClose={onClose}
        title='Skill Proposal'
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
      title={proposal.name}
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
          <Button
            color='success'
            variant='contained'
            Icon={CheckIcon}
            disabled={actionsDisabled}
            onClick={() => onApprove?.(proposal)}
          >
            Approve
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

        <Section label='Authoring Agent'>
          <Text variant='body2'>{proposal.agentId}</Text>
        </Section>

        {proposal.description && (
          <Section label='Description'>
            <Text variant='body2'>{proposal.description}</Text>
          </Section>
        )}

        <Section label='Instructions'>
          <Box sx={styles.instructions}>
            <Text
              variant='caption'
              component='code'
            >
              {proposal.instructions}
            </Text>
          </Box>
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

        {proposal.auditVerdict && (
          <Section label='Auditor Verdict'>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box>
                <Chip
                  size='small'
                  variant='outlined'
                  label={proposal.auditVerdict.approved ? 'Approved' : 'Rejected'}
                  color={proposal.auditVerdict.approved ? 'success' : 'error'}
                />
              </Box>
              {proposal.auditVerdict.reason && (
                <Text variant='body2'>{proposal.auditVerdict.reason}</Text>
              )}
              {proposal.auditVerdict.by && (
                <Text
                  variant='caption'
                  color='text.secondary'
                >
                  By: {proposal.auditVerdict.by}
                </Text>
              )}
            </Box>
          </Section>
        )}

        {proposal.reason && (
          <Section label='Reason'>
            <Text variant='body2'>{proposal.reason}</Text>
          </Section>
        )}
      </Box>
    </Drawer>
  )
}

export default SkillProposalDrawer
