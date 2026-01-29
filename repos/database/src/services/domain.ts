import type {
  TDatabase,
  TDBQueryOpts,
  TDBDomainsSelect,
  TDBDomainsInsert,
} from '@TDB/types'

import { and, eq } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { domains } from '@TDB/schemas/domains'
import { isStr } from '@keg-hub/jsutils/isStr'
import { certificates } from '@TDB/schemas/certificates'
import { Domain as DomainModel, Certificate as CertModel } from '@tdsk/domain'

export type TDomainOpts = {
  db: TDatabase
}

export type TValidCert = {
  error?: Error
  data?: CertModel
}

export type TDomainWithCerts = TDBDomainsSelect & {
  certificates: (typeof certificates.$inferSelect)[]
}

/**
 * Domain service for managing custom domains
 */
export class DomainService extends Base<
  typeof domains,
  TDBDomainsSelect,
  TDBDomainsInsert,
  DomainModel
> {
  constructor(opts: TDomainOpts) {
    super({ ...opts, table: domains })
  }
  model = (data: TDBDomainsSelect) => new DomainModel(data)

  /**
   * Get a single domain with certificate data
   * Overrides base class method to include certificate information
   */
  async get(id: string) {
    return await super.get(id, { with: { certificates: true } })
  }

  async create(data: TDBDomainsInsert) {
    // TODO: if sslCertificate exist, then create a new certificate in the certificates table
    // if the certificate if manually uploaded i.e. `data.sslCertificate` exists
    return await super.create(data)
  }

  async update(data: TDBDomainsInsert) {
    // TODO: if sslCertificate exist, then create a new certificate in the certificates table
    // if the certificate if manually uploaded i.e. `data.sslCertificate` exists
    return await super.update(data)
  }

  /**
   * Get domain by domain name with certificate data
   */
  async by(prop: string | Record<string, any>, value?: any | TDBQueryOpts) {
    const data = isStr(prop) ? { [prop]: value } : prop
    return await super.by(data, { with: { certificates: true } })
  }

  /**
   * Check if a domain has a valid SSL certificate
   * A certificate is considered valid if:
   * - It exists in caddy_certmagic_objects
   * - It was modified within the last 90 days (typical cert validity period)
   *
   * @param domain - Domain name to check
   * @returns Object with hasValidCert flag and certificate details
   */
  async find(domain: string): Promise<TValidCert> {
    try {
      const ninetyDaysAgo = new Date()
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

      const certs = await this.db
        .select()
        .from(certificates)
        .where(eq(certificates.parent, domain))

      // Filter for file-type certificates (not directories)
      // that have been updated within the last 90 days
      const validCert = certs.find(
        (cert) => cert.isFile && cert.modified && new Date(cert.modified) > ninetyDaysAgo
      )

      return !!validCert ? { data: new CertModel(validCert) } : { data: undefined }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Check if a domain exists and is verified
   * Called by Caddy's on_demand_tls ask endpoint
   */
  async validate(domain: string): Promise<boolean> {
    const resp = await this.by({ domain })
    return !!resp?.data && resp?.data.verified
  }

  /**
   * Mark a domain as verified
   */
  async verified(domain: string) {
    try {
      const [record] = await this.db
        .update(domains)
        .set({
          verified: true,
          verifiedAt: new Date(),
        })
        .where(eq(domains.domain, domain))
        .returning()

      return { data: this.model(record) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Enable SSL for a domain
   * SSL certificates are stored by Caddy in the caddy_certmagic_objects table
   */
  async enableSSL(domain: string) {
    const [domainRecord] = await this.db
      .update(domains)
      .set({
        sslEnabled: true,
      })
      .where(eq(domains.domain, domain))
      .returning()

    return domainRecord
  }

  /**
   * Disable SSL for a domain
   */
  async disableSSL(domain: string) {
    const [domainRecord] = await this.db
      .update(domains)
      .set({
        sslEnabled: false,
      })
      .where(eq(domains.domain, domain))
      .returning()

    return domainRecord
  }

  /**
   * Delete a domain
   */
  delete = async (domain: string) => {
    try {
      const resp = await this.db
        .delete(domains)
        .where(eq(domains.domain, domain))
        .returning()

      return { data: this.model(resp[0]) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Check if a domain belongs to a specific org or project
   * (for authorization)
   */
  async owner(domain: string, orgId?: string, projectId?: string) {
    const conditions = [eq(domains.domain, domain)]

    if (orgId) conditions.push(eq(domains.orgId, orgId))

    if (projectId) conditions.push(eq(domains.projectId, projectId))

    const [domainRecord] = await this.db
      .select()
      .from(domains)
      .where(and(...conditions))
      .limit(1)

    return !!domainRecord
  }
}
