import { toast } from 'sonner'
import { nav } from '@TAF/services/nav'
import { useNavigate } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { useState, useEffect } from 'react'
import { styled } from '@mui/material/styles'
import { Button, ConfirmDelete } from '@tdsk/components'
import { AgentDrawer } from '@TAF/components/Agents/AgentDrawer'
import { deleteAgent } from '@TAF/actions/agents/api/deleteAgent'
import { fetchAgents } from '@TAF/actions/agents/api/fetchAgents'
import { AgentSection } from '@TAF/components/Agents/AgentSection'
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
import { Box, Card, Chip, Stack, Typography, CardContent } from '@mui/material'

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
            label={agent.active ? `Active` : `Inactive`}
            color={agent.active ? `success` : `default`}
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
          Icon={<ThreadsIcon />}
          onClick={onThreads}
          sx={{
            color: `text.disabled`,
            [`&:hover`]: {
              color: `primary.main`,
              backgroundColor: `transparent`,
            },
          }}
        >
          Threads
        </Button>
        <Button
          variant='text'
          Icon={<EditIcon />}
          onClick={onEditClick}
          sx={{
            color: `text.disabled`,
            [`&:hover`]: {
              color: `warning.main`,
              backgroundColor: `transparent`,
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
            color: `text.disabled`,
            [`&:hover`]: {
              color: `error.main`,
              backgroundColor: `transparent`,
            },
          }}
        >
          Delete
        </Button>
      </Box>

      <AgentSection
        title='Agent Information'
        description={agent.description}
      >
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
      </AgentSection>

      <AgentSection title='LLM Configuration'>
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
      </AgentSection>

      {(agent.systemPrompt && (
        <AgentSection title='System Prompt'>
          <Box
            component='pre'
            sx={{
              p: 2,
              borderRadius: 1,
              overflow: 'auto',
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              bgcolor: 'background.default',
            }}
          >
            {agent.systemPrompt}
          </Box>
        </AgentSection>
      )) ||
        null}

      <AgentSection
        title={`Tools${agent.tools?.length ? ` (${agent.tools.length})` : ''}`}
      >
        {agent.tools && agent.tools.length > 0 ? (
          <Stack
            useFlexGap
            spacing={1}
            flexWrap='wrap'
            direction='row'
          >
            {agent.tools.map((tool) => {
              return (
                (tool && (
                  <Chip
                    key={tool}
                    size='small'
                    label={tool}
                    variant='outlined'
                  />
                )) ||
                null
              )
            })}
          </Stack>
        ) : (
          <Typography color='text.secondary'>No tools configured</Typography>
        )}
      </AgentSection>

      <AgentSection
        title={`Secrets${agent.secrets?.length ? ` (${agent.secrets.length})` : ''}`}
      >
        {agent.secrets && agent.secrets.length > 0 ? (
          <Stack
            useFlexGap
            spacing={1}
            direction='row'
            flexWrap='wrap'
          >
            {agent.secrets.map((secret) => {
              return (
                (secret?.id && (
                  <Chip
                    size='small'
                    color='primary'
                    key={secret.id}
                    variant='outlined'
                    label={secret.name || secret.hashKey}
                  />
                )) ||
                null
              )
            })}
          </Stack>
        ) : (
          <Typography color='text.secondary'>No secrets configured</Typography>
        )}
      </AgentSection>

      {envVarKeys.length > 0 && (
        <AgentSection title={`Environment Variables (${envVarKeys.length})`}>
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
        </AgentSection>
      )}

      {agent.projects && agent.projects.length > 0 && (
        <AgentSection title={`Linked Projects (${agent.projects.length})`}>
          <Stack
            useFlexGap
            spacing={1}
            flexWrap='wrap'
            direction='row'
          >
            {agent.projects.map((project) => {
              return (
                (project?.id && (
                  <Chip
                    clickable
                    size='small'
                    key={project.id}
                    variant='outlined'
                    label={project.name}
                    onClick={() => nav.to(`/orgs/${orgId}/projects/${project.id}`)}
                  />
                )) ||
                null
              )
            })}
          </Stack>
        </AgentSection>
      )}

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

export default ProjectAgent
