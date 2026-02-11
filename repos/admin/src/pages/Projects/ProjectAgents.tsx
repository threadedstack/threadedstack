import { toast } from 'sonner'
import type { Agent } from '@tdsk/domain'
import { Page } from '@TAF/pages/Page/Page'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { useState, useEffect } from 'react'
import { ConfirmDelete } from '@tdsk/components'
import { AgentDrawer } from '@TAF/components/Agents/AgentDrawer'
import { fetchAgents } from '@TAF/actions/agents/api/fetchAgents'
import { deleteAgent } from '@TAF/actions/agents/api/deleteAgent'
import { useActiveOrgId, useActiveProjectId, useAgents } from '@TAF/state/selectors'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import {
  Box,
  Card,
  Chip,
  Stack,
  IconButton,
  Typography,
  CardContent,
  CardActions,
} from '@mui/material'

export type TProjectAgents = {}

export const ProjectAgents = (props: TProjectAgents) => {
  const [agents] = useAgents()
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null)

  useEffect(() => {
    orgId && projectId && fetchAgents({ orgId, projectId })
  }, [orgId, projectId])

  const onOpenCreate = () => {
    setEditingAgent(null)
    setDrawerOpen(true)
  }

  const onOpenEdit = (agent: Agent) => {
    setEditingAgent(agent)
    setDrawerOpen(true)
  }

  const onCloseDrawer = () => {
    setDrawerOpen(false)
    setEditingAgent(null)
  }

  const onSuccess = () => {
    toast.success(
      editingAgent ? `Agent updated successfully` : `Agent created successfully`
    )
  }

  const onDeleteClick = (agent: Agent) => {
    setAgentToDelete(agent)
    setDeleteDialogOpen(true)
  }

  const onDeleteConfirm = async () => {
    if (!agentToDelete) return

    try {
      setLoading(true)
      await deleteAgent({ orgId, id: agentToDelete.id, projectId })

      setAgentToDelete(null)
      setDeleteDialogOpen(false)
      toast.success(`Agent deleted successfully`)
    } catch (error) {
      toast.error(`Failed to delete agent`)
      console.error(`onDelete error:`, error)
    } finally {
      setLoading(false)
    }
  }

  if (!orgId || !projectId) return null

  const agentsList = Object.values(agents || {}).filter((agent) => agent.orgId === orgId)

  return (
    <Page className='tdsk-project-agents-page'>
      <PageLayout
        title='AI Agents'
        countLabel='agent'
        count={agentsList.length}
        onAction={onOpenCreate}
        actionLabel='Create Agent'
      >
        {agentsList.length === 0 && (
          <EmptyState
            actionIcon={<AddIcon />}
            onAction={onOpenCreate}
            actionLabel='Create Agent'
            message='No agents yet. Create your first AI agent to get started.'
          />
        )}

        {agentsList.length > 0 && (
          <Stack spacing={2}>
            {agentsList.map((agent) => (
              <Card key={agent.id}>
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      mb: 2,
                    }}
                  >
                    <Box>
                      <Typography
                        variant='h6'
                        gutterBottom
                      >
                        {agent.name}
                      </Typography>
                      {agent.description && (
                        <Typography
                          variant='body2'
                          color='text.secondary'
                        >
                          {agent.description}
                        </Typography>
                      )}
                    </Box>
                    <Stack
                      direction='row'
                      spacing={1}
                    >
                      <Chip
                        label={agent.active ? 'Active' : 'Inactive'}
                        color={agent.active ? 'success' : 'default'}
                        size='small'
                      />
                      {agent.providerId && (
                        <Chip
                          label={agent.providerId}
                          variant='outlined'
                          size='small'
                        />
                      )}
                    </Stack>
                  </Box>

                  <Stack
                    spacing={2}
                    sx={{ mt: 2 }}
                  >
                    {agent.model && (
                      <Box>
                        <Typography
                          variant='caption'
                          color='text.secondary'
                        >
                          Model
                        </Typography>
                        <Typography variant='body2'>{agent.model}</Typography>
                      </Box>
                    )}

                    {agent.systemPrompt && (
                      <Box>
                        <Typography
                          variant='caption'
                          color='text.secondary'
                        >
                          System Prompt
                        </Typography>
                        <Typography
                          variant='body2'
                          sx={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {agent.systemPrompt}
                        </Typography>
                      </Box>
                    )}

                    {agent.tools && agent.tools.length > 0 && (
                      <Box>
                        <Typography
                          variant='caption'
                          color='text.secondary'
                          gutterBottom
                          display='block'
                        >
                          Tools ({agent.tools.length})
                        </Typography>
                        <Stack
                          direction='row'
                          spacing={1}
                          flexWrap='wrap'
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
                      </Box>
                    )}

                    {agent.secrets && agent.secrets.length > 0 && (
                      <Box>
                        <Typography
                          variant='caption'
                          color='text.secondary'
                          gutterBottom
                          display='block'
                        >
                          Secrets ({agent.secrets.length})
                        </Typography>
                        <Stack
                          direction='row'
                          spacing={1}
                          flexWrap='wrap'
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
                      </Box>
                    )}

                    {agent.envVars && Object.keys(agent.envVars).length > 0 && (
                      <Box>
                        <Typography
                          variant='caption'
                          color='text.secondary'
                          gutterBottom
                          display='block'
                        >
                          Environment Variables ({Object.keys(agent.envVars).length})
                        </Typography>
                        <Stack
                          direction='row'
                          spacing={1}
                          flexWrap='wrap'
                        >
                          {Object.keys(agent.envVars).map((key) => (
                            <Chip
                              key={key}
                              label={key}
                              size='small'
                              variant='outlined'
                            />
                          ))}
                        </Stack>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
                <CardActions>
                  <IconButton
                    size='small'
                    onClick={() => onOpenEdit(agent)}
                  >
                    <EditIcon fontSize='small' />
                  </IconButton>
                  <IconButton
                    size='small'
                    color='error'
                    onClick={() => onDeleteClick(agent)}
                  >
                    <DeleteIcon fontSize='small' />
                  </IconButton>
                </CardActions>
              </Card>
            ))}
          </Stack>
        )}

        {orgId && projectId && (
          <AgentDrawer
            orgId={orgId}
            open={drawerOpen}
            agent={editingAgent}
            onSuccess={onSuccess}
            projectId={projectId}
            onClose={onCloseDrawer}
          />
        )}

        <ConfirmDelete
          open={deleteDialogOpen}
          itemName={agentToDelete?.name || 'Agent'}
          onCancel={() => {
            setDeleteDialogOpen(false)
            setAgentToDelete(null)
          }}
          onConfirm={onDeleteConfirm}
          warnText='This will permanently delete this agent and all its configuration.'
        />
      </PageLayout>
    </Page>
  )
}

export default ProjectAgents
