import { Base } from './base'

export class Thread extends Base {
  name?: string
  userId: string
  orgId?: string
  configId?: string
  projectId?: string
  providerId?: string
  public: boolean = false
  meta?: Record<string, any>

  constructor(thread: Partial<Thread>) {
    super()
    Object.assign(this, thread)
  }
}
