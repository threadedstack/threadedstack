import { ERoutePath } from '@TAF/types'
import { Page } from '@TAF/pages/Page/Page'
import { useEffect, useState } from 'react'
import { useOrgs } from '@TAF/state/selectors'
import { useParams, useNavigate } from 'react-router'
import { setActiveOrgId } from '@TAF/state/accessors'
import { fetchOrg } from '@TAF/actions/orgs/api/fetchOrg'
import { deleteOrg } from '@TAF/actions/orgs/api/deleteOrg'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as AddMemberIcon,
} from '@mui/icons-material'
import { Box, Card, Button, Divider, Typography, CardContent } from '@mui/material'

export type TOrg = {}

export const Org = (props: TOrg) => {
  const [orgs] = useOrgs()
  const navigate = useNavigate()
  const { orgId } = useParams<{ orgId: string }>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orgId) {
      setActiveOrgId(orgId)
    }
  }, [orgId])

  useEffect(() => {
    const loadOrg = async () => {
      if (!orgId) return
      setLoading(true)
      await fetchOrg(orgId)
      setLoading(false)
    }
    loadOrg()
  }, [orgId])

  const org = orgId && orgs ? orgs[orgId] : undefined

  const onDelete = async () => {
    if (!org || !orgId) return
    if (!window.confirm(`Are you sure you want to delete org "${org.name}"?`)) {
      return
    }
    const result = await deleteOrg(orgId)
    !result.error && navigate(ERoutePath.Orgs)
  }

  if (loading) {
    return (
      <Page className='tdsk-org-page'>
        <Typography>Loading org...</Typography>
      </Page>
    )
  }

  if (!org) {
    return (
      <Page className='tdsk-org-page'>
        <Card>
          <CardContent>
            <Typography color='error'>Org not found</Typography>
            <Button
              onClick={() => navigate(ERoutePath.Orgs)}
              sx={{ mt: 2 }}
            >
              Back to Orgs
            </Button>
          </CardContent>
        </Card>
      </Page>
    )
  }

  return (
    <Page className='tdsk-org-page'>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography
          variant='h4'
          component='h1'
          sx={{ flex: 1 }}
        >
          {org.name}
        </Typography>
        <Button
          variant='outlined'
          startIcon={<EditIcon />}
        >
          Edit
        </Button>
        <Button
          variant='outlined'
          color='error'
          startIcon={<DeleteIcon />}
          onClick={onDelete}
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
            Org Information
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Name
            </Typography>
            <Typography variant='body1'>{org.name}</Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Description
            </Typography>
            <Typography variant='body1'>
              {org.description || 'No description provided'}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Org ID
            </Typography>
            <Typography
              variant='body2'
              fontFamily='monospace'
            >
              {org.id}
            </Typography>
          </Box>

          {org.createdAt && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Created At
              </Typography>
              <Typography variant='body2'>
                {new Date(org.createdAt).toLocaleString()}
              </Typography>
            </Box>
          )}

          {org.updatedAt && (
            <Box>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Last Updated
              </Typography>
              <Typography variant='body2'>
                {new Date(org.updatedAt).toLocaleString()}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant='h6'>Org Members</Typography>
            <Button
              variant='outlined'
              size='small'
              startIcon={<AddMemberIcon />}
              disabled
            >
              Add Member
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <Typography
            color='text.secondary'
            align='center'
          >
            Member management coming soon
          </Typography>
        </CardContent>
      </Card>
    </Page>
  )
}

export default Org
