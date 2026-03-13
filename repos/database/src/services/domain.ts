import type {
  TDBApiRes,
  TDBUpdate,
  TServiceOpts,
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

export type TValidCert = {
  error?: Error
  data?: CertModel
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
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: domains })
  }
  model = (data: TDBDomainsSelect) => new DomainModel(data as DomainModel)

  /**
   * Get a single domain with certificate data
   * Overrides base class method to include certificate information
   */
  async get(id: string) {
    return await super.get(id, { with: { certificates: true } })
  }

  async create(data: TDBDomainsInsert) {
    return this.#withCert(await super.create(data), data)
  }

  async update(data: TDBUpdate<TDBDomainsInsert>) {
    return this.#withCert(await super.update(data), data)
  }

  async #withCert(
    result: TDBApiRes<DomainModel>,
    data: { sslCertificate?: string | null; sslPrivateKey?: string | null }
  ) {
    if (data.sslCertificate && result.data) {
      const { error } = await this.#customCert(
        result.data.domain,
        data.sslCertificate,
        data.sslPrivateKey as string
      )
      if (error) return { error } as TDBApiRes<DomainModel>
    }
    return result
  }

  /**
   * Get domain by domain name with certificate data
   */
  async by(prop: string | Record<string, any>, value?: any | TDBQueryOpts) {
    const data = isStr(prop) ? { [prop]: value } : prop
    return await super.by(data, { with: { certificates: true } })
  }

  /**
   * Save a manually uploaded SSL certificate to the certificates table
   * Follows the same pattern as Caddy's certmagic storage for compatibility
   *
   * Caddy stores certificates in a hierarchical structure:
   * - For domain "example.com":
   *   - Directory entry: ("", "example.com", false)
   *   - Certificate file: ("example.com", "example.com.crt", true, <cert_data>)
   *   - Private key file: ("example.com", "example.com.key", true, <key_data>)
   *
   * @param domain - Domain name (e.g., 'example.com')
   * @param certificate - SSL certificate PEM string
   * @param privateKey - SSL private key PEM string (optional)
   */
  async #customCert(domain: string, certificate: string, privateKey?: string) {
    try {
      await this.db.transaction(async (tx) => {
        const upsertFile = (name: string, content: string) => {
          const value = Buffer.from(content, 'utf-8')
          return tx
            .insert(certificates)
            .values({ parent: domain, name, isFile: true, value, modified: new Date() })
            .onConflictDoUpdate({
              target: [certificates.parent, certificates.name],
              set: { value, modified: new Date() },
            })
        }

        await tx
          .insert(certificates)
          .values({
            parent: '',
            name: domain,
            isFile: false,
            value: null,
            modified: new Date(),
          })
          .onConflictDoNothing()

        await upsertFile(`${domain}.crt`, certificate)
        if (privateKey) await upsertFile(`${domain}.key`, privateKey)
      })

      return { success: true }
    } catch (error: any) {
      return { error }
    }
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

      return validCert ? { data: new CertModel(validCert) } : { data: undefined }
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
    return this.#setSSL(domain, true)
  }

  /**
   * Disable SSL for a domain
   */
  async disableSSL(domain: string) {
    return this.#setSSL(domain, false)
  }

  async #setSSL(domain: string, sslEnabled: boolean): Promise<TDBApiRes<DomainModel>> {
    try {
      const [record] = await this.db
        .update(domains)
        .set({ sslEnabled })
        .where(eq(domains.domain, domain))
        .returning()

      return { data: this.model(record) }
    } catch (error: any) {
      return { error } as TDBApiRes<DomainModel>
    }
  }

  /**
   * Delete a domain
   */
  delete = async (domain: string) => {
    try {
      const [record] = await this.db
        .delete(domains)
        .where(eq(domains.domain, domain))
        .returning()

      return { data: this.model(record) }
    } catch (error: any) {
      return { error } as TDBApiRes<DomainModel>
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
