import { Base } from '@TDM/models/base'

export class Thread extends Base {
  name?: string
  userId: string
  orgId?: string
  agentId?: string
  sandboxId?: string
  projectId?: string
  providerId?: string
  public: boolean = false
  parentThreadId?: string
  branchMessageId?: string
  meta?: Record<string, any>
  ptyBuffer?: Buffer | null

  constructor(thread: Partial<Thread>) {
    super()
    Object.assign(this, thread)
  }
}
