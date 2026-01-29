import { Base } from './base'

export class Asset extends Base {
  url?: string
  content?: any
  name: string
  type: string
  orgId?: string
  userId?: string
  threadId?: string
  projectId?: string
  messageId?: string
  providerId?: string
  meta: Record<string, any> = {}

  constructor(asset: Partial<Asset>) {
    super()
    Object.assign(this, asset)
  }
}
