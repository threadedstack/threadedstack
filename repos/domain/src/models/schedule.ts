import { Base } from '@TDM/models/base'
import { EScheduleType } from '@TDM/types'

export class Schedule extends Base {
  orgId!: string
  prompt?: string
  userId?: string
  command?: string
  threadId?: string
  sandboxId!: string
  enabled: boolean = true
  cronExpression!: string
  lastRunAt?: string | Date
  nextRunAt?: string | Date
  createThread: boolean = true
  maxConsecutiveErrors: number = 5
  consecutiveErrors: number = 0
  type: EScheduleType = EScheduleType.prompt

  constructor(schedule: Partial<Schedule>) {
    super()
    Object.assign(this, schedule)
  }
}
