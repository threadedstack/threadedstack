import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Button,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Key as KeyIcon,
  Visibility as ViewIcon,
  VisibilityOff as HideIcon,
} from '@mui/icons-material'
import { Page } from '@TAF/pages/Page/Page'
import { setActiveTeamId } from '@TAF/state/accessors'
import { useSecrets } from '@TAF/state/selectors'
import { fetchSecrets } from '@TAF/actions/secrets'

export type TTeamSecrets = {}

export const TeamSecrets = (props: TTeamSecrets) => {
  const { teamId } = useParams<{ teamId: string }>()
  const [secrets] = useSecrets()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Sync active team with URL params
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

  const handleCreateSecret = () => {
    // TODO: Open create secret dialog
    console.log('Create secret for team:', teamId)
  }

  const handleDeleteSecret = async (secretId: string, secretKey: string) => {
    if (!window.confirm(`Are you sure you want to delete secret "${secretKey}"?`)) {
      return
    }
    // TODO: Implement delete secret
    console.log('Delete secret:', secretId)
  }

  const secretsArray = secrets ? Object.values(secrets) : []

  return (
    <Page className='tdsk-team-secrets-page'>
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
            Team Secrets
          </Typography>
          <Typography color='text.secondary'>
            Team ID: {teamId}
          </Typography>
        </Box>
        <Button
          variant='contained'
          color='primary'
          startIcon={<AddIcon />}
          onClick={handleCreateSecret}
        >
          Create Secret
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
              Error loading secrets: {error.message}
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && !error && secretsArray.length === 0 && (
        <Card>
          <CardContent>
            <Typography color='text.secondary' align='center'>
              No secrets yet. Create your first secret to get started.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && !error && secretsArray.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Key</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>ID</TableCell>
                <TableCell align='right'>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {secretsArray.map((secret) => (
                <TableRow key={secret.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <KeyIcon sx={{ color: 'text.secondary' }} />
                      <Typography variant='body2' fontWeight='medium'>
                        {secret.key}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {secret.providerId ? (
                      <Chip
                        label={secret.providerId}
                        size='small'
                        variant='outlined'
                      />
                    ) : (
                      <Typography variant='body2' color='text.secondary'>
                        N/A
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant='body2' color='text.secondary'>
                      {secret.createdAt ? new Date(secret.createdAt).toLocaleDateString() : 'N/A'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant='caption' color='text.secondary'>
                      {secret.id}
                    </Typography>
                  </TableCell>
                  <TableCell align='right'>
                    <Tooltip title='Delete Secret'>
                      <IconButton
                        size='small'
                        color='error'
                        onClick={() => handleDeleteSecret(secret.id, secret.key)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Page>
  )
}

export default TeamSecrets
