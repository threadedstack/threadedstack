import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import dns from 'node:dns'
import { EPMethod } from '@TBE/types'
import { Domain } from '@tdsk/domain'
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
    const { domain, orgId, projectId } = req.body

    if (!domain) {
      res.status(400).json({ error: `Domain is required` })
      return
    }

    if (!orgId && !projectId) {
      res.status(400).json({ error: `Either orgId or projectId is required` })
      return
    }

    // Check permission
    if (orgId) {
      await checkPermission(req, EPermAction.create, EPermResource.domain, { orgId })
    } else if (projectId) {
      // Get project to find orgId
      const { data: project } = await db.services.project.get(projectId)
      if (!project) {
        res.status(404).json({ error: `Project not found` })
        return
      }
      await checkPermission(req, EPermAction.create, EPermResource.domain, {
        orgId: project.orgId,
      })
    }

    // Step 1: Verify DNS configuration
    // Check if the domain points to our ingress
    try {
      const records = await new Promise<string[]>((resolve, reject) => {
        dns.resolveCname(domain, (err, addresses) => {
          if (err) {
            // If CNAME fails, try A record
            dns.resolve4(domain, (err2, addresses2) => {
              if (err2) reject(err2)
              else resolve(addresses2)
            })
          } else {
            resolve(addresses)
          }
        })
      })

      // Check if any record points to our ingress
      const pointsToIngress = records.some(
        (record) =>
          record === config.domains.proxyHost ||
          record.endsWith(`.${config.domains.proxyHost}`)
      )

      if (!pointsToIngress) {
        res.status(400).json({
          error: `Domain must point to ${config.domains.proxyHost}`,
          currentRecords: records,
        })
        return
      }
    } catch (error: any) {
      res.status(400).json({
        details: error.message,
        error: `DNS verification failed. Please ensure your domain is configured correctly.`,
      })
      return
    }

    // Step 2: Create domain in database
    const { data: record, error } = await db.services.domain.create(
      new Domain({
        domain,
        orgId,
        projectId,
      })
    )

    if (error) {
      res.status(404).json({ error: error?.message || `Domain "${domain}" not found!` })
      return
    }

    // Step 3: Trigger certificate pre-warming
    // This makes an HTTPS request to the domain to trigger Caddy's on-demand TLS
    try {
      const prewarmUrl = `https://${domain}`
      await fetch(prewarmUrl, {
        method: `GET`,
        headers: {
          [config.domains.prewarmHeader]: `true`,
        },
        // Timeout after 10 seconds (certificate generation can take 5-10s)
        signal: AbortSignal.timeout(10000),
      }).catch((err) => {
        // Log error but don`t fail the request
        // The certificate might still be generated
        console.warn(`Pre-warm request failed (this may be normal):`, err.message)
      })

      // Mark domain as verified after pre-warm
      await db.services.domain.verified(domain)
    } catch (error) {
      console.error(`Error during pre-warm:`, error)
      // Don't fail the request, the certificate will be generated on first real request
    }

    res.status(201).json({
      data: record,
      message: `Domain created successfully. SSL certificate will be generated shortly.`,
    })
  },
}
