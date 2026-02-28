import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { Endpoint, Secret } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { Exception } from '@TBE/utils/errors/exception'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { SecretResolver } from '@TBE/services/secrets/secretResolver'
import type { EEndpointType } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'

/**
 * BaseEndpoint
 *
 * Abstract base class for endpoint type services.
 * Provides shared operations (permission checks, secret fetching, validation)
 * while subclasses implement type-specific validation and execution.
 */
export abstract class BaseEndpoint {
  /** The endpoint type this service handles */
  abstract readonly type: EEndpointType

  /**
   * Validate type-specific options at create/update time.
   * Called from CRUD endpoint handlers to ensure required fields are present.
   * @param options - The endpoint options to validate
   */
  abstract validateOptions(options: Record<string, any>): void

  /**
   * Execute the endpoint at runtime (proxy request, faas call, agent run).
   * Called from the proxy engine dispatcher.
   */
  abstract execute(
    req: TRequest,
    res: Response,
    endpoint: Endpoint,
    db: TDatabase
  ): Promise<void>

  /**
   * Check permissions for non-public endpoints.
   * Skips check if endpoint.public is true.
   */
  async checkPermission(req: TRequest, endpoint: Endpoint): Promise<void> {
    if (endpoint.public) return

    try {
      await checkPermission(req, EPermAction.read, EPermResource.endpoint, {
        projectId: endpoint.projectId,
      })
    } catch (error) {
      logger.error(`Permission check failed:`, error)
      throw new Exception(403, `Insufficient permissions to use this endpoint`)
    }
  }

  /**
   * Fetch and decrypt secrets scoped to the endpoint's project.
   * Secrets are decrypted so {{template}} resolution and auth injection work.
   */
  async fetchSecrets(db: TDatabase, endpoint: Endpoint): Promise<Secret[]> {
    const { data: secrets = [] } = await db.services.secret.list({
      where: { projectId: endpoint.projectId },
    })

    if (!secrets.length) return []

    const resolver = new SecretResolver(db)
    const decrypted: Secret[] = []

    for (const secret of secrets) {
      const value = await resolver.decrypt(secret, secret.orgId || '')
      decrypted.push(value ? ({ ...secret, value } as Secret) : (secret as Secret))
    }

    return decrypted
  }

  /**
   * Verify endpoint belongs to the specified project.
   */
  validateProject(endpoint: Endpoint, projectId: string): void {
    if (endpoint.projectId !== projectId) {
      throw new Exception(403, `Endpoint does not belong to this project`)
    }
  }

  /**
   * Validate HTTP method matches endpoint's top-level method (if specified).
   */
  validateMethod(req: TRequest, endpoint: Endpoint): void {
    if (endpoint.method && endpoint.method.toLowerCase() !== req.method.toLowerCase()) {
      throw new Exception(
        405,
        `Method ${req.method} not allowed. Endpoint accepts ${endpoint.method.toUpperCase()}`
      )
    }
  }
}
