import { Base } from './base'

export class Thread extends Base {
  name?: string
  meta?: Record<string, any>
  public: boolean = false
  configId?: string
  providerId?: string
  userId: string

  constructor(thread: Partial<Thread>) {
    super()
    Object.assign(this, thread)
  }
}
