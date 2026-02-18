import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { Endpoint, Secret, TEndpointOpts } from '@tdsk/domain'

import { Exception } from '@TBE/utils/errors/exception'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
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
      throw new Exception(403, `Insufficient permissions to use this endpoint`)
    }
  }

  /**
   * Fetch secrets scoped to the endpoint's project.
   * Fixes the previous un-scoped db.services.secret.list() call.
   */
  async fetchSecrets(db: TDatabase, endpoint: Endpoint): Promise<Secret[]> {
    const { data: secrets = [] } = await db.services.secret.list({
      where: { projectId: endpoint.projectId },
    })
    return secrets as Secret[]
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
   * Validate HTTP method matches endpoint config (if specified).
   */
  validateMethod(req: TRequest, opts: TEndpointOpts): void {
    if (opts.method && opts.method.toLowerCase() !== req.method.toLowerCase()) {
      throw new Exception(
        405,
        `Method ${req.method} not allowed. Endpoint accepts ${opts.method.toUpperCase()}`
      )
    }
  }
}
