import { Base } from './base'

export class Secret extends Base {
  name: string
  hashKey: string
  encryptedValue: string
  teamId?: string
  repoId?: string

  constructor(secret: Partial<Secret>) {
    super()
    Object.assign(this, secret)
  }
}
