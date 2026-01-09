import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  IconButton,
  Tooltip,
  CircularProgress,
  Chip,
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  CloudQueue as ProviderIcon,
} from '@mui/icons-material'
import { Page } from '@TAF/pages/Page/Page'
import { setActiveTeamId } from '@TAF/state/accessors'
import { useProviders } from '@TAF/state/selectors'
import { fetchProviders } from '@TAF/actions/providers'

export type TTeamProviders = {}

export const TeamProviders = (props: TTeamProviders) => {
  const { teamId } = useParams<{ teamId: string }>()
  const [providers] = useProviders()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Sync active team with URL params
  useEffect(() => {
    if (teamId) {
      setActiveTeamId(teamId)
    }
  }, [teamId])

  // Load team providers
  useEffect(() => {
    const loadProviders = async () => {
      if (!teamId) return

      setLoading(true)
      setError(null)

      const result = await fetchProviders({ teamId })

      if (result.error) {
        setError(result.error)
      }

      setLoading(false)
    }

    loadProviders()
  }, [teamId])

  const handleCreateProvider = () => {
    // TODO: Open create provider dialog
    console.log('Create provider for team:', teamId)
  }

  const handleEditProvider = (providerId: string) => {
    // TODO: Open edit provider dialog
    console.log('Edit provider:', providerId)
  }

  const handleDeleteProvider = async (providerId: string, providerName: string) => {
    if (!window.confirm(`Are you sure you want to delete provider "${providerName}"?`)) {
      return
    }
    // TODO: Implement delete provider
    console.log('Delete provider:', providerId)
  }

  const providersArray = providers ? Object.values(providers) : []

  return (
    <Page className='tdsk-team-providers-page'>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography variant='h4' component='h1'>
            Team Providers
          </Typography>
          <Typography color='text.secondary'>
            Team ID: {teamId}
          </Typography>
        </Box>
        <Button
          variant='contained'
          color='primary'
          startIcon={<AddIcon />}
          onClick={handleCreateProvider}
        >
          Create Provider
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography color='error'>
              Error loading providers: {error.message}
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && !error && providersArray.length === 0 && (
        <Card>
          <CardContent>
            <Typography color='text.secondary' align='center'>
              No providers yet. Create your first provider to get started.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && !error && providersArray.length > 0 && (
        <Grid container spacing={3}>
          {providersArray.map((provider) => (
            <Grid item xs={12} sm={6} md={4} key={provider.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <ProviderIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant='h6' component='h2'>
                      {provider.name}
                    </Typography>
                  </Box>

                  {provider.type && (
                    <Chip
                      label={provider.type}
                      size='small'
                      color='primary'
                      variant='outlined'
                      sx={{ mb: 1 }}
                    />
                  )}

                  {provider.baseUrl && (
                    <Typography
                      variant='body2'
                      color='text.secondary'
                      sx={{ mb: 1, wordBreak: 'break-all' }}
                    >
                      {provider.baseUrl}
                    </Typography>
                  )}

                  <Typography
                    variant='caption'
                    color='text.secondary'
                    sx={{ mt: 1, display: 'block' }}
                  >
                    ID: {provider.id}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Tooltip title='Edit Provider'>
                    <IconButton
                      size='small'
                      color='primary'
                      onClick={() => handleEditProvider(provider.id)}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title='Delete Provider'>
                    <IconButton
                      size='small'
                      color='error'
                      onClick={() => handleDeleteProvider(provider.id, provider.name)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Page>
  )
}

export default TeamProviders
