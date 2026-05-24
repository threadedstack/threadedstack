import type { TScheduleRunStatus } from '@TDM/types'
import { Base } from '@TDM/models/base'

export class ScheduleRun extends Base {
  orgId!: string
  error?: string
  output?: string
  scheduleId!: string
  durationMs?: number
  instanceId?: string
  startedAt!: string | Date
  completedAt?: string | Date
  status!: TScheduleRunStatus

  constructor(data: Partial<ScheduleRun>) {
    super()
    Object.assign(this, data)
  }
}
