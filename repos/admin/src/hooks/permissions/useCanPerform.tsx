import type { EPermAction, EPermResource } from '@tdsk/domain'
import { canPerform } from '@tdsk/domain'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'

/**
 * Hook to check if user can perform a specific action on a resource
 */
export const useCanPerform = (action: EPermAction, resource: EPermResource): boolean => {
  const { role } = usePermissions()
  return canPerform(role, action, resource).allowed
}
