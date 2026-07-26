import type { Schedule } from '@tdsk/domain'

import Box from '@mui/material/Box'
import { Chip } from '@tdsk/components'
import { useEffect, useState } from 'react'
import Typography from '@mui/material/Typography'
import { scheduleApi } from '@TTH/services/scheduleApi'
import { Schedule as ScheduleIcon } from '@mui/icons-material'
import { MonoFont } from '@TTH/constants/values'
import { EmptyState } from '@TTH/components/EmptyState/EmptyState'
import { formatRelativeDate } from '@TTH/utils/formatDate'
import { RowList, SectionHeader } from '@TTH/components/PagePrimitives'

const ScheduleColumns = [
  { label: `Cron`, width: `140px` },
  { label: `Prompt`, width: `1fr` },
  { label: `Last run`, width: `140px` },
]

export type TProjectSchedulesSection = {
  orgId: string
  projectId: string
}

export const ProjectSchedulesSection = (props: TProjectSchedulesSection) => {
  const { orgId, projectId } = props
  const [schedules, setSchedules] = useState<Schedule[]>([])

  useEffect(() => {
    let cancelled = false

    scheduleApi.list(orgId, projectId).then((resp) => {
      if (!cancelled) setSchedules(resp.data || [])
    })

    return () => {
      cancelled = true
    }
  }, [orgId, projectId])

  return (
    <>
      <SectionHeader
        title='Schedules'
        count={schedules.length}
      />

      {schedules.length === 0 ? (
        <EmptyState
          icon={<ScheduleIcon />}
          title='No schedules configured for this project'
        />
      ) : (
        <RowList columns={ScheduleColumns}>
          {schedules.map((schedule, idx) => (
            <RowList.Row
              key={schedule.id}
              isLast={idx === schedules.length - 1}
            >
              {/* Cron */}
              <Box sx={{ display: `flex`, alignItems: `center` }}>
                <Typography
                  sx={{
                    fontSize: `12px`,
                    fontFamily: MonoFont,
                    color: `text.secondary`,
                  }}
                >
                  {schedule.cronExpression}
                </Typography>
              </Box>

              {/* Prompt */}
              <Box sx={{ display: `flex`, alignItems: `center` }}>
                <Typography
                  noWrap
                  sx={{ fontSize: `13px` }}
                  title={schedule.prompt}
                >
                  {schedule.prompt || `-`}
                </Typography>
              </Box>

              {/* Last run */}
              <Box sx={{ display: `flex`, alignItems: `center`, gap: `6px` }}>
                <Typography sx={{ fontSize: `12px`, color: `text.secondary` }}>
                  {formatRelativeDate(schedule.lastRunAt)}
                </Typography>
                {schedule.consecutiveErrors > 0 && (
                  <Chip
                    size='sm'
                    tone='error'
                    variant='tint'
                    label={`${schedule.consecutiveErrors} failing`}
                  />
                )}
              </Box>
            </RowList.Row>
          ))}
        </RowList>
      )}
    </>
  )
}
