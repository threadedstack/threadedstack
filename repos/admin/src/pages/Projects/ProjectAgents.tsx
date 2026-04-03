import { toast } from 'sonner'
import type { Agent } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { Page } from '@TAF/pages/Page/Page'
import { nav } from '@TAF/services/nav'
import { ConfirmDelete } from '@tdsk/components'
import { useState, useMemo } from 'react'
import { AgentDrawer } from '@TAF/components/Agents/AgentDrawer'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { deleteAgent } from '@TAF/actions/agents/api/deleteAgent'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  useActiveOrgId,
  useActiveProjectId,
  useProjectAgents,
  useProviders,
} from '@TAF/state/selectors'
import { Box, Chip, Typography } from '@mui/material'
import {
  Add as AddIcon,
  Chat as ChatIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  SmartToy as AgentIcon,
} from '@mui/icons-material'

export type TProjectAgents = {}

export const ProjectAgents = (props: TProjectAgents) => {
  const [agents] = useProjectAgents()
  const [orgId] = useActiveOrgId()
  const [providers] = useProviders()
  const [projectId] = useActiveProjectId()
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null)

  const getProviderName = (providerId: string) => {
    if (!providers || !providerId) return '-'
    const provider = providers[providerId]
    return provider?.name || '-'
  }

  const agentsList = useMemo(() => {
    const list = Object.values(agents || {})
    if (!searchQuery.trim()) return list

    const query = searchQuery.toLowerCase()
    return list.filter(
      (agent) =>
        agent.name?.toLowerCase().includes(query) ||
        agent.description?.toLowerCase().includes(query) ||
        agent.model?.toLowerCase().includes(query)
    )
  }, [agents, searchQuery])

  const totalCount = useMemo(() => Object.keys(agents || {}).length, [agents])

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
      toast.success(`Agent removed from project`)
    } catch (error) {
      toast.error(`Failed to remove agent`)
      console.error(`onDelete error:`, error)
    } finally {
      setLoading(false)
    }
  }

  const onRowClick = (agent: Agent) => {
    nav.to(`/orgs/${orgId}/projects/${projectId}/agents/${agent.id}`)
  }

  if (!orgId || !projectId) return null

  const columns: TDataTableColumn<Agent>[] = [
    {
      id: 'name',
      label: 'Name',
      render: (agent) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AgentIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Box>
            <Typography
              variant='body2'
              fontWeight='medium'
            >
              {agent.name}
            </Typography>
            {agent.description && (
              <Typography
                variant='caption'
                color='text.secondary'
                sx={{
                  display: 'block',
                  maxWidth: 300,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {agent.description}
              </Typography>
            )}
          </Box>
        </Box>
      ),
    },
    {
      id: 'provider',
      label: 'Provider',
      render: (agent) => (
        <Typography
          variant='body2'
          color='text.secondary'
        >
          {agent.primaryProvider?.name ||
            getProviderName(agent.providers?.[0]?.id) ||
            '-'}
        </Typography>
      ),
    },
    {
      id: 'model',
      label: 'Model',
      render: (agent) => (
        <Typography
          variant='body2'
          fontFamily='monospace'
          color='text.secondary'
          sx={{ fontSize: '0.75rem' }}
        >
          {agent.model || '-'}
        </Typography>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      render: (agent) => (
        <Chip
          label={agent.active ? 'Active' : 'Inactive'}
          size='small'
          color={agent.active ? 'success' : 'default'}
          variant={agent.active ? 'filled' : 'outlined'}
        />
      ),
    },
    {
      id: 'tools',
      label: 'Tools',
      render: (agent) => (
        <Typography
          variant='body2'
          color='text.secondary'
        >
          {agent.tools?.length || 0}
        </Typography>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (agent) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
          <ActionIconButton
            tooltip='Chat with agent'
            icon={<ChatIcon fontSize='small' />}
            size='small'
            color='info'
            onClick={(e) => {
              e.stopPropagation()
              nav.to(`/orgs/${orgId}/projects/${projectId}/agents/${agent.id}/chat`)
            }}
          />
          <ActionIconButton
            tooltip='Edit agent'
            icon={<EditIcon fontSize='small' />}
            size='small'
            color='primary'
            onClick={(e) => {
              e.stopPropagation()
              onOpenEdit(agent)
            }}
          />
          <ActionIconButton
            tooltip='Remove from project'
            icon={<DeleteIcon fontSize='small' />}
            size='small'
            color='error'
            onClick={(e) => {
              e.stopPropagation()
              onDeleteClick(agent)
            }}
          />
        </Box>
      ),
    },
  ]

  return (
    <Page className='tdsk-project-agents-page'>
      <PageLayout
        title='AI Agents'
        countLabel='agent'
        count={totalCount}
        loading={loading}
        query={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder='Search agents by name, description, or model...'
        searchCount={0}
        onAction={onOpenCreate}
        actionLabel='Create Agent'
      >
        {totalCount === 0 && (
          <EmptyState
            actionIcon={<AddIcon />}
            onAction={onOpenCreate}
            actionLabel='Create Agent'
            message='No agents yet. Create your first AI agent to get started.'
          />
        )}

        {totalCount > 0 && agentsList.length === 0 && (
          <EmptyState message='No agents match your search criteria.' />
        )}

        {agentsList.length > 0 && (
          <DataTable
            columns={columns}
            data={agentsList}
            getRowKey={(agent) => agent.id}
            onRowClick={onRowClick}
          />
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
          warnText='This will remove the agent from this project. The agent will remain available at the org level and in other projects.'
        />
      </PageLayout>
    </Page>
  )
}

export default ProjectAgents
