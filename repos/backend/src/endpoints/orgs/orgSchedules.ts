import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getSchedule } from '@TBE/endpoints/schedules/getSchedule'
import { listSchedules } from '@TBE/endpoints/schedules/listSchedules'
import { getScheduleRun } from '@TBE/endpoints/schedules/getScheduleRun'
import { createSchedule } from '@TBE/endpoints/schedules/createSchedule'
import { updateSchedule } from '@TBE/endpoints/schedules/updateSchedule'
import { deleteSchedule } from '@TBE/endpoints/schedules/deleteSchedule'
import { triggerSchedule } from '@TBE/endpoints/schedules/triggerSchedule'
import { listScheduleRuns } from '@TBE/endpoints/schedules/listScheduleRuns'
import { getScheduleRunOutput } from '@TBE/endpoints/schedules/getScheduleRunOutput'

export const orgSchedules: TEndpointConfig = {
  path: `/:orgId/schedules`,
  method: EPMethod.Use,
  middleware: [featureGate(`schedules`)],
  endpoints: {
    listSchedules,
    getSchedule,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    triggerSchedule,
    listScheduleRuns,
    getScheduleRun,
    getScheduleRunOutput,
  },
}
