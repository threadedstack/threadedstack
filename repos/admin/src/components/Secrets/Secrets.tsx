import type { Secret } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { useEffect, useState, useMemo } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import { useSecrets } from '@TAF/state/selectors'
import { fetchSecrets } from '@TAF/actions/secrets'
import { Key as KeyIcon, Add as AddIcon, Edit as EditIcon } from '@mui/icons-material'
import {
  SearchBar,
  DataTable,
  PageHeader,
  ErrorAlert,
  EmptyState,
  LoadingSpinner,
  ActionIconButton,
} from '@TAF/components'
import { SecretDialog } from './SecretDialog'

export type TSecrets = {
  orgId?: string
  projectId?: string
}

export const Secrets = ({ orgId, projectId }: TSecrets) => {
  const [secrets] = useSecrets()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Determine context type
  const isOrgContext = !!orgId && !projectId
  const isProjectContext = !!projectId

  // Load secrets based on context
  useEffect(() => {
    const loadSecrets = async () => {
      if (!orgId && !projectId) return

      setLoading(true)
      setError(null)

      const params = projectId ? { projectId } : { orgId: orgId! }
      const result = await fetchSecrets(params)

      if (result.error) {
        setError(result.error)
      }

      setLoading(false)
    }

    loadSecrets()
  }, [orgId, projectId])

  const onCreateSecret = () => {
    setSelectedSecret(null)
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
    setSelectedSecret(null)
  }

  const onSecretCreated = async () => {
    if (!orgId && !projectId) return

    setLoading(true)
    setError(null)

    const params = projectId ? { projectId } : { orgId: orgId! }
    const result = await fetchSecrets(params)
    result.error ? setError(result.error) : setError(null)

    setLoading(false)
  }

  const onEditSecret = (secret: Secret) => {
    setSelectedSecret(secret)
    setDialogOpen(true)
  }

  const filteredSecrets = useMemo(() => {
    const secretsArray = secrets ? Object.values(secrets) : []

    // Filter by context
    const contextFilteredSecrets = secretsArray.filter((secret) => {
      if (isProjectContext) {
        return secret.projectId === projectId
      }
      if (isOrgContext) {
        return secret.orgId === orgId && !secret.projectId
      }
      return false
    })

    // Filter by search query
    if (!searchQuery.trim()) return contextFilteredSecrets

    const query = searchQuery.toLowerCase()
    return contextFilteredSecrets.filter(
      (secret) =>
        secret.hashKey?.toLowerCase().includes(query) ||
        secret.name?.toLowerCase().includes(query) ||
        secret.id?.toLowerCase().includes(query)
    )
  }, [secrets, searchQuery, orgId, projectId, isOrgContext, isProjectContext])

  const secretsCount = useMemo(() => {
    const secretsArray = secrets ? Object.values(secrets) : []
    if (isProjectContext) {
      return secretsArray.filter((s) => s.projectId === projectId).length
    }
    if (isOrgContext) {
      return secretsArray.filter((s) => s.orgId === orgId && !s.projectId).length
    }
    return 0
  }, [secrets, orgId, projectId, isOrgContext, isProjectContext])

  const columns: TDataTableColumn<Secret>[] = [
    {
      id: 'key',
      label: 'Key',
      render: (secret) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <KeyIcon sx={{ color: 'text.secondary' }} />
          <Typography
            variant='body2'
            fontWeight='medium'
          >
            {secret.name || secret.hashKey}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'provider',
      label: 'Provider',
      render: (secret) =>
        secret.providerId ? (
          <Chip
            label={secret.providerId}
            size='small'
            variant='outlined'
          />
        ) : (
          <Typography
            variant='body2'
            color='text.secondary'
          >
            N/A
          </Typography>
        ),
    },
    {
      id: 'created',
      label: 'Created',
      render: (secret) => (
        <Typography
          variant='body2'
          color='text.secondary'
        >
          {secret.createdAt ? new Date(secret.createdAt).toLocaleDateString() : 'N/A'}
        </Typography>
      ),
    },
    {
      id: 'id',
      label: 'ID',
      render: (secret) => (
        <Typography
          variant='caption'
          color='text.secondary'
        >
          {secret.id}
        </Typography>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (secret) => (
        <ActionIconButton
          tooltip='Edit Secret'
          icon={<EditIcon />}
          size='small'
          color='primary'
          onClick={(e) => {
            e.stopPropagation()
            onEditSecret(secret)
          }}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title='Secrets'
        count={secretsCount}
        countLabel='secret'
        actionLabel='Create Secret'
        actionIcon={<AddIcon />}
        onAction={onCreateSecret}
      />

      {!loading && secretsCount > 0 && (
        <Box sx={{ mb: 3 }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder='Search secrets by name or ID...'
          />
        </Box>
      )}

      {loading && <LoadingSpinner />}

      {error && (
        <ErrorAlert
          message={`Error loading secrets: ${error.message}`}
          onClose={() => setError(null)}
          sx={{ mb: 3 }}
        />
      )}

      {!loading && !error && secretsCount === 0 && (
        <EmptyState
          message='No secrets yet. Create your first secret to get started.'
          actionLabel='Create Your First Secret'
          actionIcon={<AddIcon />}
          onAction={onCreateSecret}
        />
      )}

      {!loading && !error && secretsCount > 0 && filteredSecrets.length === 0 && (
        <EmptyState message='No secrets match your search query.' />
      )}

      {!loading && !error && filteredSecrets.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredSecrets}
          onRowClick={onEditSecret}
          getRowKey={(secret) => secret.id}
        />
      )}

      {(orgId || projectId) && (
        <SecretDialog
          open={dialogOpen}
          orgId={orgId}
          projectId={projectId}
          secret={selectedSecret}
          onClose={onDialogClose}
          onSuccess={onSecretCreated}
        />
      )}
    </>
  )
}

export default Secrets
