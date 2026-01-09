import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Divider,
  TextField,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material'
import { Page } from '@TAF/pages/Page/Page'
import { useRepos, useConfigs } from '@TAF/state/selectors'
import { fetchRepo, deleteRepo } from '@TAF/actions/repos'
import { fetchConfigs, deleteConfig } from '@TAF/actions/configs'
import { setActiveTeamId, setActiveRepoId } from '@TAF/state/accessors'

export type TRepoSettings = {}

export const RepoSettings = (props: TRepoSettings) => {
  const { teamId, repoId } = useParams<{ teamId: string; repoId: string }>()
  const navigate = useNavigate()
  const [repos] = useRepos()
  const [configs] = useConfigs()
  const [loading, setLoading] = useState(true)

  // Sync active team and repo with URL params
  useEffect(() => {
    if (teamId) setActiveTeamId(teamId)
    if (repoId) setActiveRepoId(repoId)
  }, [teamId, repoId])

  // Load repo and configs
  useEffect(() => {
    const loadData = async () => {
      if (!repoId) return
      setLoading(true)
      await Promise.all([
        fetchRepo(repoId),
        fetchConfigs({ repoId })
      ])
      setLoading(false)
    }
    loadData()
  }, [repoId])

  const repo = repoId && repos ? repos[repoId] : undefined

  // Filter configs for this repo
  const repoConfigs = useMemo(() => {
    if (!configs || !repoId) return []
    return Object.values(configs).filter(config => config.repoId === repoId)
  }, [configs, repoId])

  const handleDeleteRepo = async () => {
    if (!repo || !repoId) return
    if (!window.confirm(
      `Are you sure you want to delete repository "${repo.name}"? This action cannot be undone.`
    )) {
      return
    }
    const result = await deleteRepo(repoId)
    if (result.error) {
      alert(`Failed to delete repository: ${result.error.message}`)
    } else {
      navigate(`/teams/${teamId}/repos`)
    }
  }

  const handleDeleteConfig = async (id: string, key: string) => {
    if (!window.confirm(`Are you sure you want to delete config "${key}"?`)) {
      return
    }
    const result = await deleteConfig(id)
    if (result.error) {
      alert(`Failed to delete config: ${result.error.message}`)
    }
  }

  const handleCreateConfig = () => {
    navigate(`/teams/${teamId}/repos/${repoId}/configs/new`)
  }

  if (loading) {
    return (
      <Page className='tdsk-repo-settings-page'>
        <Typography>Loading settings...</Typography>
      </Page>
    )
  }

  if (!repo) {
    return (
      <Page className='tdsk-repo-settings-page'>
        <Alert severity='error'>Repository not found</Alert>
      </Page>
    )
  }

  return (
    <Page className='tdsk-repo-settings-page'>
      <Typography variant='h4' component='h1' sx={{ mb: 3 }}>
        Repository Settings
      </Typography>

      {/* Repository Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant='h6' gutterBottom>
            General Information
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <TextField
            label='Repository Name'
            value={repo.name}
            fullWidth
            disabled
            sx={{ mb: 2 }}
            helperText='Repository name cannot be changed'
          />

          <TextField
            label='Git URL'
            value={repo.gitUrl || ''}
            fullWidth
            disabled
            sx={{ mb: 2 }}
            helperText='Git repository URL'
          />

          <TextField
            label='Branch'
            value={repo.branch || 'main'}
            fullWidth
            disabled
            sx={{ mb: 2 }}
            helperText='Default branch'
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label='Repository ID'
              value={repo.id}
              fullWidth
              disabled
              size='small'
            />
            <TextField
              label='Team ID'
              value={repo.teamId}
              fullWidth
              disabled
              size='small'
            />
          </Box>
        </CardContent>
      </Card>

      {/* Configurations */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Typography variant='h6' sx={{ flex: 1 }}>
              Configurations
            </Typography>
            <Button
              size='small'
              variant='outlined'
              startIcon={<AddIcon />}
              onClick={handleCreateConfig}
            >
              Add Config
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {repoConfigs.length === 0 ? (
            <Typography color='text.secondary'>
              No configurations found for this repository.
            </Typography>
          ) : (
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Key</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell align='right'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {repoConfigs.map(config => (
                    <TableRow key={config.id} hover>
                      <TableCell>
                        <Typography variant='body2' fontFamily='monospace'>
                          {config.key}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          variant='body2'
                          fontFamily='monospace'
                          sx={{
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {config.value}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={config.type || 'string'}
                          size='small'
                          variant='outlined'
                        />
                      </TableCell>
                      <TableCell align='right'>
                        <Tooltip title='Delete config'>
                          <IconButton
                            size='small'
                            color='error'
                            onClick={() => handleDeleteConfig(config.id, config.key)}
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
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card sx={{ borderColor: 'error.main', borderWidth: 1, borderStyle: 'solid' }}>
        <CardContent>
          <Typography variant='h6' color='error' gutterBottom>
            Danger Zone
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Alert severity='warning' sx={{ mb: 2 }}>
            Deleting this repository will permanently remove all associated data including
            endpoints, functions, secrets, and configurations. This action cannot be undone.
          </Alert>

          <Button
            variant='contained'
            color='error'
            startIcon={<DeleteIcon />}
            onClick={handleDeleteRepo}
          >
            Delete Repository
          </Button>
        </CardContent>
      </Card>
    </Page>
  )
}

export default RepoSettings
