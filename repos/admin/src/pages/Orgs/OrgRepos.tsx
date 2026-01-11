import { Page } from '@TAF/pages/Page/Page'
import { useRepos } from '@TAF/state/selectors'
import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { setActiveOrgId } from '@TAF/state/accessors'
import { fetchRepos, deleteRepo } from '@TAF/actions/repos'
import { CreateOrgRepoDialog } from './CreateOrgRepoDialog'
import {
  Add as AddIcon,
  Folder as RepoIcon,
  Clear as ClearIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import {
  Box,
  Card,
  Grid,
  Chip,
  Button,
  Tooltip,
  TextField,
  IconButton,
  Typography,
  CardContent,
  CardActions,
  InputAdornment,
  CircularProgress,
} from '@mui/material'

export type TOrgRepos = {}

export const OrgRepos = (props: TOrgRepos) => {
  const navigate = useNavigate()
  const { orgId } = useParams<{ orgId: string }>()
  const [repos] = useRepos()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Sync active org with URL params
  useEffect(() => {
    if (orgId) {
      setActiveOrgId(orgId)
    }
  }, [orgId])

  // Load org repos
  useEffect(() => {
    const loadRepos = async () => {
      if (!orgId) return

      setLoading(true)
      setError(null)

      const result = await fetchRepos({ orgId })

      if (result.error) {
        setError(result.error)
      }

      setLoading(false)
    }

    loadRepos()
  }, [orgId])

  const onCreateClick = () => {
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
  }

  const onDialogSuccess = async () => {
    await fetchRepos()
  }

  const onViewRepo = (repoId: string) => {
    navigate(`/orgs/${orgId}/repos/${repoId}`)
  }

  const onDeleteRepo = async (repoId: string, repoName: string) => {
    if (!window.confirm(`Are you sure you want to delete repo "${repoName}"?`)) {
      return
    }
    await deleteRepo(repoId)
  }

  // Filter repos by orgId and search query
  const filteredRepos = useMemo(() => {
    const orgRepos = repos
      ? Object.values(repos).filter((repo) => repo.orgId === orgId)
      : []

    if (!searchQuery.trim()) return orgRepos

    const query = searchQuery.toLowerCase()
    return orgRepos.filter(
      (repo) =>
        repo.name?.toLowerCase().includes(query) ||
        repo.gitUrl?.toLowerCase().includes(query) ||
        repo.branch?.toLowerCase().includes(query) ||
        repo.id?.toLowerCase().includes(query)
    )
  }, [repos, orgId, searchQuery])

  const reposCount = repos
    ? Object.values(repos).filter((repo) => repo.orgId === orgId).length
    : 0

  return (
    <Page className='tdsk-org-repos-page'>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography
            variant='h4'
            component='h1'
          >
            Org Repositories
          </Typography>
          <Typography color='text.secondary'>
            {reposCount} repositor{reposCount !== 1 ? 'ies' : 'y'}
          </Typography>
        </Box>
        <Button
          variant='contained'
          color='primary'
          startIcon={<AddIcon />}
          onClick={onCreateClick}
        >
          Create Repository
        </Button>
      </Box>

      {!loading && reposCount > 0 && (
        <Box sx={{ mb: 3 }}>
          <TextField
            placeholder='Search repositories by name, URL, or branch...'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size='small'
            fullWidth
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <SearchIcon color='action' />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position='end'>
                  <IconButton
                    size='small'
                    onClick={() => setSearchQuery('')}
                    edge='end'
                  >
                    <ClearIcon />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      )}

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

      {!loading && !error && reposCount === 0 && (
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

      {!loading && !error && reposCount > 0 && filteredRepos.length === 0 && (
        <Card>
          <CardContent>
            <Typography
              color='text.secondary'
              align='center'
            >
              No repositories match your search query.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && !error && filteredRepos.length > 0 && (
        <Grid
          container
          spacing={3}
        >
          {filteredRepos.map((repo) => (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              key={repo.id}
            >
              <Card
                sx={{ cursor: 'pointer' }}
                onClick={() => onViewRepo(repo.id)}
              >
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
                      onClick={(e) => {
                        e.stopPropagation()
                        onViewRepo(repo.id)
                      }}
                    >
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title='Delete Repository'>
                    <IconButton
                      size='small'
                      color='error'
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteRepo(repo.id, repo.name)
                      }}
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

      {orgId && (
        <CreateOrgRepoDialog
          open={dialogOpen}
          orgId={orgId}
          onClose={onDialogClose}
          onSuccess={onDialogSuccess}
        />
      )}
    </Page>
  )
}

export default OrgRepos
