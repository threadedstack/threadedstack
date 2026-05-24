export enum EScheduleType {
  prompt = `prompt`,
  shell = `shell`,
}

type TScheduleBase = {
  id: string
  orgId: string
  userId?: string
  enabled: boolean
  threadId?: string
  sandboxId: string
  createThread: boolean
  cronExpression: string
  lastRunAt?: string | Date
  nextRunAt?: string | Date
  createdAt?: string | Date
  updatedAt?: string | Date
  consecutiveErrors?: number
  maxConsecutiveErrors?: number
}

export type TPromptSchedule = TScheduleBase & {
  type: EScheduleType.prompt
  prompt: string
  command?: never
}

export type TShellSchedule = TScheduleBase & {
  type: EScheduleType.shell
  command: string
  prompt?: never
}

export type TSchedule = TPromptSchedule | TShellSchedule

export type TScheduleRunStatus = `running` | `success` | `error` | `timeout`

export type TScheduleRun = {
  id: string
  orgId: string
  error?: string
  stdoutKey?: string
  stderrKey?: string
  scheduleId: string
  durationMs?: number
  instanceId?: string
  startedAt: string | Date
  createdAt?: string | Date
  updatedAt?: string | Date
  status: TScheduleRunStatus
  completedAt?: string | Date
}
