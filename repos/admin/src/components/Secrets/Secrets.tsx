import type { Secret } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { Box, Typography } from '@mui/material'
import { useSecrets } from '@TAF/state/selectors'
import { ConfirmDelete } from '@tdsk/components'
import { useEffect, useState, useMemo } from 'react'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { SecretDrawer } from '@TAF/components/Secrets/SecretDrawer'
import { fetchSecrets } from '@TAF/actions/secrets/api/fetchSecrets'
import { deleteSecret } from '@TAF/actions/secrets/api/deleteSecret'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  Key as KeyIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'

export type TSecrets = {
  orgId?: string
  projectId?: string
}

export const Secrets = ({ orgId, projectId }: TSecrets) => {
  const [secrets] = useSecrets()
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleting, setDeleting] = useState<Secret>()
  const [error, setError] = useState<Error | null>(null)
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null)

  // Determine context type
  const isOrgContext = !!orgId && !projectId
  const isProjectContext = !!projectId

  // Load secrets based on context
  useEffect(() => {
    const loadSecrets = async () => {
      if (!orgId && !projectId) return

      setLoading(true)
      setError(null)
      const result = await fetchSecrets({ orgId, projectId })
      result.error && setError(result.error)
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

  const onEditSecret = (secret: Secret) => {
    setSelectedSecret(secret)
    setDialogOpen(true)
  }

  const onRemove = async () => {
    if (!deleting) return

    setLoading(true)
    setError(null)

    const result = await deleteSecret({ orgId, id: deleting.id, projectId })

    setLoading(false)
    setDeleting(undefined)
    dialogOpen && setDialogOpen(false)
    result.error && setError(result.error)
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
      id: 'id',
      label: 'ID',
      render: (secret) => (
        <Typography
          maxWidth='200px'
          variant='caption'
          color='text.secondary'
        >
          {secret.id}
        </Typography>
      ),
    },
    {
      id: 'description',
      label: 'Description',
      render: (secret) => (
        <Typography
          display='block'
          maxWidth='200px'
          variant='caption'
          overflow='hidden'
          whiteSpace='nowrap'
          textOverflow='ellipsis'
          color='text.secondary'
        >
          {secret.description}
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
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (secret) => (
        <>
          <ActionIconButton
            tooltip='Edit Secret'
            icon={<EditIcon sx={{ fontSize: `16px` }} />}
            size='small'
            color='primary'
            onClick={(e) => {
              e.stopPropagation()
              onEditSecret(secret)
            }}
          />
          <ActionIconButton
            tooltip='Delete Secret'
            icon={<DeleteIcon sx={{ fontSize: `16px` }} />}
            size='small'
            color='error'
            onClick={(e) => {
              e.stopPropagation()
              setDeleting(secret)
            }}
          />
        </>
      ),
    },
  ]

  return (
    <PageLayout
      title='Secrets'
      loading={loading}
      searchCount={0}
      countLabel='secret'
      query={searchQuery}
      count={secretsCount}
      error={error?.message}
      setSearchQuery={setSearchQuery}
      actionIcon={<AddIcon />}
      onAction={secretsCount > 0 && onCreateSecret}
      actionLabel={secretsCount > 0 && 'Create Secret'}
      searchPlaceholder='Search secrets by name or ID...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : null)}
    >
      {!error && secretsCount === 0 && (
        <EmptyState
          actionIcon={<AddIcon />}
          onAction={onCreateSecret}
          actionLabel='Create Secret'
          message='No secrets yet. Create your first secret to get started.'
        />
      )}

      {!error && secretsCount > 0 && filteredSecrets.length === 0 && (
        <EmptyState message='No secrets match your search query.' />
      )}

      {!error && filteredSecrets.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredSecrets}
          onRowClick={onEditSecret}
          getRowKey={(secret) => secret.id}
        />
      )}

      {(orgId || projectId) && (
        <SecretDrawer
          orgId={orgId}
          open={dialogOpen}
          projectId={projectId}
          onRemove={setDeleting}
          secret={selectedSecret}
          onClose={onDialogClose}
        />
      )}

      {deleting && (
        <ConfirmDelete
          deleting={loading}
          onConfirm={onRemove}
          itemName={deleting?.name || `Secret`}
          onCancel={() => setDeleting(undefined)}
        />
      )}
    </PageLayout>
  )
}

export default Secrets
