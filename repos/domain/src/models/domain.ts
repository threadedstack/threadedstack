import { Base } from './base'

type TDomainOpts = Omit<Partial<Domain>, `domain`> & { domain: string }

export class Domain extends Base {
  // Domain ownership via Exclusive Arc pattern
  // Only one of these should be set
  orgId?: string
  projectId?: string
  domain: string
  sslPrivateKey: string
  sslCertificate: string
  verified: boolean = false
  sslEnabled: boolean = false
  verifiedAt: string | Date
  sslExpiresAt: string | Date

  constructor(domain: TDomainOpts) {
    super()
    Object.assign(this, domain)
  }
}
