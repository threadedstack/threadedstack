import { useNavigate } from 'react-router'
import { useEffect, useState } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { fetchOrgs } from '@TAF/actions/orgs'
import { setActiveOrgId } from '@TAF/state/accessors'
import { useOrgs, useActiveOrgId } from '@TAF/state/selectors'
import { CreateOrgDialog } from '@TAF/pages/Orgs/CreateOrgDialog'
import {
  Add as AddIcon,
  Group as OrgIcon,
  ArrowForward as SelectIcon,
} from '@mui/icons-material'
import {
  Box,
  Grid,
  Card,
  Chip,
  Button,
  Tooltip,
  useTheme,
  IconButton,
  Typography,
  CardContent,
  CardActions,
} from '@mui/material'

export type THome = {}

export const Home = (props: THome) => {
  const navigate = useNavigate()
  const theme = useTheme()
  const [orgs] = useOrgs()
  const [activeOrgId] = useActiveOrgId()
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  useEffect(() => {
    const loadOrgs = async () => {
      setLoading(true)
      await fetchOrgs()
      setLoading(false)
    }
    loadOrgs()
  }, [])

  const handleSelectOrg = (orgId: string) => {
    setActiveOrgId(orgId)
    navigate(`/orgs/${orgId}`)
  }

  const handleCreateClick = () => {
    setCreateDialogOpen(true)
  }

  const orgsArray = orgs ? Object.values(orgs) : []

  return (
    <Page className='tdsk-home-page'>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant='h4'
          component='h1'
          gutterBottom
        >
          Your Organizations
        </Typography>
        <Typography color='text.secondary'>
          Choose an organization to continue or create a new one
        </Typography>
      </Box>

      {loading && (
        <Card>
          <CardContent>
            <Typography align='center'>Loading...</Typography>
          </CardContent>
        </Card>
      )}

      {!loading && orgsArray.length === 0 && (
        <Card>
          <CardContent>
            <Typography
              color='text.secondary'
              align='center'
              sx={{ mb: 2 }}
            >
              No organizations yet. Create your first organization to get started.
            </Typography>
          </CardContent>
          <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
            <Button
              color='primary'
              variant='contained'
              startIcon={<AddIcon />}
              onClick={handleCreateClick}
            >
              Create
            </Button>
          </CardActions>
        </Card>
      )}

      {!loading && orgsArray.length > 0 && (
        <>
          <Grid
            container
            spacing={3}
          >
            {orgsArray.map((org) => {
              const isActiveOrg = org.id === activeOrgId
              return (
                <Grid
                  item
                  xs={12}
                  sm={6}
                  md={4}
                  key={org.id}
                >
                  <Card
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      border: isActiveOrg
                        ? `2px solid ${theme.palette.primary.main}`
                        : '1px solid rgba(0, 0, 0, 0.12)',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 3,
                      },
                    }}
                    onClick={() => handleSelectOrg(org.id)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <OrgIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography
                          variant='h6'
                          component='h2'
                          sx={{ flexGrow: 1 }}
                        >
                          {org.name}
                        </Typography>
                        {isActiveOrg && (
                          <Chip
                            label='Current'
                            color='primary'
                            size='small'
                          />
                        )}
                      </Box>
                      <Typography
                        color='text.secondary'
                        variant='body2'
                        sx={{ mb: 1 }}
                      >
                        {org.description || 'No description'}
                      </Typography>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                      >
                        ID: {org.id}
                      </Typography>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                      <Tooltip title={isActiveOrg ? 'Continue with Org' : 'Select Org'}>
                        <IconButton
                          size='small'
                          color='primary'
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectOrg(org.id)
                          }}
                        >
                          <SelectIcon />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              )
            })}
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              color='primary'
              variant='outlined'
              startIcon={<AddIcon />}
              onClick={handleCreateClick}
            >
              Create New
            </Button>
          </Box>
        </>
      )}

      <CreateOrgDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Page>
  )
}

export default Home
