import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBDomainsSelect, TDBDomainsInsert } from '@TDB/types'

import { and, eq } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { domains } from '@TDB/schemas/domains'
import { Domain as DomainModel } from '@tdsk/domain'

export type TDomainOpts = {
  db: NodePgDatabase
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
    const [domainRecord] = await this.db
      .update(domains)
      .set({
        verified: true,
        verifiedAt: new Date(),
      })
      .where(eq(domains.domain, domain))
      .returning()

    return domainRecord
  }

  /**
   * Set SSL certificate info
   * TODO: somehow need to have caddy pass the creds to this function
   * When caddy generates a new SSL cert for the domain
   * Investigate Caddy postgres plugin
   */
  async setSSLInfo(
    domain: string,
    data: {
      sslEnabled: boolean
      sslCertificate?: string
      sslPrivateKey?: string
      sslExpiresAt?: Date
    }
  ) {
    const [domainRecord] = await this.db
      .update(domains)
      .set(data)
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
