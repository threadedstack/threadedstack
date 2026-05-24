export type TSandboxSessionStatus = `connected` | `completed` | `error` | `crashed`

export type TSandboxSessionRecord = {
  id: string
  orgId: string
  userId: string
  sandboxId: string
  sessionId: string
  instanceId: string
  projectId?: string
  durationMs?: number
  stdoutKey?: string
  stderrKey?: string
  startedAt: string | Date
  createdAt?: string | Date
  updatedAt?: string | Date
  completedAt?: string | Date
  status: TSandboxSessionStatus
}
