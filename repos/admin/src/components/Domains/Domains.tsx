import type { Domain } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { useState, useMemo } from 'react'
import { EPermResource } from '@tdsk/domain'
import { DataTableSkeleton } from '@tdsk/components'
import { Box, Typography, Chip } from '@mui/material'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { DomainDrawer } from '@TAF/components/Domains/DomainDrawer'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { useProjectDomains, useOrgDomains } from '@TAF/state/selectors'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Public as PublicIcon,
  Warning as WarningIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material'

export type TDomains = {
  orgId?: string
  projectId?: string
}

const skeletonColumns = [
  { id: `domain`, label: `Domain` },
  { id: `status`, label: `Status` },
  { id: `verifiedAt`, label: `Verified` },
  { id: `sslExpiresAt`, label: `SSL Expires` },
  { id: `id`, label: `ID` },
  { id: `actions`, label: `Actions`, align: `right` as const },
]

export const Domains = ({ orgId, projectId }: TDomains) => {
  const { canCreate, canUpdate } = usePermissions()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const isProjectContext = !!projectId

  const [projectDomains] = useProjectDomains()
  const [orgDomains] = useOrgDomains()
  const domains = isProjectContext ? projectDomains : orgDomains
  const isInitialLoading = domains === undefined

  const onCreateDomain = () => {
    setSelectedDomain(null)
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
    setSelectedDomain(null)
  }

  const onEditDomain = (domain: Domain) => {
    setSelectedDomain(domain)
    setDialogOpen(true)
  }

  const filteredDomains = useMemo(() => {
    const domainsArray = domains ? Object.values(domains) : []

    if (!searchQuery.trim()) return domainsArray

    const query = searchQuery.toLowerCase()
    return domainsArray.filter(
      (domain) =>
        domain.domain?.toLowerCase().includes(query) ||
        domain.id?.toLowerCase().includes(query)
    )
  }, [domains, searchQuery])

  const domainsCount = useMemo(() => {
    return domains ? Object.keys(domains).length : 0
  }, [domains])

  const columns: TDataTableColumn<Domain>[] = [
    {
      id: 'domain',
      label: 'Domain',
      render: (domain) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PublicIcon sx={{ color: 'text.secondary' }} />
          <Typography
            variant='body2'
            fontWeight='medium'
          >
            {domain.domain}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      render: (domain) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {domain.verified ? (
            <Chip
              icon={<VerifiedIcon />}
              label='Verified'
              size='small'
              color='success'
              variant='outlined'
            />
          ) : (
            <Chip
              icon={<WarningIcon />}
              label='Pending'
              size='small'
              color='warning'
              variant='outlined'
            />
          )}
          {domain.sslEnabled && (
            <Chip
              label='SSL'
              size='small'
              color='primary'
              variant='outlined'
            />
          )}
        </Box>
      ),
    },
    {
      id: 'verifiedAt',
      label: 'Verified',
      render: (domain) => (
        <Typography
          variant='body2'
          color='text.secondary'
        >
          {domain.verifiedAt ? new Date(domain.verifiedAt).toLocaleDateString() : 'N/A'}
        </Typography>
      ),
    },
    {
      id: 'sslExpiresAt',
      label: 'SSL Expires',
      render: (domain) => (
        <Typography
          variant='body2'
          color='text.secondary'
        >
          {domain.sslExpiresAt
            ? new Date(domain.sslExpiresAt).toLocaleDateString()
            : 'N/A'}
        </Typography>
      ),
    },
    {
      id: 'id',
      label: 'ID',
      render: (domain) => (
        <Typography
          variant='caption'
          color='text.secondary'
        >
          {domain.id}
        </Typography>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (domain) => (
        <ActionIconButton
          size='small'
          color='primary'
          icon={<EditIcon />}
          tooltip='Edit Domain'
          disabled={!canUpdate(EPermResource.domain)}
          disabledTooltip='You do not have permission to edit domains'
          onClick={(e) => {
            e.stopPropagation()
            onEditDomain(domain)
          }}
        />
      ),
    },
  ]

  return (
    <PageLayout
      searchCount={0}
      title='Domains'
      query={searchQuery}
      countLabel='domain'
      setSearchQuery={setSearchQuery}
      count={isInitialLoading ? undefined : domainsCount}
      onAction={domainsCount > 0 && onCreateDomain}
      actionLabel={domainsCount > 0 && 'Add Domain'}
      actionDisabled={!canCreate(EPermResource.domain)}
      searchPlaceholder='Search domains by name or ID...'
    >
      {isInitialLoading && <DataTableSkeleton columns={skeletonColumns} />}

      {!isInitialLoading && domainsCount === 0 && (
        <EmptyState
          actionIcon={<AddIcon />}
          onAction={onCreateDomain}
          actionLabel='Add Your First Domain'
          actionDisabled={!canCreate(EPermResource.domain)}
          message='No domains yet. Add your first domain to get started.'
        />
      )}

      {!isInitialLoading && domainsCount > 0 && filteredDomains.length === 0 && (
        <EmptyState message='No domains match your search query.' />
      )}

      {filteredDomains.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredDomains}
          onRowClick={onEditDomain}
          getRowKey={(domain) => domain.id}
        />
      )}

      {(orgId || projectId) && (
        <DomainDrawer
          orgId={orgId}
          open={dialogOpen}
          projectId={projectId}
          domain={selectedDomain}
          onClose={onDialogClose}
        />
      )}
    </PageLayout>
  )
}

export default Domains
