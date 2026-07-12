import { Base } from '@TDM/models/base'

export class SandboxStartingClaim extends Base {
  sandboxId!: string
  claimedAt!: string | Date
  releasedAt?: string | Date

  constructor(data: Partial<SandboxStartingClaim>) {
    super()
    Object.assign(this, data)
  }
}
