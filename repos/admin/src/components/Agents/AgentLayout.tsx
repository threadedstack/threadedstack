import type { TAgentDetailTab } from '@TAF/types'

import { toast } from 'sonner'
import { useState } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { EAgentDetailTab } from '@TAF/types'
import { isFeatureEnabled } from '@tdsk/domain'
import { Button, ConfirmDelete } from '@tdsk/components'
import { AgentDrawer } from '@TAF/components/Agents/AgentDrawer'
import { deleteAgent } from '@TAF/actions/agents/api/deleteAgent'
import { Outlet, useParams, useNavigate, useLocation } from 'react-router'
import { AgentBreadcrumbs } from '@TAF/components/Agents/AgentBreadcrumbs'
import { Box, Tab, Tabs, Card, Chip, Typography, CardContent } from '@mui/material'
import { useActiveOrgId, useActiveAgent, useActiveProjectId } from '@TAF/state/selectors'
import {
  Edit as EditIcon,
  Chat as ChatIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  AutoAwesome as AgentIcon,
} from '@mui/icons-material'

export const AgentLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { agentId, threadId } = useParams<{ agentId: string; threadId: string }>()

  const [orgId] = useActiveOrgId()
  const [agent] = useActiveAgent()
  const [projectId] = useActiveProjectId()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const agentsPath = `/orgs/${orgId}/projects/${projectId}/agents`
  const agentPath = `${agentsPath}/${agentId}`

  // Determine active tab from URL
  const pathAfterAgent = location.pathname.replace(agentPath, ``)
  const showTabs = !threadId && !pathAfterAgent.includes(`/chat`)
  const activeTab: TAgentDetailTab = pathAfterAgent.startsWith(`/threads`)
    ? EAgentDetailTab.threads
    : pathAfterAgent.startsWith(`/skills`) && isFeatureEnabled('skills')
      ? EAgentDetailTab.skills
      : pathAfterAgent.startsWith(`/schedules`) && isFeatureEnabled('schedules')
        ? EAgentDetailTab.schedules
        : EAgentDetailTab.agent

  const tabRoutes: Record<string, string> = {
    [EAgentDetailTab.threads]: `${agentPath}/threads`,
    ...(isFeatureEnabled('skills') && {
      [EAgentDetailTab.skills]: `${agentPath}/skills`,
    }),
    ...(isFeatureEnabled('schedules') && {
      [EAgentDetailTab.schedules]: `${agentPath}/schedules`,
    }),
  }

  const onTabChange = (_: React.SyntheticEvent, val: TAgentDetailTab) => {
    navigate(tabRoutes[val] || agentPath)
  }

  const onBack = () => navigate(agentsPath)
  const onChat = () => navigate(`${agentPath}/chat`)
  const onEditClick = () => setDrawerOpen(true)
  const onCloseDrawer = () => setDrawerOpen(false)
  const onEditSuccess = () => toast.success('Agent updated successfully')
  const onDeleteClick = () => setDeleteDialogOpen(true)
  const onDeleteCancel = () => setDeleteDialogOpen(false)

  const onDelete = async () => {
    if (!agent || !agentId) return
    const result = await deleteAgent({ orgId, id: agentId, projectId })
    if (!result.error) {
      toast.success('Agent deleted successfully')
      navigate(agentsPath)
    }
    setDeleteDialogOpen(false)
  }

  if (!agent) {
    return (
      <Page className='tdsk-agent-layout-page'>
        <Card>
          <CardContent>
            <Typography color='error'>Agent not found</Typography>
            <Button
              sx={{ mt: 2 }}
              startIcon={<BackIcon />}
              onClick={onBack}
            >
              Back to Agents
            </Button>
          </CardContent>
        </Card>
      </Page>
    )
  }

  return (
    <Page className='tdsk-agent-layout-page'>
      <Box sx={{ mb: 2 }}>
        <AgentBreadcrumbs />
      </Box>

      <Box
        sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
      >
        <AgentIcon sx={{ color: 'text.secondary', fontSize: 32 }} />
        <Typography
          variant='h4'
          component='h1'
          noWrap
          sx={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {agent.name}
          <Chip
            size='small'
            sx={{ ml: 2 }}
            label={agent.active ? 'Active' : 'Inactive'}
            color={agent.active ? 'success' : 'default'}
          />
        </Typography>
        <Button
          variant='outlined'
          Icon={<ChatIcon />}
          onClick={onChat}
        >
          Chat
        </Button>
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

      {showTabs && (
        <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={onTabChange}
          >
            <Tab
              label='Agent'
              value={EAgentDetailTab.agent}
            />
            <Tab
              label='Threads'
              value={EAgentDetailTab.threads}
            />
            {isFeatureEnabled('skills') && (
              <Tab
                label='Skills'
                value={EAgentDetailTab.skills}
              />
            )}
            {isFeatureEnabled('schedules') && (
              <Tab
                label='Schedules'
                value={EAgentDetailTab.schedules}
              />
            )}
          </Tabs>
        </Box>
      )}

      <Outlet />

      {orgId && projectId && (
        <AgentDrawer
          agent={agent}
          orgId={orgId}
          open={drawerOpen}
          projectId={projectId}
          onClose={onCloseDrawer}
          onSuccess={onEditSuccess}
        />
      )}

      <ConfirmDelete
        title='Delete Agent?'
        onConfirm={onDelete}
        itemName={agent.name}
        open={deleteDialogOpen}
        onCancel={onDeleteCancel}
        warnText='This will permanently delete this agent and all its threads, messages, and configuration.'
      />
    </Page>
  )
}

export default AgentLayout
