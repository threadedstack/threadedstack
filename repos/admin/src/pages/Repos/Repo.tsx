import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Divider,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Folder as RepoIcon,
} from '@mui/icons-material'
import { Page } from '@TAF/pages/Page/Page'
import { useRepos } from '@TAF/state/selectors'
import { fetchRepo, deleteRepo } from '@TAF/actions/repos'
import { ERoutePath } from '@TAF/types'

export type TRepo = {}

export const Repo = (props: TRepo) => {
  const { repoId } = useParams<{ repoId: string }>()
  const navigate = useNavigate()
  const [repos] = useRepos()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadRepo = async () => {
      if (!repoId) return
      setLoading(true)
      await fetchRepo(repoId)
      setLoading(false)
    }
    loadRepo()
  }, [repoId])

  const repo = repoId && repos ? repos[repoId] : undefined

  const handleBack = () => {
    navigate(ERoutePath.Repos)
  }

  const handleDelete = async () => {
    if (!repo || !repoId) return
    if (!window.confirm(`Are you sure you want to delete repository "${repo.name}"?`)) {
      return
    }
    const result = await deleteRepo(repoId)
    if (!result.error) {
      navigate(ERoutePath.Repos)
    }
  }

  if (loading) {
    return (
      <Page className='tdsk-repo-page'>
        <Typography>Loading repository...</Typography>
      </Page>
    )
  }

  if (!repo) {
    return (
      <Page className='tdsk-repo-page'>
        <Card>
          <CardContent>
            <Typography color='error'>Repository not found</Typography>
            <Button
              onClick={handleBack}
              sx={{ mt: 2 }}
            >
              Back to Repositories
            </Button>
          </CardContent>
        </Card>
      </Page>
    )
  }

  return (
    <Page className='tdsk-repo-page'>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tooltip title='Back to Repositories'>
          <IconButton onClick={handleBack}>
            <BackIcon />
          </IconButton>
        </Tooltip>
        <RepoIcon sx={{ color: 'text.secondary' }} />
        <Typography
          variant='h4'
          component='h1'
          sx={{ flex: 1 }}
        >
          {repo.name}
        </Typography>
        <Button
          variant='outlined'
          startIcon={<EditIcon />}
          disabled
        >
          Edit
        </Button>
        <Button
          variant='outlined'
          color='error'
          startIcon={<DeleteIcon />}
          onClick={handleDelete}
        >
          Delete
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography
            variant='h6'
            gutterBottom
          >
            Repository Information
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Name
            </Typography>
            <Typography variant='body1'>{repo.name}</Typography>
          </Box>

          {repo.gitUrl && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Git URL
              </Typography>
              <Typography
                variant='body1'
                sx={{ wordBreak: 'break-all' }}
              >
                {repo.gitUrl}
              </Typography>
            </Box>
          )}

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Branch
            </Typography>
            <Chip
              label={repo.branch || 'main'}
              size='small'
              sx={{ mt: 0.5 }}
            />
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Team ID
            </Typography>
            <Typography
              variant='body2'
              fontFamily='monospace'
            >
              {repo.teamId}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Repository ID
            </Typography>
            <Typography
              variant='body2'
              fontFamily='monospace'
            >
              {repo.id}
            </Typography>
          </Box>

          {repo.createdAt && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Created At
              </Typography>
              <Typography variant='body2'>
                {new Date(repo.createdAt).toLocaleString()}
              </Typography>
            </Box>
          )}

          {repo.updatedAt && (
            <Box>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Last Updated
              </Typography>
              <Typography variant='body2'>
                {new Date(repo.updatedAt).toLocaleString()}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {repo.meta && Object.keys(repo.meta).length > 0 && (
        <Card>
          <CardContent>
            <Typography
              variant='h6'
              gutterBottom
            >
              Metadata
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box
              component='pre'
              sx={{
                p: 2,
                bgcolor: 'background.default',
                borderRadius: 1,
                overflow: 'auto',
                fontSize: '0.875rem',
              }}
            >
              {JSON.stringify(repo.meta, null, 2)}
            </Box>
          </CardContent>
        </Card>
      )}
    </Page>
  )
}

export default Repo
