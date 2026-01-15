import { usePermissions } from './usePermissions'

/**
 * Simple hook to check if user is admin or higher
 * @deprecated Use usePermissions() for more granular checks
 */
export const useIsAdmin = () => {
  const { isAdmin } = usePermissions()
  return isAdmin
}
