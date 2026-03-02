import type { Schedule } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { toast } from 'sonner'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { ConfirmDelete, Text } from '@tdsk/components'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { schedulesApi } from '@TAF/services/schedulesApi'
import { agentsApi } from '@TAF/services/agentsApi'
import { ScheduleDrawer } from '@TAF/components/Schedules/ScheduleDrawer'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import type { Agent } from '@tdsk/domain'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TriggerIcon,
  Timer as ScheduleIcon,
} from '@mui/icons-material'

export type TSchedules = {
  orgId?: string
  agentId?: string
}

const styles = {
  table: {
    actions: {
      box: {
        gap: 1.5,
        display: `flex`,
        alignItems: `center`,
        justifyContent: `end`,
      },
      icon: { fontSize: `16px` },
    },
  },
}

export const Schedules = (props: TSchedules) => {
  const { orgId, agentId } = props

  const [error, setError] = useState<Error>()
  const [loading, setLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [deleting, setDeleting] = useState<Schedule>()
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [agents, setAgents] = useState<Record<string, Agent>>({})
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)

  const fetchSchedules = useCallback(async () => {
    if (!orgId) return

    setLoading(true)
    setError(undefined)

    const resp = await schedulesApi.list(orgId)
    if (resp.error) {
      setError(resp.error instanceof Error ? resp.error : new Error(String(resp.error)))
    } else {
      setSchedules(resp.data || [])
    }

    setLoading(false)
  }, [orgId])

  const fetchAgents = useCallback(async () => {
    if (!orgId) return

    const resp = await agentsApi.list(orgId)
    if (resp.data) {
      const agentMap: Record<string, Agent> = {}
      for (const agent of resp.data) {
        agentMap[agent.id] = agent
      }
      setAgents(agentMap)
    }
  }, [orgId])

  useEffect(() => {
    fetchSchedules()
    fetchAgents()
  }, [fetchSchedules, fetchAgents])

  const onCreateSchedule = () => {
    setSelectedSchedule(null)
    setDialogOpen(true)
  }

  const onDialogClose = () => {
    setDialogOpen(false)
    setSelectedSchedule(null)
  }

  const onEditSchedule = (schedule: Schedule) => {
    setSelectedSchedule(schedule)
    setDialogOpen(true)
  }

  const onTrigger = async (schedule: Schedule) => {
    if (!orgId) return

    const resp = await schedulesApi.trigger(orgId, schedule.id)
    if (resp.error) {
      toast.error(`Failed to trigger schedule`)
    } else {
      toast.success(`Schedule triggered successfully`)
    }
  }

  const onRemove = async () => {
    if (!deleting || !orgId) return

    setLoading(true)
    setError(undefined)

    const result = await schedulesApi.delete(orgId, deleting.id)

    setLoading(false)
    setDeleting(undefined)
    dialogOpen && setDialogOpen(false)

    if (result.error) {
      setError(
        result.error instanceof Error ? result.error : new Error(String(result.error))
      )
    } else {
      await fetchSchedules()
    }
  }

  const onSuccess = async () => {
    await fetchSchedules()
  }

  const filteredSchedules = useMemo(() => {
    let filtered = schedules

    // Filter by agentId if provided (agent context)
    if (agentId) {
      filtered = filtered.filter((s) => s.agentId === agentId)
    }

    // Filter by search query
    if (!searchQuery.trim()) return filtered

    const query = searchQuery.toLowerCase()
    return filtered.filter(
      (schedule) =>
        schedule.prompt?.toLowerCase().includes(query) ||
        schedule.cronExpression?.toLowerCase().includes(query) ||
        schedule.id?.toLowerCase().includes(query)
    )
  }, [schedules, searchQuery, agentId])

  const schedulesCount = useMemo(() => {
    if (agentId) return schedules.filter((s) => s.agentId === agentId).length
    return schedules.length
  }, [schedules, agentId])

  const columns: TDataTableColumn<Schedule>[] = [
    {
      id: 'prompt',
      label: 'Prompt',
      render: (schedule) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScheduleIcon sx={{ color: 'text.secondary' }} />
          <Text
            variant='body2'
            fontWeight='medium'
            display='block'
            overflow='hidden'
            whiteSpace='nowrap'
            textOverflow='ellipsis'
            sx={{ maxWidth: 300 }}
          >
            {schedule.prompt}
          </Text>
        </Box>
      ),
    },
    {
      id: 'cronExpression',
      label: 'Cron',
      width: 150,
      render: (schedule) => (
        <Text
          variant='body2'
          color='text.secondary'
          sx={{ fontFamily: 'monospace' }}
        >
          {schedule.cronExpression}
        </Text>
      ),
    },
    {
      id: 'enabled',
      label: 'Status',
      width: 100,
      render: (schedule) => (
        <Chip
          size='small'
          label={schedule.enabled ? 'Enabled' : 'Disabled'}
          color={schedule.enabled ? 'success' : 'default'}
          variant='outlined'
        />
      ),
    },
    {
      id: 'nextRunAt',
      label: 'Next Run',
      width: 150,
      render: (schedule) => (
        <Text
          variant='body2'
          color='text.secondary'
        >
          {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : 'N/A'}
        </Text>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (schedule) => (
        <Box sx={styles.table.actions.box}>
          <ActionIconButton
            tooltip='Trigger Now'
            icon={<TriggerIcon sx={styles.table.actions.icon} />}
            size='small'
            color='success'
            onClick={(e) => {
              e.stopPropagation()
              onTrigger(schedule)
            }}
          />
          <ActionIconButton
            tooltip='Edit Schedule'
            icon={<EditIcon sx={styles.table.actions.icon} />}
            size='small'
            color='primary'
            onClick={(e) => {
              e.stopPropagation()
              onEditSchedule(schedule)
            }}
          />
          <ActionIconButton
            tooltip='Delete Schedule'
            icon={<DeleteIcon sx={styles.table.actions.icon} />}
            size='small'
            color='error'
            onClick={(e) => {
              e.stopPropagation()
              setDeleting(schedule)
            }}
          />
        </Box>
      ),
    },
  ]

  return (
    <PageLayout
      title='Schedules'
      loading={loading}
      searchCount={0}
      countLabel='schedule'
      query={searchQuery}
      count={schedulesCount}
      error={error?.message}
      setSearchQuery={setSearchQuery}
      actionIcon={<AddIcon />}
      onAction={schedulesCount > 0 && onCreateSchedule}
      actionLabel={schedulesCount > 0 && 'Create Schedule'}
      searchPlaceholder='Search schedules by prompt or cron...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : undefined)}
    >
      {!error && schedulesCount === 0 && !loading && (
        <EmptyState
          actionIcon={<AddIcon />}
          onAction={onCreateSchedule}
          actionLabel='Create Schedule'
          message='No schedules yet. Create your first schedule to get started.'
        />
      )}

      {!error && schedulesCount > 0 && filteredSchedules.length === 0 && (
        <EmptyState message='No schedules match your search query.' />
      )}

      {!error && filteredSchedules.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredSchedules}
          onRowClick={onEditSchedule}
          getRowKey={(schedule) => schedule.id}
        />
      )}

      {orgId && (
        <ScheduleDrawer
          orgId={orgId}
          agents={agents}
          open={dialogOpen}
          onRemove={setDeleting}
          schedule={selectedSchedule}
          onClose={onDialogClose}
          onSuccess={onSuccess}
        />
      )}

      {deleting && (
        <ConfirmDelete
          deleting={loading}
          onConfirm={onRemove}
          itemName={`Schedule`}
          onCancel={() => setDeleting(undefined)}
        />
      )}
    </PageLayout>
  )
}

export default Schedules
