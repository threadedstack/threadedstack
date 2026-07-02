import { Base } from '@TDM/models/base'
import { EScheduleType } from '@TDM/types'

export class Schedule extends Base {
  orgId!: string
  prompt?: string
  userId?: string
  agentId?: string
  threadId?: string
  command?: string
  projectId!: string
  sandboxId!: string
  enabled: boolean = true
  cronExpression!: string
  lastRunAt?: string | Date
  nextRunAt?: string | Date
  consecutiveErrors: number = 0
  maxConsecutiveErrors: number = 5
  type: EScheduleType = EScheduleType.prompt

  constructor(schedule: Partial<Schedule>) {
    super()
    Object.assign(this, schedule)
  }
}
