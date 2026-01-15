import type { EPermResource } from '@tdsk/domain'
import { EPermAction } from '@tdsk/domain'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'

/**
 * Hook to check if user can perform a specific action on a resource
 */
export const useCanPerform = (action: EPermAction, resource: EPermResource): boolean => {
  const permissions = usePermissions()

  switch (action) {
    case EPermAction.create:
      return permissions.canCreate(resource)
    case EPermAction.read:
      return permissions.canRead(resource)
    case EPermAction.update:
      return permissions.canUpdate(resource)
    case EPermAction.delete:
      return permissions.canDelete(resource)
    case EPermAction.manage:
      return permissions.canManage(resource)
    default:
      return false
  }
}
