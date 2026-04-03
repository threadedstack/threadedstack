import type { TEndpointDetailTab } from '@TAF/types'

import { toast } from 'sonner'
import { useState } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { EEndpointDetailTab, ERoutePath } from '@TAF/types'
import { Button, ConfirmDelete } from '@tdsk/components'
import { capitalize } from '@keg-hub/jsutils/capitalize'
import { getActiveTab } from '@TAF/utils/endpoints/getActiveTab'
import { EndpointDrawer } from '@TAF/components/Endpoints/EndpointDrawer'
import { deleteEndpoint } from '@TAF/actions/endpoints/api/deleteEndpoint'
import { getConfigTabLabel } from '@TAF/utils/endpoints/getConfigTabLabel'
import { buildNavRoute } from '@TAF/utils/nav/buildRoute'
import { Outlet, useParams, useNavigate, useLocation } from 'react-router'
import { EndpointBreadcrumbs } from '@TAF/components/Endpoints/EndpointBreadcrumbs'
import { Box, Tab, Tabs, Card, Chip, Typography, CardContent } from '@mui/material'
import {
  useActiveOrgId,
  useActiveEndpoint,
  useActiveProjectId,
  useEndpointTabsDisabled,
} from '@TAF/state/selectors'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  Api as EndpointIcon,
} from '@mui/icons-material'

export const EndpointLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { endpointId } = useParams<{ endpointId: string }>()

  const [orgId] = useActiveOrgId()
  const [endpoint] = useActiveEndpoint()
  const [projectId] = useActiveProjectId()
  const [tabsDisabled] = useEndpointTabsDisabled()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const navCtx = { orgId, projectId, endpointId }
  const endpointsPath = buildNavRoute({ orgId, projectId }, ERoutePath.ProjectEndpoints)
  const endpointPath = buildNavRoute(navCtx, ERoutePath.ProjectEndpoint)

  const activeTab = getActiveTab(location.pathname)

  const tabRoutes: Record<string, string> = {
    [EEndpointDetailTab.config]: buildNavRoute(navCtx, ERoutePath.ProjectEndpointConfig),
    [EEndpointDetailTab.test]: buildNavRoute(navCtx, ERoutePath.ProjectEndpointTest),
  }

  const onTabChange = (_: React.SyntheticEvent, val: TEndpointDetailTab) => {
    navigate(tabRoutes[val] || endpointPath)
  }

  const onBack = () => navigate(endpointsPath)
  const onEditClick = () => setDrawerOpen(true)
  const onCloseDrawer = () => setDrawerOpen(false)
  const onDeleteClick = () => setDeleteDialogOpen(true)
  const onDeleteCancel = () => setDeleteDialogOpen(false)
  const onEditSuccess = () => toast.success(`Endpoint updated successfully`)

  const onDelete = async () => {
    if (!endpoint || !endpointId) return
    const result = await deleteEndpoint({ orgId, id: endpointId, projectId })
    if (result.error) {
      toast.error(`Failed to delete endpoint`, {
        description: result.error.message || `Please try again.`,
      })
      setDeleteDialogOpen(false)
      return
    }
    toast.success(`Endpoint deleted successfully`)
    setDeleteDialogOpen(false)
    navigate(endpointsPath)
  }

  if (!endpoint) {
    return (
      <Page className='tdsk-endpoint-layout-page'>
        <Card>
          <CardContent>
            <Typography color='error'>Endpoint not found</Typography>
            <Button
              sx={{ mt: 2 }}
              startIcon={<BackIcon />}
              onClick={onBack}
            >
              Back to Endpoints
            </Button>
          </CardContent>
        </Card>
      </Page>
    )
  }

  return (
    <Page className='tdsk-endpoint-layout-page'>
      <Box sx={{ mb: 2 }}>
        <EndpointBreadcrumbs />
      </Box>

      <Box
        sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
      >
        <EndpointIcon sx={{ color: 'text.secondary', fontSize: 32 }} />
        <Typography
          variant='h4'
          component='h1'
          noWrap
          sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {endpoint.name}
          <Chip
            size='small'
            sx={{ ml: 2 }}
            label={capitalize(endpoint.type)}
            color='primary'
          />
          <Chip
            size='small'
            sx={{ ml: 1 }}
            label={(endpoint.method || 'get').toUpperCase()}
            color='default'
          />
          <Chip
            size='small'
            sx={{ ml: 1 }}
            label={endpoint.public ? 'Public' : 'Private'}
            color={endpoint.public ? 'success' : 'default'}
          />
        </Typography>
        <Button
          variant='text'
          Icon={<EditIcon />}
          onClick={onEditClick}
          sx={{
            color: 'text.disabled',
            '&:hover': {
              color: 'warning.main',
              backgroundColor: 'transparent',
            },
          }}
        >
          Edit
        </Button>
        <Button
          color='error'
          variant='text'
          onClick={onDeleteClick}
          Icon={<DeleteIcon />}
          sx={{
            color: 'text.disabled',
            '&:hover': {
              color: 'error.main',
              backgroundColor: 'transparent',
            },
          }}
        >
          Delete
        </Button>
      </Box>

      <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={onTabChange}
        >
          <Tab
            label='Endpoint'
            value={EEndpointDetailTab.endpoint}
          />
          <Tab
            disabled={tabsDisabled}
            value={EEndpointDetailTab.config}
            label={getConfigTabLabel(endpoint.type)}
          />
          <Tab
            label='Test'
            disabled={tabsDisabled}
            value={EEndpointDetailTab.test}
          />
        </Tabs>
      </Box>

      <Outlet />

      {orgId && projectId && (
        <EndpointDrawer
          endpoint={endpoint}
          orgId={orgId}
          open={drawerOpen}
          projectId={projectId}
          onClose={onCloseDrawer}
          onSuccess={onEditSuccess}
        />
      )}

      <ConfirmDelete
        title='Delete Endpoint?'
        onConfirm={onDelete}
        itemName={endpoint.name}
        open={deleteDialogOpen}
        onCancel={onDeleteCancel}
        warnText='This will permanently delete this endpoint and all its configuration.'
      />
    </Page>
  )
}

export default EndpointLayout
