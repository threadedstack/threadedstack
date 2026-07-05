import type { TOpsActionRow } from '@tdsk/domain'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { Text, Drawer, Button } from '@tdsk/components'
import { EOpsActionStatus, EOpsAction } from '@tdsk/domain'
import {
  Check as ApproveIcon,
  Close as RejectIcon,
  Undo as RevertIcon,
} from '@mui/icons-material'

const ASYNC_OVERRIDE_COPY = `Async override — the adversary cycle is the default gate; this is a human safety net.`

export type TOpsActionDrawer = {
  open: boolean
  loading?: boolean
  canUpdate?: boolean
  onClose: () => void
  opsAction?: TOpsActionRow | null
  onApprove?: (action: TOpsActionRow) => void
  onReject?: (action: TOpsActionRow) => void
  onRevert?: (action: TOpsActionRow) => void
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

export const OpsActionDrawer = ({
  open,
  loading,
  canUpdate,
  opsAction,
  onClose,
  onApprove,
  onReject,
  onRevert,
}: TOpsActionDrawer) => {
  if (!opsAction) {
    return (
      <Drawer
        open={open}
        onClose={onClose}
        title='Ops Action'
      />
    )
  }

  const terminal = isTerminal(opsAction.status as TOpsActionStatus)
  const isDryRun =
    opsAction.status === EOpsActionStatus.dryRun ||
    opsAction.status === EOpsActionStatus.proposed
  const isExecuted = opsAction.status === EOpsActionStatus.executed
  const actionsDisabled = !canUpdate || loading

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={opsAction.action as string}
      actions={
        !terminal ? (
          <Box sx={styles.actions}>
            {isDryRun && (
              <>
                <Button
                  color='error'
                  variant='outlined'
                  Icon={RejectIcon}
                  disabled={actionsDisabled}
                  onClick={() => onReject?.(opsAction)}
                >
                  Reject
                </Button>
                <Button
                  color='success'
                  variant='outlined'
                  Icon={ApproveIcon}
                  disabled={actionsDisabled}
                  onClick={() => onApprove?.(opsAction)}
                >
                  Approve
                </Button>
              </>
            )}
            {isExecuted && (
              <Button
                color='warning'
                variant='outlined'
                Icon={RevertIcon}
                disabled={actionsDisabled}
                onClick={() => onRevert?.(opsAction)}
              >
                Revert
              </Button>
            )}
          </Box>
        ) : undefined
      }
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <Section label='Ops Pipeline'>
          <Text
            variant='caption'
            color='text.secondary'
          >
            Ops actions run through: scanner → dry-run + rollback captured → adversary
            review → execute. This admin surface is an OPTIONAL async override; never on
            the critical path.
          </Text>
        </Section>

        <Section label='Action'>
          <Box>
            <Chip
              size='small'
              variant='outlined'
              label={opsAction.action as string}
            />
          </Box>
        </Section>

        <Section label='Status'>
          <Box>
            <Chip
              size='small'
              variant='outlined'
              label={opsAction.status}
              color={statusColor[opsAction.status as TOpsActionStatus] || 'default'}
            />
          </Box>
        </Section>

        {opsAction.params && (
          <Section label='Params'>
            <Box
              component='pre'
              sx={styles.code}
            >
              {JSON.stringify(opsAction.params, null, 2)}
            </Box>
          </Section>
        )}

        {opsAction.scanResult && (
          <Section label='Scan Result'>
            <Text
              variant='body2'
              color={opsAction.scanResult.passed ? 'success.main' : 'error.main'}
            >
              {opsAction.scanResult.passed ? 'Passed' : 'Failed'}
            </Text>
            {opsAction.scanResult.findings &&
              opsAction.scanResult.findings.length > 0 && (
                <Box sx={{ mt: 0.5 }}>
                  {opsAction.scanResult.findings.map((finding: string, idx: number) => (
                    <Text
                      key={`${idx}-${finding.slice(0, 20)}`}
                      variant='caption'
                      color='error'
                      sx={{ display: 'block' }}
                    >
                      {finding}
                    </Text>
                  ))}
                </Box>
              )}
          </Section>
        )}

        {opsAction.dryRunResult && (
          <Section label='Dry Run Result (Plan)'>
            <Box
              component='pre'
              sx={styles.code}
            >
              {JSON.stringify(opsAction.dryRunResult, null, 2)}
            </Box>
          </Section>
        )}

        {opsAction.result && (
          <Section label='Execution Result'>
            <Box
              component='pre'
              sx={styles.code}
            >
              {JSON.stringify(opsAction.result, null, 2)}
            </Box>
          </Section>
        )}

        {opsAction.rollback && (
          <Section label='Rollback Data'>
            <Box
              component='pre'
              sx={styles.code}
            >
              {JSON.stringify(opsAction.rollback, null, 2)}
            </Box>
          </Section>
        )}

        {opsAction.reviewVerdict && (
          <Section label='Review Verdict'>
            <Text variant='body2'>
              {opsAction.reviewVerdict.approved ? 'Approved' : 'Rejected'}
              {opsAction.reviewVerdict.reason
                ? ` — ${opsAction.reviewVerdict.reason}`
                : ''}
              {opsAction.reviewVerdict.by ? ` (by ${opsAction.reviewVerdict.by})` : ''}
            </Text>
          </Section>
        )}

        {opsAction.reason && (
          <Section label='Reason'>
            <Text variant='body2'>{opsAction.reason}</Text>
          </Section>
        )}

        <Section label='Agent'>
          <Text
            variant='body2'
            fontFamily='monospace'
          >
            {opsAction.agentId}
          </Text>
        </Section>

        <Section label='Created'>
          <Text
            variant='body2'
            color='text.secondary'
          >
            {opsAction.createdAt
              ? new Date(opsAction.createdAt as string).toLocaleString()
              : '—'}
          </Text>
        </Section>

        <Section label='Async Override'>
          <Text
            variant='caption'
            color='text.secondary'
          >
            {ASYNC_OVERRIDE_COPY}
          </Text>
        </Section>
      </Box>
    </Drawer>
  )
}

export default OpsActionDrawer
