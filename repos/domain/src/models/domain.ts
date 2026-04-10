import { Base } from '@TDM/models/base'
import { Certificate } from '@TDM/models/certificate'

type TDomainOpts = Omit<Partial<Domain>, `domain`> & { domain: string }

/**
 * Domain model for custom user domains
 *
 * SSL certificates are stored by Caddy in the caddy_certmagic_objects table
 * (managed by caddy-storage-postgresql plugin)
 * Or directly on the domain object if uploaded manually
 * To check if a domain has a valid certificate, query the caddy_certmagic_objects
 * table where parent = domain.name
 */
export class Domain extends Base {
  // Domain ownership via Exclusive Arc pattern
  // Only one of these should be set
  orgId?: string
  projectId?: string
  domain: string
  verified: boolean = false
  verifiedAt?: string | Date
  sslEnabled: boolean = false
  // For manually uploaded SSL certificates
  sslPrivateKey?: string
  sslCertificate?: string
  sslExpiresAt?: string | Date
  certificates?: Certificate[] = []

  constructor(domain: TDomainOpts) {
    super()
    Object.assign(this, {
      ...domain,
      sslEnabled: domain.sslEnabled ?? !!domain.sslCertificate,
      certificates: domain?.certificates?.map((cert) => new Certificate(cert)) || [],
    })
  }

  /**
   * Get the first found certificate for the domain
   *
   * @returns string - Certificate text content
   */
  get certificate() {
    if (this.sslCertificate) return this.sslCertificate
    if (this.certificates?.length)
      return this.certificates.find((cert) => cert.isFile)?.value?.toString(`utf8`)
  }
}
