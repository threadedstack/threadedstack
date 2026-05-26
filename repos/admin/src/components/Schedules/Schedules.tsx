import type { Schedule } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { useState, useMemo } from 'react'
import { useProjectSchedules } from '@TAF/state/selectors'
import { EPermResource, EScheduleType } from '@tdsk/domain'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { formatRelativeTime } from '@TAF/utils/transforms/time'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { ConfirmDelete, Text, DataTableSkeleton } from '@tdsk/components'
import { ScheduleDrawer } from '@TAF/components/Schedules/ScheduleDrawer'
import { deleteSchedule } from '@TAF/actions/schedules/api/deleteSchedule'
import { triggerSchedule } from '@TAF/actions/schedules/api/triggerSchedule'
import { fetchScheduleRuns } from '@TAF/actions/schedules/api/fetchScheduleRuns'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as TriggerIcon,
  Timer as ScheduleIcon,
  Terminal as ShellIcon,
} from '@mui/icons-material'

export type TSchedules = {
  orgId?: string
  projectId?: string
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

const skeletonColumns = [
  { id: `type`, label: `Type`, width: 120 },
  { id: `prompt`, label: `Content` },
  { id: `cronExpression`, label: `Cron`, width: 150 },
  { id: `enabled`, label: `Status`, width: 120 },
  { id: `lastRunAt`, label: `Last Run`, width: 120 },
  { id: `consecutiveErrors`, label: `Errors`, width: 80 },
  { id: `nextRunAt`, label: `Next Run`, width: 150 },
  { id: `actions`, label: `Actions`, align: `right` as const },
]

export const Schedules = (props: TSchedules) => {
  const { orgId, projectId } = props

  const [schedulesMap] = useProjectSchedules()
  const isInitialLoading = schedulesMap === undefined
  const { canCreate, canUpdate, canDelete, canExec } = usePermissions()
  const schedules = useMemo(() => Object.values(schedulesMap || {}), [schedulesMap])

  const [error, setError] = useState<Error>()
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState<Schedule>()
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null)

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
    fetchScheduleRuns(orgId, projectId, schedule.id)
  }

  const onTrigger = async (schedule: Schedule) => {
    if (!orgId || !projectId)
      return toast.error(`Cannot trigger schedule: missing project context`)

    const resp = await triggerSchedule(orgId, projectId, schedule.id)
    resp.error
      ? toast.error(`Failed to trigger schedule`)
      : toast.success(`Schedule triggered successfully`)
  }

  const onRemove = async () => {
    if (!deleting) return
    if (!orgId || !projectId)
      return toast.error(`Cannot delete schedule: missing project context`)

    setLoading(true)
    setError(undefined)

    const result = await deleteSchedule(orgId, projectId, deleting.id)

    if (result.error)
      setError(
        result.error instanceof Error ? result.error : new Error(String(result.error))
      )

    setLoading(false)
    setDeleting(undefined)
    dialogOpen && setDialogOpen(false)
  }

  const filteredSchedules = useMemo(() => {
    if (!searchQuery.trim()) return schedules

    const query = searchQuery.toLowerCase()
    return schedules.filter(
      (schedule) =>
        schedule.prompt?.toLowerCase().includes(query) ||
        schedule.command?.toLowerCase().includes(query) ||
        schedule.cronExpression?.toLowerCase().includes(query) ||
        schedule.id?.toLowerCase().includes(query)
    )
  }, [schedules, searchQuery])

  const columns: TDataTableColumn<Schedule>[] = [
    {
      id: 'type',
      label: 'Type',
      width: 120,
      render: (schedule) => (
        <Chip
          size='small'
          variant='outlined'
          icon={
            schedule.type === EScheduleType.shell ? (
              <ShellIcon sx={{ fontSize: 14 }} />
            ) : (
              <ScheduleIcon sx={{ fontSize: 14 }} />
            )
          }
          label={schedule.type === EScheduleType.shell ? 'Shell' : 'Prompt'}
          color={schedule.type === EScheduleType.shell ? 'info' : 'secondary'}
        />
      ),
    },
    {
      id: 'prompt',
      label: 'Content',
      render: (schedule) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Text
            variant='body2'
            display='block'
            overflow='hidden'
            whiteSpace='nowrap'
            fontWeight='medium'
            textOverflow='ellipsis'
            sx={{ maxWidth: 300 }}
          >
            {schedule.type === EScheduleType.shell ? schedule.command : schedule.prompt}
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
      width: 120,
      render: (schedule) => {
        const autoDisabled = !schedule.enabled && (schedule.consecutiveErrors ?? 0) >= 5

        return (
          <Chip
            size='small'
            variant='outlined'
            label={
              autoDisabled ? 'Auto-disabled' : schedule.enabled ? 'Enabled' : 'Disabled'
            }
            color={autoDisabled ? 'warning' : schedule.enabled ? 'success' : 'default'}
          />
        )
      },
    },
    {
      id: 'lastRunAt',
      label: 'Last Run',
      width: 120,
      render: (schedule) => (
        <Text
          variant='body2'
          color='text.secondary'
        >
          {formatRelativeTime(schedule.lastRunAt)}
        </Text>
      ),
    },
    {
      id: 'consecutiveErrors',
      label: 'Errors',
      width: 80,
      render: (schedule) => {
        const errorCount = schedule.consecutiveErrors ?? 0
        if (errorCount === 0) {
          return (
            <Text
              variant='body2'
              color='text.secondary'
            >
              0
            </Text>
          )
        }

        return (
          <Chip
            size='small'
            variant='outlined'
            color='warning'
            label={errorCount}
          />
        )
      },
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
            size='small'
            color='success'
            tooltip='Trigger Now'
            disabled={!canExec(EPermResource.schedule)}
            icon={<TriggerIcon sx={styles.table.actions.icon} />}
            disabledTooltip='You do not have permission to trigger schedules'
            onClick={(e) => {
              e.stopPropagation()
              onTrigger(schedule)
            }}
          />
          <ActionIconButton
            size='small'
            color='primary'
            tooltip='Edit Schedule'
            disabled={!canUpdate(EPermResource.schedule)}
            icon={<EditIcon sx={styles.table.actions.icon} />}
            disabledTooltip='You do not have permission to edit schedules'
            onClick={(e) => {
              e.stopPropagation()
              onEditSchedule(schedule)
            }}
          />
          <ActionIconButton
            size='small'
            color='error'
            tooltip='Delete Schedule'
            disabled={!canDelete(EPermResource.schedule)}
            icon={<DeleteIcon sx={styles.table.actions.icon} />}
            disabledTooltip='You do not have permission to delete schedules'
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
      error={error?.message}
      actionIcon={<AddIcon />}
      setSearchQuery={setSearchQuery}
      onAction={schedules.length > 0 && onCreateSchedule}
      actionDisabled={!canCreate(EPermResource.schedule)}
      actionLabel={schedules.length > 0 && 'Create Schedule'}
      count={isInitialLoading ? undefined : schedules.length}
      searchPlaceholder='Search schedules by content or cron...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : undefined)}
    >
      {isInitialLoading && <DataTableSkeleton columns={skeletonColumns} />}

      {!isInitialLoading && !error && schedules.length === 0 && !loading && (
        <EmptyState
          actionIcon={<AddIcon />}
          onAction={onCreateSchedule}
          actionLabel='Create Schedule'
          actionDisabled={!canCreate(EPermResource.schedule)}
          message='No schedules yet. Create your first schedule to get started.'
        />
      )}

      {!isInitialLoading &&
        !error &&
        schedules.length > 0 &&
        filteredSchedules.length === 0 && (
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

      {orgId && projectId && (
        <ScheduleDrawer
          orgId={orgId}
          open={dialogOpen}
          projectId={projectId}
          onRemove={setDeleting}
          onClose={onDialogClose}
          schedule={selectedSchedule}
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
