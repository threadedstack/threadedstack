import type { Domain } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { useDomains } from '@TAF/state/selectors'
import { fetchDomains } from '@TAF/actions/domains/api'
import { useEffect, useState, useMemo } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import { SearchBar } from '@TAF/components/SearchBar/SearchBar'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { PageHeader } from '@TAF/components/PageHeader/PageHeader'
import { DomainDrawer } from '@TAF/components/Domains/DomainDrawer'
import { ErrorAlert } from '@TAF/components/ErrorAlert/ErrorAlert'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { LoadingSpinner } from '@TAF/components/LoadingSpinner/LoadingSpinner'
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

export const Domains = ({ orgId, projectId }: TDomains) => {
  const [domains] = useDomains()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDomain, setSelectedDomain] = useState<Domain | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Determine context type
  const isOrgContext = !!orgId && !projectId
  const isProjectContext = !!projectId

  // Load domains based on context
  useEffect(() => {
    const loadDomains = async () => {
      if (!orgId && !projectId) return

      setLoading(true)
      setError(null)

      const params = projectId ? { projectId } : { orgId: orgId! }
      const result = await fetchDomains(params)
      result.error ? setError(result.error) : setError(null)

      setLoading(false)
    }

    loadDomains()
  }, [orgId, projectId])

  const onCreateDomain = () => {
    setSelectedDomain(null)
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
    setSelectedDomain(null)
  }

  const onDomainCreated = async () => {
    if (!orgId && !projectId) return

    setLoading(true)
    setError(null)

    const params = projectId ? { projectId } : { orgId: orgId! }
    const result = await fetchDomains(params)
    result.error ? setError(result.error) : setError(null)

    setLoading(false)
  }

  const onEditDomain = (domain: Domain) => {
    setSelectedDomain(domain)
    setDialogOpen(true)
  }

  const filteredDomains = useMemo(() => {
    const domainsArray = domains ? Object.values(domains) : []

    // Filter by context
    const contextFilteredDomains = domainsArray.filter((domain) => {
      if (isProjectContext) {
        return domain.projectId === projectId
      }
      if (isOrgContext) {
        return domain.orgId === orgId && !domain.projectId
      }
      return false
    })

    // Filter by search query
    if (!searchQuery.trim()) return contextFilteredDomains

    const query = searchQuery.toLowerCase()
    return contextFilteredDomains.filter(
      (domain) =>
        domain.domain?.toLowerCase().includes(query) ||
        domain.id?.toLowerCase().includes(query)
    )
  }, [domains, searchQuery, orgId, projectId, isOrgContext, isProjectContext])

  const domainsCount = useMemo(() => {
    const domainsArray = domains ? Object.values(domains) : []
    if (isProjectContext) {
      return domainsArray.filter((d) => d.projectId === projectId).length
    }
    if (isOrgContext) {
      return domainsArray.filter((d) => d.orgId === orgId && !d.projectId).length
    }
    return 0
  }, [domains, orgId, projectId, isOrgContext, isProjectContext])

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
          onClick={(e) => {
            e.stopPropagation()
            onEditDomain(domain)
          }}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title='Domains'
        countLabel='domain'
        count={domainsCount}
        actionLabel='Add Domain'
        actionIcon={<AddIcon />}
        onAction={onCreateDomain}
      />

      {!loading && domainsCount > 0 && (
        <Box sx={{ mb: 3 }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder='Search domains by name or ID...'
          />
        </Box>
      )}

      {loading && <LoadingSpinner />}

      {error && (
        <ErrorAlert
          message={`Error loading domains: ${error.message}`}
          onClose={() => setError(null)}
          sx={{ mb: 3 }}
        />
      )}

      {!loading && !error && domainsCount === 0 && (
        <EmptyState
          actionIcon={<AddIcon />}
          onAction={onCreateDomain}
          actionLabel='Add Your First Domain'
          message='No domains yet. Add your first domain to get started.'
        />
      )}

      {!loading && !error && domainsCount > 0 && filteredDomains.length === 0 && (
        <EmptyState message='No domains match your search query.' />
      )}

      {!loading && !error && filteredDomains.length > 0 && (
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
          onSuccess={onDomainCreated}
        />
      )}
    </>
  )
}

export default Domains
