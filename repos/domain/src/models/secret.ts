import { Base } from './base'
import { omitKeys } from '@keg-hub/jsutils/omitKeys'

export class Secret extends Base {
  value?: any
  name: string
  orgId?: string
  hashKey: string
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
