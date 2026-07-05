import type { TVerification, TVerificationStatus } from '@tdsk/domain'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { Text, Drawer } from '@tdsk/components'
import { EVerificationStatus } from '@tdsk/domain'

export type TVerificationDrawer = {
  open: boolean
  orgId?: string
  onClose: () => void
  verification?: TVerification | null
}

const statusColor: Record<
  TVerificationStatus,
  'default' | 'info' | 'warning' | 'success' | 'error'
> = {
  [EVerificationStatus.pending]: 'info',
  [EVerificationStatus.verifying]: 'warning',
  [EVerificationStatus.verified]: 'success',
  [EVerificationStatus.regressed]: 'error',
}

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
  notice: {
    p: 1.5,
    borderRadius: 1,
    bgcolor: 'background.default',
    border: (theme: any) => `1px solid ${theme.palette.divider}`,
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

export const VerificationDrawer = ({
  open,
  orgId,
  verification,
  onClose,
}: TVerificationDrawer) => {
  if (!verification) {
    return (
      <Drawer
        open={open}
        onClose={onClose}
        title='Verification'
      />
    )
  }

  const escalationHref =
    orgId && verification.escalationId
      ? `/orgs/${orgId}/escalations/${verification.escalationId}`
      : null

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`PR #${verification.prNumber}`}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Section label='PR Number'>
          <Text variant='body2'>
            {verification.prUrl ? (
              <a
                href={verification.prUrl}
                target='_blank'
                rel='noopener noreferrer'
              >
                #{verification.prNumber}
              </a>
            ) : (
              `#${verification.prNumber}`
            )}
          </Text>
        </Section>

        <Section label='Probe'>
          <Box
            component='pre'
            sx={styles.code}
          >
            {JSON.stringify(verification.probe, null, 2)}
          </Box>
        </Section>

        <Section label='Status'>
          <Box>
            <Chip
              size='small'
              variant='outlined'
              label={verification.status}
              color={statusColor[verification.status] || 'default'}
            />
          </Box>
        </Section>

        {verification.detail && (
          <Section label='Detail'>
            <Text variant='body2'>{verification.detail}</Text>
          </Section>
        )}

        <Section label='Revert PR'>
          {verification.revertPrUrl ? (
            <Text variant='body2'>
              <a
                href={verification.revertPrUrl}
                target='_blank'
                rel='noopener noreferrer'
              >
                {verification.revertPrUrl}
              </a>
            </Text>
          ) : (
            <Text
              variant='body2'
              color='text.secondary'
            >
              —
            </Text>
          )}
        </Section>

        {verification.escalationId && (
          <Section label='Escalation'>
            <Text variant='body2'>
              {escalationHref ? (
                <a href={escalationHref}>{verification.escalationId}</a>
              ) : (
                verification.escalationId
              )}
            </Text>
          </Section>
        )}

        {verification.mergeSha && (
          <Section label='Merge SHA'>
            <Text
              variant='body2'
              fontFamily='monospace'
            >
              {verification.mergeSha.slice(0, 12)}
            </Text>
          </Section>
        )}

        <Section label='Agent'>
          <Text
            variant='body2'
            fontFamily='monospace'
          >
            {verification.agentId}
          </Text>
        </Section>

        <Section label='Created'>
          <Text
            variant='body2'
            color='text.secondary'
          >
            {verification.createdAt
              ? new Date(verification.createdAt).toLocaleString()
              : '—'}
          </Text>
        </Section>

        <Box sx={styles.notice}>
          <Text
            variant='caption'
            color='text.secondary'
          >
            Verifications are read-only observability. Post-deploy remediation (revert PR
            + escalation) is fully automatic.
          </Text>
        </Box>
      </Box>
    </Drawer>
  )
}

export default VerificationDrawer
