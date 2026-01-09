import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
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
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  FolderGit as RepoIcon,
} from '@mui/icons-material'
import { Page } from '@TAF/pages/Page/Page'
import { useRepos } from '@TAF/state/selectors'
import { fetchRepos, deleteRepo } from '@TAF/actions/repos'
import { ERoutePath } from '@TAF/types'
import { CreateRepoDialog } from './CreateRepoDialog'

export type TRepos = {}

export const Repos = (props: TRepos) => {
  const navigate = useNavigate()
  const [repos, setReposState] = useRepos()
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  useEffect(() => {
    const loadRepos = async () => {
      setLoading(true)
      await fetchRepos()
      setLoading(false)
    }
    loadRepos()
  }, [])

  const handleCreateClick = () => {
    setCreateDialogOpen(true)
  }

  const handleViewRepo = (repoId: string) => {
    navigate(`/repos/${repoId}`)
  }

  const handleDeleteRepo = async (repoId: string, repoName: string) => {
    if (!window.confirm(`Are you sure you want to delete repo "${repoName}"?`)) {
      return
    }
    await deleteRepo(repoId)
  }

  const reposArray = repos ? Object.values(repos) : []

  return (
    <Page className='tdsk-repos-page'>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          variant='h4'
          component='h1'
        >
          Repositories
        </Typography>
        <Button
          variant='contained'
          color='primary'
          startIcon={<AddIcon />}
          onClick={handleCreateClick}
        >
          Create Repository
        </Button>
      </Box>

      {loading && <Typography>Loading repositories...</Typography>}

      {!loading && reposArray.length === 0 && (
        <Card>
          <CardContent>
            <Typography
              color='text.secondary'
              align='center'
            >
              No repositories yet. Create your first repository to get started.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && reposArray.length > 0 && (
        <Grid
          container
          spacing={3}
        >
          {reposArray.map((repo) => (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              key={repo.id}
            >
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <RepoIcon sx={{ mr: 1, color: 'text.secondary' }} />
                    <Typography
                      variant='h6'
                      component='h2'
                    >
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
                      <Chip
                        label={repo.branch}
                        size='small'
                        variant='outlined'
                      />
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

      <CreateRepoDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Page>
  )
}

export default Repos
