import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getSchedule } from '@TBE/endpoints/schedules/getSchedule'
import { listSchedules } from '@TBE/endpoints/schedules/listSchedules'
import { createSchedule } from '@TBE/endpoints/schedules/createSchedule'
import { updateSchedule } from '@TBE/endpoints/schedules/updateSchedule'
import { deleteSchedule } from '@TBE/endpoints/schedules/deleteSchedule'
import { triggerSchedule } from '@TBE/endpoints/schedules/triggerSchedule'

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
  },
}
