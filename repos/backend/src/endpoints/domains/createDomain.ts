import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { TDBApiRes } from '@TDB/types'

import dns from 'node:dns'
import { EPMethod } from '@TBE/types'
import { Domain } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * POST /domains - Create a new custom domain
 * - Validates DNS configuration
 * - Triggers certificate pre-warming
 * User must have permission to create domains for the org or project
 */
export const createDomain: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
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

    // Check permission
    if (orgId) {
      await checkPermission(req, EPermAction.create, EPermResource.domain, { orgId })
    } else if (projectId) {
      // Get project to find orgId
      const { data: project } = await db.services.project.get(projectId)
      if (!project) throw new Exception(404, `Project not found`)

      await checkPermission(req, EPermAction.create, EPermResource.domain, {
        orgId: project.orgId,
      })
    }

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

    /** TODO: Extract this out to a Domain service */
    // Step 3: Trigger certificate pre-warming via HTTPS to invoke Caddy's on-demand TLS
    try {
      const prewarmRes = await fetch(`https://${domain}`, {
        method: `GET`,
        headers: { [config.domains.prewarmHeader]: `true` },
        signal: AbortSignal.timeout(10000),
      })

      if (prewarmRes.status < 400) {
        await db.services.domain.verified(domain)
      } else {
        const text = await prewarmRes.text()
        logger.warn(`Pre-warm request failed (this may be normal): ${text}`)
      }
    } catch (err: any) {
      logger.warn(`Pre-warm request failed (this may be normal): ${err.message}`)
      // Don't fail the request, the certificate will be generated on first real request
    }

    res.status(201).json({
      data: record,
      message: `Domain created successfully. SSL certificate will be generated shortly.`,
    })
  },
}
