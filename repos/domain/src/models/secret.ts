import { Base } from './base'

export class Secret extends Base {
  name: string
  hashKey: string
  teamId?: string
  repoId?: string
  providerId?: string
  encryptedValue: string

  constructor(secret: Partial<Secret>) {
    super()
    Object.assign(this, secret)
  }
}
