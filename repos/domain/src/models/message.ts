import { Base } from './base'

export type MessageType = 'user' | 'assistant' | 'system' | 'tool' | 'action'

export class Message extends Base {
  type: MessageType
  content: Record<string, any>
  threadId: string
  meta?: Record<string, any>
  projectId?: string
  orgId?: string

  constructor(message: Partial<Message>) {
    super()
    Object.assign(this, message)
  }
}
