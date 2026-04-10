import { Base } from '@TDM/models/base'

export class Schedule extends Base {
  agentId!: string
  orgId!: string
  cronExpression!: string
  prompt!: string
  enabled: boolean = true
  lastRunAt?: string | Date
  nextRunAt?: string | Date
  threadId?: string
  createThread: boolean = true
  maxConsecutiveErrors: number = 5
  consecutiveErrors: number = 0

  constructor(schedule: Partial<Schedule>) {
    super()
    Object.assign(this, schedule)
  }
}
