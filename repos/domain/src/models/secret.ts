import { Base } from './base'
import { omitKeys } from '@keg-hub/jsutils/omitKeys'

export class Secret extends Base {
  static readonly scopeFields = [`orgId`, `projectId`, `providerId`, `agentId`] as const

  value?: string
  name: string
  orgId?: string
  hashKey: string
  agentId?: string
  projectId?: string
  providerId?: string
  description?: string
  encryptedValue: string

  constructor(secret: Partial<Secret>) {
    super()
    Object.assign(this, secret)
  }

  sanitize = () => {
    return new Secret(omitKeys(this, [`value`, `encryptedValue`]))
  }
}
