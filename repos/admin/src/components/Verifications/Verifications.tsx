import type { TVerification, TVerificationStatus } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'
import { useState, useMemo } from 'react'
import { EVerificationStatus } from '@tdsk/domain'
import { useVerifications } from '@TAF/state/selectors'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { VerificationDrawer } from '@TAF/components/Verifications/VerificationDrawer'
import { Text, DataTableSkeleton } from '@tdsk/components'

export type TVerifications = {
  orgId?: string
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

const skeletonColumns = [
  { id: `prNumber`, label: `PR` },
  { id: `kind`, label: `Probe Kind` },
  { id: `status`, label: `Status`, width: 50 },
  { id: `revertPrUrl`, label: `Revert PR` },
  { id: `createdAt`, label: `Created` },
]

export const Verifications = (props: TVerifications) => {
  const { orgId } = props

  const [verificationsMap] = useVerifications()
  const isInitialLoading = verificationsMap === undefined
  const verifications = useMemo(
    () => Object.values(verificationsMap || {}),
    [verificationsMap]
  )

  const [searchQuery, setSearchQuery] = useState('')
  const [selected, setSelected] = useState<TVerification | null>(null)

  const filteredVerifications = useMemo(() => {
    if (!searchQuery.trim()) return verifications

    const q = searchQuery.toLowerCase()
    return verifications.filter(
      (v) =>
        String(v.prNumber).includes(q) ||
        v.probe?.kind?.toLowerCase().includes(q) ||
        v.status?.toLowerCase().includes(q) ||
        v.id?.toLowerCase().includes(q)
    )
  }, [verifications, searchQuery])

  const columns: TDataTableColumn<TVerification>[] = [
    {
      id: 'prNumber',
      label: 'PR',
      width: 80,
      render: (v) =>
        v.prUrl ? (
          <Link
            href={v.prUrl}
            target='_blank'
            rel='noopener noreferrer'
            onClick={(e) => e.stopPropagation()}
          >
            #{v.prNumber}
          </Link>
        ) : (
          <Text variant='body2'>#{v.prNumber}</Text>
        ),
    },
    {
      id: 'kind',
      label: 'Probe Kind',
      render: (v) => (
        <Chip
          size='small'
          variant='outlined'
          label={v.probe?.kind || '—'}
        />
      ),
    },
    {
      id: 'status',
      label: 'Status',
      width: 50,
      render: (v) => (
        <Chip
          size='small'
          variant='outlined'
          label={v.status}
          color={statusColor[v.status] || 'default'}
        />
      ),
    },
    {
      id: 'revertPrUrl',
      label: 'Revert PR',
      render: (v) =>
        v.revertPrUrl ? (
          <Link
            href={v.revertPrUrl}
            target='_blank'
            rel='noopener noreferrer'
            onClick={(e) => e.stopPropagation()}
          >
            {v.revertPrUrl}
          </Link>
        ) : (
          <Text
            variant='caption'
            color='text.secondary'
          >
            —
          </Text>
        ),
    },
    {
      id: 'createdAt',
      label: 'Created',
      render: (v) => (
        <Text
          variant='caption'
          color='text.secondary'
        >
          {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '—'}
        </Text>
      ),
    },
  ]

  return (
    <PageLayout
      searchCount={0}
      title='Verifications'
      query={searchQuery}
      countLabel='verification'
      setSearchQuery={setSearchQuery}
      count={isInitialLoading ? undefined : verifications.length}
      searchPlaceholder='Search verifications by PR number, probe kind, or status...'
    >
      {isInitialLoading && <DataTableSkeleton columns={skeletonColumns} />}

      {!isInitialLoading && verifications.length === 0 && (
        <EmptyState message='No verifications yet. The steward will record post-deploy probe results here.' />
      )}

      {!isInitialLoading &&
        verifications.length > 0 &&
        filteredVerifications.length === 0 && (
          <EmptyState message='No verifications match your search query.' />
        )}

      {filteredVerifications.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredVerifications}
          onRowClick={(v) => setSelected(v)}
          getRowKey={(v) => v.id}
        />
      )}

      <VerificationDrawer
        orgId={orgId}
        verification={selected}
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      />
    </PageLayout>
  )
}

export default Verifications
