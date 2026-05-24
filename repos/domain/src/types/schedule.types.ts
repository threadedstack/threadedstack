export enum EScheduleType {
  prompt = `prompt`,
  shell = `shell`,
}

export type TScheduleRunStatus = `running` | `success` | `error` | `timeout`

export type TScheduleRun = {
  id: string
  orgId: string
  error?: string
  projectId: string
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
