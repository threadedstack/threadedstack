import type { TSandboxSessionStatus } from '@TDM/types'
import { Base } from '@TDM/models/base'

export class SandboxSession extends Base {
  orgId!: string
  userId!: string
  sandboxId!: string
  sessionId!: string
  instanceId!: string
  projectId?: string
  durationMs?: number
  stdoutKey?: string
  stderrKey?: string
  startedAt!: string | Date
  completedAt?: string | Date
  status!: TSandboxSessionStatus

  constructor(data: Partial<SandboxSession>) {
    super()
    Object.assign(this, data)
  }
}
