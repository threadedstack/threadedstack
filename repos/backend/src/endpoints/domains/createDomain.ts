import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { TDBApiRes } from '@TDB/types'

import dns from 'node:dns'
import { EPMethod } from '@TBE/types'
import { Domain } from '@tdsk/domain'
import { Exception } from '@tdsk/domain'
import { authorize } from '@TBE/middleware/authorize'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { prewarmDomainCertificate } from '@TBE/services/domains'

/**
 * POST /domains - Create a new custom domain
 * - Validates DNS configuration
 * - Triggers certificate pre-warming
 * User must have permission to create domains for the org or project
 */
export const createDomain: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.domain)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, config } = req.app.locals
    const { orgId: paramOrgId, projectId: paramProjectId } = req.params
    const {
      domain,
      // For manually uploaded SSL certificates
      sslEnabled,
      sslExpiresAt,
      sslPrivateKey,
      sslCertificate,
    } = req.body
    const orgId = paramOrgId || req.body.orgId
    const projectId = paramProjectId || req.body.projectId

    if (!domain) throw new Exception(400, `Domain is required`)

    if (!orgId && !projectId)
      throw new Exception(400, `Either orgId or projectId is required`)

    // Step 1: Verify DNS — check if the domain points to our ingress
    let records: string[]
    try {
      records = await dns.promises
        .resolveCname(domain)
        .catch(() => dns.promises.resolve4(domain))
    } catch (error: any) {
      throw new Exception(
        400,
        `DNS verification failed: ${error.message}. Please ensure your domain is configured correctly.`
      )
    }

    const pointsToIngress = records.some(
      (record) =>
        record === config.domains.proxyHost ||
        record.endsWith(`.${config.domains.proxyHost}`)
    )

    if (!pointsToIngress)
      throw new Exception(
        400,
        `Domain must point to ${config.domains.proxyHost}. Current records: ${records.join(', ')}`
      )

    // Step 2: Create domain in database
    const createResult = await db.services.domain.create(
      new Domain({
        orgId,
        domain,
        projectId,
        sslEnabled,
        sslExpiresAt,
        sslPrivateKey,
        sslCertificate,
      })
    )

    if (createResult.error) {
      throw new Exception(500, createResult.error?.message || `Failed to create domain`)
    }

    // Type guard: if there's no error, data must exist
    const record = (createResult as TDBApiRes<Domain>).data

    if (!record) throw new Exception(500, `Failed to create domain`)

    // Step 3: Trigger certificate pre-warming via HTTPS to invoke Caddy's on-demand TLS
    await prewarmDomainCertificate(db, domain, config.domains.prewarmHeader)

    res.status(201).json({
      data: record,
      message: `Domain created successfully. SSL certificate will be generated shortly.`,
    })
  },
}
