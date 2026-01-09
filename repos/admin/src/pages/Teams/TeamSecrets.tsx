import type { Secret } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { useParams } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { useSecrets } from '@TAF/state/selectors'
import { fetchSecrets } from '@TAF/actions/secrets'
import { useEffect, useState, useMemo } from 'react'
import { Box, Typography, Chip } from '@mui/material'
import { EditSecretDialog } from './EditSecretDialog'
import { setActiveTeamId } from '@TAF/state/accessors'
import { CreateSecretDialog } from './CreateSecretDialog'
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

export type TTeamSecrets = {}

export const TeamSecrets = (props: TTeamSecrets) => {
  const { teamId } = useParams<{ teamId: string }>()
  const [secrets] = useSecrets()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (teamId) {
      setActiveTeamId(teamId)
    }
  }, [teamId])

  // Load team secrets
  useEffect(() => {
    const loadSecrets = async () => {
      if (!teamId) return

      setLoading(true)
      setError(null)

      const result = await fetchSecrets({ teamId })

      if (result.error) {
        setError(result.error)
      }

      setLoading(false)
    }

    loadSecrets()
  }, [teamId])

  const onCreateSecret = () => {
    setCreateDialogOpen(true)
  }

  const onDialogClose = () => {
    setCreateDialogOpen(false)
  }

  const onSecretCreated = async () => {
    if (!teamId) return

    setLoading(true)
    setError(null)

    const result = await fetchSecrets({ teamId })
    result.error ? setError(result.error) : setError(undefined)

    setLoading(false)
  }

  const onEditSecret = (secret: Secret) => {
    setSelectedSecret(secret)
    setEditDialogOpen(true)
  }

  const onEditDialogClose = () => {
    setEditDialogOpen(false)
    setSelectedSecret(null)
  }

  const onEditSuccess = async () => {
    if (!teamId) return

    setLoading(true)
    setError(null)

    const result = await fetchSecrets({ teamId })
    result.error && setError(result.error)

    setLoading(false)
  }

  const filteredSecrets = useMemo(() => {
    const secretsArray = secrets ? Object.values(secrets) : []
    if (!searchQuery.trim()) return secretsArray

    const query = searchQuery.toLowerCase()
    return secretsArray.filter(
      (secret) =>
        secret.hashKey?.toLowerCase().includes(query) ||
        secret.name?.toLowerCase().includes(query) ||
        secret.id?.toLowerCase().includes(query)
    )
  }, [secrets, searchQuery])

  const secretsCount = secrets ? Object.keys(secrets).length : 0

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
            {secret.hashKey}
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
    <Page className='tdsk-team-secrets-page'>
      <PageHeader
        title='Team Secrets'
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

      {teamId && (
        <>
          <CreateSecretDialog
            teamId={teamId}
            open={createDialogOpen}
            onClose={onDialogClose}
            onSuccess={onSecretCreated}
          />
          <EditSecretDialog
            open={editDialogOpen}
            secret={selectedSecret}
            onSuccess={onEditSuccess}
            onClose={onEditDialogClose}
          />
        </>
      )}
    </Page>
  )
}

export default TeamSecrets
