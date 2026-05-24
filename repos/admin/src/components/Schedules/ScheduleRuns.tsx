import type { ScheduleRun } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { Text } from '@tdsk/components'
import { useState, useEffect } from 'react'
import { truncate } from '@TAF/utils/text/truncate'
import { useScheduleRuns } from '@TAF/state/selectors'
import { StatusConfig } from '@TAF/constants/sandboxes'
import { formatDuration } from '@TAF/utils/transforms/time'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { FormSection } from '@TAF/components/FormSection/FormSection'
import { fetchScheduleRuns } from '@TAF/actions/schedules/api/fetchScheduleRuns'

export type TScheduleRunsProps = {
  orgId: string
  scheduleId: string
}

export const ScheduleRuns = ({ orgId, scheduleId }: TScheduleRunsProps) => {
  const [runsMap] = useScheduleRuns()
  const [loading, setLoading] = useState(false)

  const runs = runsMap?.[scheduleId] || []

  useEffect(() => {
    setLoading(true)
    fetchScheduleRuns(orgId, scheduleId).finally(() => setLoading(false))
  }, [orgId, scheduleId])

  const columns: TDataTableColumn<ScheduleRun>[] = [
    {
      id: 'status',
      label: 'Status',
      width: 100,
      render: (run) => {
        const config = StatusConfig[run.status] || {
          label: run.status,
          color: 'default' as const,
        }
        return (
          <Chip
            size='small'
            variant='outlined'
            label={config.label}
            color={config.color}
          />
        )
      },
    },
    {
      id: 'startedAt',
      label: 'Started At',
      width: 180,
      render: (run) => (
        <Text
          variant='body2'
          color='text.secondary'
        >
          {new Date(run.startedAt).toLocaleString()}
        </Text>
      ),
    },
    {
      id: 'duration',
      label: 'Duration',
      width: 100,
      render: (run) => (
        <Text
          variant='body2'
          color='text.secondary'
          sx={{ fontFamily: 'monospace' }}
        >
          {formatDuration(run.durationMs)}
        </Text>
      ),
    },
    {
      id: 'output',
      label: 'Output',
      width: 120,
      render: (run) => (
        <Text
          variant='body2'
          color={run.stdoutKey ? 'primary.main' : 'text.disabled'}
        >
          {run.stdoutKey ? `Available` : `None`}
        </Text>
      ),
    },
    {
      id: 'error',
      label: 'Error',
      render: (run) => (
        <Text
          variant='body2'
          color={run.error ? 'error.main' : 'text.secondary'}
          sx={{
            maxWidth: 200,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {truncate(run.error, 50)}
        </Text>
      ),
    },
  ]

  if (!loading && runs.length === 0) {
    return (
      <FormSection title='Run History'>
        <Box sx={{ py: 2 }}>
          <Text
            variant='body2'
            color='text.secondary'
          >
            No runs recorded yet.
          </Text>
        </Box>
      </FormSection>
    )
  }

  return (
    <FormSection title='Run History'>
      <DataTable
        size='small'
        data={runs}
        columns={columns}
        initialRowsPerPage={5}
        getRowKey={(run) => run.id}
      />
    </FormSection>
  )
}
