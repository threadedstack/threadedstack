import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
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
  Chip,
  CircularProgress,
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  FolderGit as RepoIcon,
} from '@mui/icons-material'
import { Page } from '@TAF/pages/Page/Page'
import { setActiveTeamId } from '@TAF/state/accessors'
import { useRepos } from '@TAF/state/selectors'
import { fetchRepos, deleteRepo } from '@TAF/actions/repos'

export type TTeamRepos = {}

export const TeamRepos = (props: TTeamRepos) => {
  const navigate = useNavigate()
  const { teamId } = useParams<{ teamId: string }>()
  const [repos] = useRepos()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Sync active team with URL params
  useEffect(() => {
    if (teamId) {
      setActiveTeamId(teamId)
    }
  }, [teamId])

  // Load team repos
  useEffect(() => {
    const loadRepos = async () => {
      if (!teamId) return

      setLoading(true)
      setError(null)

      const result = await fetchRepos()

      if (result.error) {
        setError(result.error)
      }

      setLoading(false)
    }

    loadRepos()
  }, [teamId])

  const handleCreateClick = () => {
    // TODO: Open create repo dialog
    console.log('Create repo for team:', teamId)
  }

  const handleViewRepo = (repoId: string) => {
    navigate(`/teams/${teamId}/repos/${repoId}`)
  }

  const handleDeleteRepo = async (repoId: string, repoName: string) => {
    if (!window.confirm(`Are you sure you want to delete repo "${repoName}"?`)) {
      return
    }
    await deleteRepo(repoId)
  }

  // Filter repos by teamId - note: backend may need to support this filter in the future
  const reposArray = repos
    ? Object.values(repos).filter((repo) => repo.teamId === teamId)
    : []

  return (
    <Page className='tdsk-team-repos-page'>
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
            Team Repositories
          </Typography>
          <Typography color='text.secondary'>
            Team ID: {teamId}
          </Typography>
        </Box>
        <Button
          variant='contained'
          color='primary'
          startIcon={<AddIcon />}
          onClick={handleCreateClick}
        >
          Create Repository
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
              Error loading repositories: {error.message}
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && !error && reposArray.length === 0 && (
        <Card>
          <CardContent>
            <Typography color='text.secondary' align='center'>
              No repositories yet. Create your first repository to get started.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && !error && reposArray.length > 0 && (
        <Grid container spacing={3}>
          {reposArray.map((repo) => (
            <Grid item xs={12} sm={6} md={4} key={repo.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <RepoIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography variant='h6' component='h2'>
                      {repo.name}
                    </Typography>
                  </Box>

                  {repo.gitUrl && (
                    <Typography
                      variant='body2'
                      color='text.secondary'
                      sx={{ mb: 1, wordBreak: 'break-all' }}
                    >
                      {repo.gitUrl}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                    {repo.branch && (
                      <Chip label={repo.branch} size='small' variant='outlined' />
                    )}
                  </Box>

                  <Typography
                    variant='caption'
                    color='text.secondary'
                    sx={{ mt: 1, display: 'block' }}
                  >
                    ID: {repo.id}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Tooltip title='View Repository'>
                    <IconButton
                      size='small'
                      color='primary'
                      onClick={() => handleViewRepo(repo.id)}
                    >
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title='Delete Repository'>
                    <IconButton
                      size='small'
                      color='error'
                      onClick={() => handleDeleteRepo(repo.id, repo.name)}
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

export default TeamRepos
