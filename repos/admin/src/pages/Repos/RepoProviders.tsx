import { useEffect, useState, useMemo } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { useProviders } from '@TAF/state/selectors'
import { useParams, useNavigate } from 'react-router'
import { fetchProviders } from '@TAF/actions/providers'
import { Settings as SettingsIcon } from '@mui/icons-material'
import { setActiveTeamId, setActiveRepoId } from '@TAF/state/accessors'
import {
  Box,
  Card,
  Chip,
  Alert,
  Table,
  Button,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Typography,
  CardContent,
  TableContainer,
} from '@mui/material'

export type TRepoProviders = {}

export const RepoProviders = (props: TRepoProviders) => {
  const { teamId, repoId } = useParams<{ teamId: string; repoId: string }>()
  const navigate = useNavigate()
  const [providers] = useProviders()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (teamId) setActiveTeamId(teamId)
    if (repoId) setActiveRepoId(repoId)
  }, [teamId, repoId])

  useEffect(() => {
    const loadData = async () => {
      if (!teamId) return
      setLoading(true)
      await fetchProviders({ teamId })
      setLoading(false)
    }
    loadData()
  }, [teamId])

  const teamProviders = useMemo(() => {
    if (!providers || !teamId) return []
    return Object.values(providers).filter((provider) => provider.teamId === teamId)
  }, [providers, teamId])

  const onManageProviders = () => {
    navigate(`/teams/${teamId}/providers`)
  }

  if (loading) {
    return (
      <Page className='tdsk-repo-providers-page'>
        <Typography>Loading providers...</Typography>
      </Page>
    )
  }

  return (
    <Page className='tdsk-repo-providers-page'>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography
          variant='h4'
          component='h1'
          sx={{ flex: 1 }}
        >
          Repo Providers
        </Typography>
        <Button
          variant='outlined'
          startIcon={<SettingsIcon />}
          onClick={onManageProviders}
        >
          Manage Team Providers
        </Button>
      </Box>

      <Alert
        severity='info'
        sx={{ mb: 3 }}
      >
        Providers are team-scoped and shared across all repositories in the team. This
        page shows all providers available to this repository.
      </Alert>

      {teamProviders.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color='text.secondary'>
              No providers configured for this team.
            </Typography>
            <Button
              variant='outlined'
              startIcon={<SettingsIcon />}
              onClick={onManageProviders}
              sx={{ mt: 2 }}
            >
              Configure Providers
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Card}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Provider URL</TableCell>
                <TableCell>Created At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {teamProviders.map((provider) => (
                <TableRow
                  key={provider.id}
                  hover
                >
                  <TableCell>{provider.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={provider.type}
                      size='small'
                      color='primary'
                      variant='outlined'
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant='body2'
                      fontFamily='monospace'
                      sx={{ wordBreak: 'break-all' }}
                    >
                      {provider.options?.url || `N/A`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {provider.createdAt
                      ? new Date(provider.createdAt).toLocaleString()
                      : 'N/A'}
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

export default RepoProviders
