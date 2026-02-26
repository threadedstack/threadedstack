import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { Outlet, useParams, useNavigate, useLocation } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { Button, ConfirmDelete } from '@tdsk/components'
import { AgentDrawer } from '@TAF/components/Agents/AgentDrawer'
import { AgentBreadcrumbs } from '@TAF/components/Agents/AgentBreadcrumbs'
import { deleteAgent } from '@TAF/actions/agents/api/deleteAgent'
import { fetchAgents } from '@TAF/actions/agents/api/fetchAgents'
import { EAgentDetailTab } from '@TAF/types'
import type { TAgentDetailTab } from '@TAF/types'
import {
  useProjectAgents,
  useActiveOrgId,
  useActiveAgent,
  useActiveAgentId,
  useActiveProjectId,
  useActiveThreadId,
} from '@TAF/state/selectors'
import {
  Edit as EditIcon,
  Chat as ChatIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  AutoAwesome as AgentIcon,
} from '@mui/icons-material'
import { Box, Tab, Tabs, Card, Chip, Typography, CardContent } from '@mui/material'

export const AgentLayout = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { agentId, threadId } = useParams<{ agentId: string; threadId: string }>()

  const [agents] = useProjectAgents()
  const [orgId] = useActiveOrgId()
  const [agent] = useActiveAgent()
  const [, setActiveAgentId] = useActiveAgentId()
  const [projectId] = useActiveProjectId()
  const [, setActiveThreadId] = useActiveThreadId()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  // Sync URL params to Jotai state (fixes caching bug)
  useEffect(() => {
    if (agentId) setActiveAgentId(agentId)
  }, [agentId])

  useEffect(() => {
    if (threadId) setActiveThreadId(threadId)
  }, [threadId])

  // Fetch agents if not loaded
  useEffect(() => {
    if (orgId && projectId && !agents) fetchAgents({ orgId, projectId })
  }, [orgId, projectId, agents])

  const agentsPath = `/orgs/${orgId}/projects/${projectId}/agents`
  const agentPath = `${agentsPath}/${agentId}`

  // Determine active tab from URL
  const pathAfterAgent = location.pathname.replace(agentPath, '')
  const showTabs = !threadId && !pathAfterAgent.includes('/chat')
  const activeTab: TAgentDetailTab = pathAfterAgent.startsWith('/threads')
    ? EAgentDetailTab.threads
    : EAgentDetailTab.agent

  const onTabChange = (_: React.SyntheticEvent, val: TAgentDetailTab) => {
    if (val === EAgentDetailTab.threads) {
      navigate(`${agentPath}/threads`)
    } else {
      navigate(agentPath)
    }
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
