import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { ConfirmDelete } from '@tdsk/components'
import { nav } from '@TAF/services/nav'
import { AgentDrawer } from '@TAF/components/Agents/AgentDrawer'
import { deleteAgent } from '@TAF/actions/agents/api/deleteAgent'
import { fetchAgents } from '@TAF/actions/agents/api/fetchAgents'
import {
  useAgents,
  useActiveOrgId,
  useActiveAgent,
  useActiveAgentId,
  useActiveProjectId,
} from '@TAF/state/selectors'
import {
  Edit as EditIcon,
  Chat as ChatIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  AutoAwesome as AgentIcon,
  ForumOutlined as ThreadsIcon,
} from '@mui/icons-material'
import {
  Box,
  Card,
  Chip,
  Stack,
  Button,
  Divider,
  Typography,
  CardContent,
} from '@mui/material'

export type TProjectAgent = {}

export const ProjectAgent = (props: TProjectAgent) => {
  const navigate = useNavigate()
  const [agents] = useAgents()
  const [orgId] = useActiveOrgId()
  const [agent] = useActiveAgent()
  const [agentId] = useActiveAgentId()
  const [projectId] = useActiveProjectId()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  useEffect(() => {
    if (orgId && projectId && !agents) fetchAgents({ orgId, projectId })
  }, [orgId, projectId, agents])

  const agentsPath = `/orgs/${orgId}/projects/${projectId}/agents`

  const onBack = () => navigate(agentsPath)

  const onChat = () => nav.to(`${agentsPath}/${agentId}/chat`)

  const onThreads = () => nav.to(`${agentsPath}/${agentId}/threads`)

  const onEditClick = () => setDrawerOpen(true)
  const onCloseDrawer = () => setDrawerOpen(false)
  const onEditSuccess = () => toast.success(`Agent updated successfully`)

  const onDeleteClick = () => setDeleteDialogOpen(true)
  const onDeleteCancel = () => setDeleteDialogOpen(false)

  const onDelete = async () => {
    if (!agent || !agentId) return
    const result = await deleteAgent({ orgId, id: agentId, projectId })
    if (!result.error) {
      toast.success(`Agent deleted successfully`)
      navigate(agentsPath)
    }
    setDeleteDialogOpen(false)
  }

  if (!agent) {
    return (
      <Page className='tdsk-project-agent-page'>
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

  const envVarKeys = Object.keys(agent.envVars || {})

  return (
    <Page className='tdsk-project-agent-page'>
      <Box
        sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}
      >
        <AgentIcon sx={{ color: 'text.secondary', fontSize: 32 }} />
        <Typography
          variant='h4'
          component='h1'
          sx={{ flex: 1 }}
        >
          {agent.name}
        </Typography>
        <Chip
          label={agent.active ? 'Active' : 'Inactive'}
          color={agent.active ? 'success' : 'default'}
          size='small'
        />
        <Button
          variant='contained'
          startIcon={<ChatIcon />}
          onClick={onChat}
        >
          Chat
        </Button>
        <Button
          variant='outlined'
          startIcon={<ThreadsIcon />}
          onClick={onThreads}
        >
          Threads
        </Button>
        <Button
          variant='outlined'
          startIcon={<EditIcon />}
          onClick={onEditClick}
        >
          Edit
        </Button>
        <Button
          color='error'
          variant='outlined'
          startIcon={<DeleteIcon />}
          onClick={onDeleteClick}
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
            Agent Information
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {agent.description && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Description
              </Typography>
              <Typography variant='body1'>{agent.description}</Typography>
            </Box>
          )}

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Agent ID
            </Typography>
            <Typography
              variant='body2'
              fontFamily='monospace'
            >
              {agent.id}
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
              {agent.orgId}
            </Typography>
          </Box>

          {agent.createdAt && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Created At
              </Typography>
              <Typography variant='body2'>
                {new Date(agent.createdAt).toLocaleString()}
              </Typography>
            </Box>
          )}

          {agent.updatedAt && (
            <Box>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Last Updated
              </Typography>
              <Typography variant='body2'>
                {new Date(agent.updatedAt).toLocaleString()}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography
            variant='h6'
            gutterBottom
          >
            LLM Configuration
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {agent.provider && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Provider
              </Typography>
              <Typography variant='body1'>{agent.provider.name}</Typography>
            </Box>
          )}

          {agent.model && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Model
              </Typography>
              <Typography variant='body1'>{agent.model}</Typography>
            </Box>
          )}

          {agent.maxTokens != null && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Max Tokens
              </Typography>
              <Typography variant='body1'>{agent.maxTokens.toLocaleString()}</Typography>
            </Box>
          )}

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Temperature
            </Typography>
            <Typography variant='body1'>
              {agent.environment?.temperature ?? 'Default'}
            </Typography>
          </Box>

          <Box>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Streaming
            </Typography>
            <Chip
              size='small'
              sx={{ mt: 0.5 }}
              label={agent.environment?.streaming ? 'Enabled' : 'Disabled'}
              color={agent.environment?.streaming ? 'success' : 'default'}
            />
          </Box>
        </CardContent>
      </Card>

      {agent.systemPrompt && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography
              variant='h6'
              gutterBottom
            >
              System Prompt
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
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {agent.systemPrompt}
            </Box>
          </CardContent>
        </Card>
      )}

      {agent.tools && agent.tools.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography
              variant='h6'
              gutterBottom
            >
              Tools ({agent.tools.length})
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack
              direction='row'
              spacing={1}
              flexWrap='wrap'
              useFlexGap
            >
              {agent.tools.map((tool) => (
                <Chip
                  key={tool}
                  label={tool}
                  size='small'
                  variant='outlined'
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {agent.secrets && agent.secrets.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography
              variant='h6'
              gutterBottom
            >
              Secrets ({agent.secrets.length})
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack
              direction='row'
              spacing={1}
              flexWrap='wrap'
              useFlexGap
            >
              {agent.secrets.map((secret) => (
                <Chip
                  key={secret.id}
                  label={secret.name || secret.hashKey}
                  size='small'
                  variant='outlined'
                  color='primary'
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {envVarKeys.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography
              variant='h6'
              gutterBottom
            >
              Environment Variables ({envVarKeys.length})
            </Typography>
            <Divider sx={{ mb: 2 }} />
            {envVarKeys.map((key) => (
              <Box
                key={key}
                sx={{ mb: 1.5 }}
              >
                <Typography
                  variant='subtitle2'
                  color='text.secondary'
                >
                  {key}
                </Typography>
                <Typography
                  variant='body2'
                  fontFamily='monospace'
                >
                  {agent.envVars[key]}
                </Typography>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {agent.projects && agent.projects.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography
              variant='h6'
              gutterBottom
            >
              Linked Projects ({agent.projects.length})
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack
              direction='row'
              spacing={1}
              flexWrap='wrap'
              useFlexGap
            >
              {agent.projects.map((project) => (
                <Chip
                  key={project.id}
                  label={project.name}
                  size='small'
                  variant='outlined'
                  clickable
                  onClick={() => nav.to(`/orgs/${orgId}/projects/${project.id}`)}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      {orgId && projectId && (
        <AgentDrawer
          orgId={orgId}
          open={drawerOpen}
          agent={agent}
          onSuccess={onEditSuccess}
          projectId={projectId}
          onClose={onCloseDrawer}
        />
      )}

      <ConfirmDelete
        open={deleteDialogOpen}
        title='Delete Agent?'
        itemName={agent.name}
        onCancel={onDeleteCancel}
        onConfirm={onDelete}
        warnText='This will permanently delete this agent and all its threads, messages, and configuration.'
      />
    </Page>
  )
}

export default ProjectAgent
