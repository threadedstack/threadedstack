import type { TMsgType, TMessageContent } from '@TDM/types'

import { Base } from './base'

export class Message extends Base {
  orgId?: string
  type: TMsgType
  threadId: string
  projectId?: string
  content: TMessageContent[]
  meta?: Record<string, any>

  constructor(message: Partial<Message>) {
    super()
    Object.assign(this, message)
  }
}
