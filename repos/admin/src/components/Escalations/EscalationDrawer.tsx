import type { TEscalation, TEscalationStatus } from '@tdsk/domain'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { Text, Drawer, Button } from '@tdsk/components'
import { EEscalationStatus } from '@tdsk/domain'
import { Check as CheckIcon, Close as CloseIcon } from '@mui/icons-material'

export type TEscalationDrawer = {
  open: boolean
  loading?: boolean
  canUpdate?: boolean
  onClose: () => void
  escalation?: TEscalation | null
  onResolve?: (escalation: TEscalation) => void
  onReject?: (escalation: TEscalation) => void
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
  section: { display: 'flex', flexDirection: 'column', gap: 0.5 },
  label: { color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 },
  code: {
    p: 1.5,
    borderRadius: 1,
    overflowX: 'auto',
    whiteSpace: 'pre-wrap',
    fontFamily: 'monospace',
    fontSize: '0.75rem',
    bgcolor: 'background.default',
    border: (theme: any) => `1px solid ${theme.palette.divider}`,
  },
  evidenceItem: {
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

export const EscalationDrawer = ({
  open,
  loading,
  canUpdate,
  escalation,
  onClose,
  onResolve,
  onReject,
}: TEscalationDrawer) => {
  if (!escalation) {
    return (
      <Drawer
        open={open}
        onClose={onClose}
        title='Escalation'
      />
    )
  }

  const terminal = isTerminal(escalation.status)
  const actionsDisabled = !canUpdate || terminal || loading

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={escalation.title}
      actions={
        <Box sx={styles.actions}>
          <Button
            color='error'
            variant='outlined'
            Icon={CloseIcon}
            disabled={actionsDisabled}
            onClick={() => onReject?.(escalation)}
          >
            Reject
          </Button>
          <Button
            color='success'
            variant='outlined'
            Icon={CheckIcon}
            disabled={actionsDisabled}
            onClick={() => onResolve?.(escalation)}
          >
            Resolve
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
              label={escalation.status}
              color={statusColor[escalation.status] || 'default'}
            />
          </Box>
        </Section>

        <Section label='Target'>
          <Box>
            <Chip
              size='small'
              variant='outlined'
              label={escalation.target}
            />
          </Box>
        </Section>

        <Section label='Problem'>
          <Text variant='body2'>{escalation.problem}</Text>
        </Section>

        {escalation.evidence && escalation.evidence.length > 0 && (
          <Section label='Evidence'>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {escalation.evidence.map((citation, idx) => (
                <Box
                  key={`${idx}-${citation.slice(0, 20)}`}
                  sx={styles.evidenceItem}
                >
                  <Text variant='caption'>{citation}</Text>
                </Box>
              ))}
            </Box>
          </Section>
        )}

        {escalation.proposedPatch ? (
          <Section label='Proposed Patch'>
            <Box
              component='pre'
              sx={styles.code}
            >
              {escalation.proposedPatch}
            </Box>
          </Section>
        ) : (
          <Section label='Proposed Patch'>
            <Text
              variant='body2'
              color='text.secondary'
            >
              none
            </Text>
          </Section>
        )}

        {escalation.issueRef && (
          <Section label='Issue'>
            <Text variant='body2'>
              <a
                href={escalation.issueRef}
                target='_blank'
                rel='noopener noreferrer'
              >
                {escalation.issueRef}
              </a>
            </Text>
          </Section>
        )}

        {escalation.resolvedRef && (
          <Section label='Resolved Ref'>
            <Text variant='body2'>
              <a
                href={escalation.resolvedRef}
                target='_blank'
                rel='noopener noreferrer'
              >
                {escalation.resolvedRef}
              </a>
            </Text>
          </Section>
        )}

        {escalation.reason && (
          <Section label='Reason'>
            <Text variant='body2'>{escalation.reason}</Text>
          </Section>
        )}

        <Section label='Agent'>
          <Text
            variant='body2'
            fontFamily='monospace'
          >
            {escalation.agentId}
          </Text>
        </Section>

        <Section label='Created'>
          <Text
            variant='body2'
            color='text.secondary'
          >
            {escalation.createdAt ? new Date(escalation.createdAt).toLocaleString() : '—'}
          </Text>
        </Section>

        <Section label='Async Override'>
          <Text
            variant='caption'
            color='text.secondary'
          >
            This is an async override; it does not block the agent.
          </Text>
        </Section>
      </Box>
    </Drawer>
  )
}

export default EscalationDrawer
