import type { TRequest } from '@TBE/types'
import type { EPermAction, EPermResource } from '@tdsk/domain'

import { Exception } from '@TBE/utils/errors/exception'
import type { TPermissionContext } from '@TBE/utils/auth/checkPermission'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * Fetch a resource by ID, throw 404 if not found, and check permissions.
 * Reduces boilerplate in endpoints that need get->404->permission pattern.
 *
 * @param req - Express request
 * @param service - Database service with get() method (e.g., db.services.agent)
 * @param id - Resource ID to fetch
 * @param action - Permission action (create, read, update, delete)
 * @param resource - Permission resource type
 * @param label - Human-readable resource name for 404 message
 * @param getContext - Function to extract permission context from the fetched resource
 * @returns The fetched resource data
 */
export const requireResourceWithPermission = async <
  T extends { orgId?: string; projectId?: string },
>(
  req: TRequest,
  service: { get: (id: string, opts?: any) => Promise<{ data?: T; error?: any }> },
  id: string,
  action: EPermAction,
  resource: EPermResource,
  label: string,
  getContext?: (data: T) => TPermissionContext
): Promise<T> => {
  const { data, error } = await service.get(id)

  // DB service returns { error: DBError('X not found') } for missing records
  if (error) {
    if (error.message?.toLowerCase().includes(`not found`))
      throw new Exception(404, `${label} not found`)
    throw new Exception(500, error.message)
  }
  if (!data) throw new Exception(404, `${label} not found`)

  const context = getContext
    ? getContext(data)
    : { orgId: data.orgId, projectId: data.projectId }

  await checkPermission(req, action, resource, context)

  return data
}
