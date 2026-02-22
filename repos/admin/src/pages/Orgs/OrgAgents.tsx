import { toast } from 'sonner'
import type { Agent } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { Page } from '@TAF/pages/Page/Page'
import { ConfirmDelete } from '@tdsk/components'
import { useState, useEffect, useMemo } from 'react'
import { AgentDrawer } from '@TAF/components/Agents/AgentDrawer'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { fetchAgents } from '@TAF/actions/agents/api/fetchAgents'
import { deleteAgent } from '@TAF/actions/agents/api/deleteAgent'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import { fetchProviders } from '@TAF/actions/providers'
import { useActiveOrgId, useOrgAgents, useProviders } from '@TAF/state/selectors'
import { Box, Chip, Typography } from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  SmartToy as AgentIcon,
} from '@mui/icons-material'

export type TOrgAgents = {}

export const OrgAgents = (props: TOrgAgents) => {
  const [agents] = useOrgAgents()
  const [orgId] = useActiveOrgId()
  const [providers] = useProviders()
  const [loading, setLoading] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null)

  useEffect(() => {
    orgId && fetchAgents({ orgId })
  }, [orgId])

  useEffect(() => {
    orgId && fetchProviders({ orgId })
  }, [orgId])

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
      await deleteAgent({ orgId, id: agentToDelete.id })

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

  if (!orgId) return null

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
      id: 'projects',
      label: 'Projects',
      render: (agent) => (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {agent.projects?.length > 0 ? (
            agent.projects.map((project) => (
              <Chip
                key={project.id}
                label={project.name}
                size='small'
                variant='outlined'
              />
            ))
          ) : (
            <Typography
              variant='body2'
              color='text.secondary'
            >
              -
            </Typography>
          )}
        </Box>
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
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (agent) => (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
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
            tooltip='Delete agent'
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
    <Page className='tdsk-org-agents-page'>
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
            onRowClick={onOpenEdit}
          />
        )}

        {orgId && (
          <AgentDrawer
            orgId={orgId}
            open={drawerOpen}
            agent={editingAgent}
            onSuccess={onSuccess}
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

export default OrgAgents
