import { useEffect, useState, useMemo } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { useProviders } from '@TAF/state/selectors'
import { useParams, useNavigate } from 'react-router'
import { fetchProviders } from '@TAF/actions/providers'
import { Settings as SettingsIcon } from '@mui/icons-material'
import { setActiveOrgId, setActiveprojectId } from '@TAF/state/accessors'
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

export type TProjectProviders = {}

export const ProjectProviders = (props: TProjectProviders) => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>()
  const navigate = useNavigate()
  const [providers] = useProviders()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orgId) setActiveOrgId(orgId)
    if (projectId) setActiveprojectId(projectId)
  }, [orgId, projectId])

  useEffect(() => {
    const loadData = async () => {
      if (!orgId) return
      setLoading(true)
      await fetchProviders({ orgId })
      setLoading(false)
    }
    loadData()
  }, [orgId])

  const orgProviders = useMemo(() => {
    if (!providers || !orgId) return []
    return Object.values(providers).filter((provider) => provider.orgId === orgId)
  }, [providers, orgId])

  const onManageProviders = () => {
    navigate(`/orgs/${orgId}/providers`)
  }

  if (loading) {
    return (
      <Page className='tdsk-project-providers-page'>
        <Typography>Loading providers...</Typography>
      </Page>
    )
  }

  return (
    <Page className='tdsk-project-providers-page'>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography
          variant='h4'
          component='h1'
          sx={{ flex: 1 }}
        >
          Project Providers
        </Typography>
        <Button
          variant='outlined'
          startIcon={<SettingsIcon />}
          onClick={onManageProviders}
        >
          Manage Org Providers
        </Button>
      </Box>

      <Alert
        severity='info'
        sx={{ mb: 3 }}
      >
        Providers are org-scoped and shared across all projects in the org. This page
        shows all providers available to this project.
      </Alert>

      {orgProviders.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color='text.secondary'>
              No providers configured for this org.
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
              {orgProviders.map((provider) => (
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

export default ProjectProviders
